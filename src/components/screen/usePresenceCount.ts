"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Lobby presence for the projector — live roster + count of joined voters, via
 * Supabase Realtime PRESENCE on a dedicated lobby channel.
 *
 * Design:
 *  - Uses its own channel `lobby:<pollId>`, separate from the private `poll:<id>`
 *    tally channel, so it never interferes with the tally subscription.
 *  - Realtime Authorization is enabled on this project (RLS on realtime.messages),
 *    and presence writes messages, so this uses a PRIVATE channel + setAuth and a
 *    matching `lobby:%` RLS policy (migration 20260701_lobby_presence). We call
 *    setAuth with the publishable key (anon) before subscribing.
 *  - The presence key is generated ONCE per hook instance (useRef), never per
 *    effect run, so re-subscribes don't inflate the count with stale keys.
 *  - Each presence entry is tagged with a `role`. The projector SCREEN tags itself
 *    `screen` and is EXCLUDED from the roster/count — they reflect joined VOTERS,
 *    not the board showing the count.
 *  - Voter entries MAY carry an anonymous `alias` ("Vega 12") tracked from the
 *    voter lobby. Entries WITHOUT an alias (older clients) still count; they are
 *    simply not shown by name in the feed.
 *
 * Degrades gracefully: if presence never syncs (auth/policy/offline), the state
 * stays null/empty and the caller shows a tasteful "scan to join" prompt instead.
 */

/** One joined voter as seen by the projector lobby. */
export interface LobbyMember {
  /** Stable presence key for this client (dedup / React key). */
  key: string;
  /** Anonymous display alias; null for legacy entries that never sent one. */
  alias: string | null;
  /** Client-reported join timestamp (ms epoch); used only for feed ordering. */
  at: number;
}

export interface LobbyRoster {
  /** Distinct joined voters; null until presence first syncs. */
  count: number | null;
  /** Joined voters, most recent first. */
  members: LobbyMember[];
}

interface PresenceEntry {
  role?: string;
  alias?: string;
  at?: number;
}

/**
 * useLobbyRoster — full lobby presence state (count + named roster).
 *
 * @param pollId  the poll whose lobby to observe
 * @param role    this client's presence role; `screen` clients are not counted.
 *                Defaults to `screen` (this hook is used by the projector).
 */
export function useLobbyRoster(
  pollId: string,
  role: "screen" | "voter" = "screen",
): LobbyRoster {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<LobbyRoster>({
    count: null,
    members: [],
  });

  // Stable presence key for this hook instance's lifetime. Lazily generated
  // ONCE inside the effect (Math.random is impure — never call it during render);
  // the ref persists across re-subscribes so the count never inflates with stale
  // keys.
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    if (keyRef.current === null) {
      keyRef.current = `c_${Math.random().toString(36).slice(2)}`;
    }
    const key = keyRef.current;
    const channel = supabase.channel(`lobby:${pollId}`, {
      config: { presence: { key }, private: true },
    });

    const recompute = () => {
      if (!active) return;
      const state = channel.presenceState<PresenceEntry>();
      // Collect distinct presence keys whose role is NOT `screen` (exclude boards).
      const members: LobbyMember[] = [];
      for (const [presenceKey, entries] of Object.entries(state)) {
        const isScreen = entries.some((e) => e.role === "screen");
        if (isScreen) continue;
        const withMeta = entries.find((e) => typeof e.alias === "string");
        members.push({
          key: presenceKey,
          alias: withMeta?.alias ?? null,
          at: entries[0]?.at ?? 0,
        });
      }
      members.sort((a, b) => b.at - a.at);
      setRoster({ count: members.length, members });
    };

    const connect = async () => {
      // PRIVATE channel needs an auth token before subscribe (anon = publishable).
      const token =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        (await supabase.auth.getSession()).data.session?.access_token ??
        "";
      await supabase.realtime.setAuth(token);

      channel
        .on("presence", { event: "sync" }, recompute)
        .on("presence", { event: "join" }, recompute)
        .on("presence", { event: "leave" }, recompute)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void channel.track({ at: Date.now(), role });
          }
          // On error/timeout we simply leave state as-is (null or last known);
          // the caller degrades to the "scan to join" prompt. No throw.
        });
    };

    void connect();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [pollId, supabase, role]);

  return roster;
}

/**
 * usePresenceCount — count-only view over the lobby roster (kept for callers
 * that only need the number). Same channel/auth semantics as useLobbyRoster.
 */
export function usePresenceCount(
  pollId: string,
  role: "screen" | "voter" = "screen",
): number | null {
  return useLobbyRoster(pollId, role).count;
}
