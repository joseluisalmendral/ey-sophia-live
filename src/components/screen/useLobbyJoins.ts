"use client";

import { useEffect, useState } from "react";

/**
 * useLobbyJoins — projector-side lobby join feed via HTTP POLLING (no realtime).
 *
 * Replaces the presence-based useLobbyRoster: the screen polls the CDN-cached
 * GET /api/poll/[id]/lobby (~1 origin hit / 2s thanks to s-maxage) on a ~4s
 * jittered, visibility-aware cadence. Voters land in the feed via their
 * one-shot POST /join, so the whole lobby runs with ZERO websockets — the only
 * realtime connection left on the screen is the tally channel.
 *
 * Count semantics: joins from voter phones in the CURRENT run only (run_seq
 * scoped server-side). The screen itself never posts, so it is excluded by
 * construction — no role filtering needed anymore.
 *
 * Degrades gracefully: on fetch failures the last known state is kept (or the
 * initial null count, which the caller renders as the plain "scan to join"
 * prompt). New aliases appearing between polls animate into the feed exactly
 * like presence joins did (AnimatePresence keys on the alias).
 */

/** One joined voter as seen by the projector lobby. */
export interface LobbyMember {
  /** Stable key for React/AnimatePresence (the alias is session-unique enough). */
  key: string;
  /** Anonymous display alias ("Vega 12"). */
  alias: string;
}

export interface LobbyJoins {
  /** Distinct joins this run; null until the first successful poll. */
  count: number | null;
  /** Most recent joiners, newest first. */
  members: LobbyMember[];
}

/** Base polling cadence; each tick adds up to 1s of jitter to avoid stampedes. */
const POLL_INTERVAL_MS = 4000;
const POLL_JITTER_MS = 1000;

interface LobbyResponse {
  count?: number;
  latest?: Array<{ alias?: string }>;
}

export function useLobbyJoins(pollId: string): LobbyJoins {
  const [state, setState] = useState<LobbyJoins>({ count: null, members: [] });

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      // Pause while the tab is hidden; visibilitychange rearms the loop.
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/poll/${encodeURIComponent(pollId)}/lobby`,
          { cache: "no-store" },
        );
        if (!active || !res.ok) return;
        const data = (await res.json()) as LobbyResponse;
        if (!active || typeof data.count !== "number") return;
        const seen = new Set<string>();
        const members: LobbyMember[] = [];
        for (const entry of data.latest ?? []) {
          const alias = typeof entry.alias === "string" ? entry.alias : null;
          if (!alias || seen.has(alias)) continue;
          seen.add(alias);
          members.push({ key: alias, alias });
        }
        setState({ count: data.count, members });
      } catch {
        // Keep last known state; the next tick retries.
      }
    };

    const schedule = () => {
      if (!active) return;
      timer = setTimeout(async () => {
        await tick();
        schedule();
      }, POLL_INTERVAL_MS + Math.random() * POLL_JITTER_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    void tick(); // immediate first read — the lobby should populate fast
    schedule();

    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollId]);

  return state;
}
