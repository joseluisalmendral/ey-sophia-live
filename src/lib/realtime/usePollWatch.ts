"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PollStatus } from "@/lib/types";

/**
 * usePollWatch — a lightweight, connection-free status watcher for a voter who
 * has ALREADY cast their vote.
 *
 * WHY THIS EXISTS (free-tier connection ceiling):
 *   Each open voter tab that holds a realtime WS subscription counts against the
 *   Supabase free-tier ceiling of 200 concurrent Realtime connections. In a real
 *   room the vast majority of attendees vote in the first minute and then just
 *   watch the big screen — but their phone tab stays open, holding a WS
 *   connection for the whole event. That is the true ceiling (≈ N open tabs + 2
 *   for the screen).
 *
 *   Once a voter has voted, they no longer need the live TALLY stream (the big
 *   screen shows the race). They only need TWO more things: (1) to know when the
 *   poll closes, and (2) their final rank at reveal. Both are cheap indexed
 *   reads. So after voting we DROP the WS subscription (useLiveTally is disabled
 *   by the caller) and switch to this hook, which polls a single indexed row on
 *   a slow visibility-aware cadence and fetches get_results exactly ONCE when
 *   the poll closes. Net effect: sustained WS connections fall to roughly
 *   (voters still deciding) + screen, not (everyone in the room) + screen.
 *
 * Cost shape: one `polls` row SELECT every POLL_MS while the tab is visible
 * (paused when hidden), plus one `get_results` RPC at close. This trades a
 * scarce resource (200 WS connections) for an abundant one (indexed HTTP reads).
 *
 * Returns the subset the post-vote voter UI needs: status, closesAt, the final
 * ranked teams (only after close), and a `ready` flag.
 */

const POLL_MS = 4000;

interface GetResultsRow {
  team_id: string;
  name: string;
  color: string;
  team_position: number;
  count: number;
}

export interface PollWatchTeam {
  id: string;
  name: string;
  color: string;
  count: number;
  rank: number;
}

export interface UsePollWatchResult {
  status: PollStatus | null;
  closesAt: string | null;
  /** Final ranked teams, populated once the poll is observed `closed`. */
  teams: PollWatchTeam[];
  ready: boolean;
}

/** Dense 1-based ranking (equal counts share a rank), matching useLiveTally. */
function rank(rows: GetResultsRow[]): PollWatchTeam[] {
  const sorted = [...rows].sort(
    (a, b) => b.count - a.count || a.team_position - b.team_position,
  );
  let lastCount = Number.POSITIVE_INFINITY;
  let lastRank = 0;
  return sorted.map((r, i) => {
    const rk = r.count === lastCount ? lastRank : i + 1;
    lastCount = r.count;
    lastRank = rk;
    return { id: r.team_id, name: r.name, color: r.color, count: r.count, rank: rk };
  });
}

export function usePollWatch(
  pollId: string,
  enabled: boolean,
): UsePollWatchResult {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<PollStatus | null>(null);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [teams, setTeams] = useState<PollWatchTeam[]>([]);
  const [ready, setReady] = useState(false);

  // Guard so get_results is fetched exactly once on the close transition.
  const resultsFetched = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchResults = async () => {
      if (resultsFetched.current) return;
      resultsFetched.current = true;
      const { data, error } = await supabase.rpc("get_results", {
        p_poll_id: pollId,
      });
      if (!active) return;
      if (!error && Array.isArray(data)) {
        setTeams(rank(data as GetResultsRow[]));
      }
    };

    const tick = async () => {
      if (!active) return;
      // Skip network work while the tab is hidden; resume on visibility.
      if (typeof document !== "undefined" && document.hidden) {
        schedule();
        return;
      }
      const { data, error } = await supabase
        .from("polls")
        .select("status, closes_at")
        .eq("id", pollId)
        .maybeSingle<{ status: PollStatus; closes_at: string | null }>();
      if (!active) return;
      if (!error && data) {
        setStatus(data.status);
        setClosesAt(data.closes_at);
        if (data.status === "closed") {
          await fetchResults();
        }
      }
      setReady(true);
      schedule();
    };

    const schedule = () => {
      if (!active) return;
      timer = setTimeout(tick, POLL_MS);
    };

    // Kick immediately, then on cadence. Also re-check the instant the tab
    // becomes visible again so a voter returning at close sees the reveal fast.
    void tick();
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [pollId, enabled, supabase]);

  return { status, closesAt, teams, ready };
}
