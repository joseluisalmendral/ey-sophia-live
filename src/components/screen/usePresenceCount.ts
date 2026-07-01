"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * usePresenceCount — a live "people in the room" count for the lobby, via
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
 *    `screen` and is EXCLUDED from the count — the count reflects joined VOTERS,
 *    not the board showing the count.
 *
 * Degrades gracefully: if presence never syncs (auth/policy/offline), the count
 * stays null and the caller shows a tasteful "scan to join" prompt instead.
 *
 * @param pollId  the poll whose lobby to observe
 * @param role    this client's presence role; `screen` clients are not counted.
 *                Defaults to `screen` (this hook is used by the projector).
 */
export function usePresenceCount(
  pollId: string,
  role: "screen" | "voter" = "screen",
): number | null {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState<number | null>(null);

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
      const state = channel.presenceState<{ role?: string }>();
      // Count distinct presence keys whose role is NOT `screen` (exclude boards).
      let voters = 0;
      for (const entries of Object.values(state)) {
        const isScreen = entries.some((e) => e.role === "screen");
        if (!isScreen) voters += 1;
      }
      setCount(voters);
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
          // On error/timeout we simply leave count as-is (null or last known);
          // the caller degrades to the "scan to join" prompt. No throw.
        });
    };

    void connect();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [pollId, supabase, role]);

  return count;
}
