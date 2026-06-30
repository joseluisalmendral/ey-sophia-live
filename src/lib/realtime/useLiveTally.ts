"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type {
  ConnectionState,
  PollStatus,
  RankedTeam,
  RealtimeEvent,
} from "@/lib/types";

/**
 * useLiveTally — the shared realtime spine for both the voter and projector
 * surfaces.
 *
 * Lifecycle on mount:
 *  1. RPC `get_results(poll_id)` once for the initial ABSOLUTE counts + team
 *     metadata (name/color/position). This is the late-joiner correctness wall:
 *     a client that joins mid-poll gets the truth immediately.
 *  2. `realtime.setAuth(publishableKey)` — REQUIRED before subscribing to the
 *     PRIVATE channel, or the subscription silently fails. Anon uses the
 *     publishable key as the token.
 *  3. Subscribe to private channel `poll:<id>`, listening for broadcast
 *     `tally` (absolute count per team) and `status` (lifecycle) events.
 *
 * Resilience contract:
 *  - Incoming tally updates are BATCHED to ~120ms cadence (one flush) so a burst
 *    of votes animates as a single smooth FLIP step, not a flicker storm.
 *  - Broadcasts carry ABSOLUTE counts, so a dropped WS frame can never desync.
 *  - On a connection gap we NEVER flash the board to empty: the last known
 *    counts are retained and `connectionState` flips to 'reconnecting'.
 *  - Reconnect uses exponential backoff WITH JITTER to avoid thundering-herd
 *    reconnect storms when a venue's wifi blips for everyone at once.
 *
 * Returns teams ordered by count desc (stable tiebreak by team_position) with
 * 1-based ranks + suppressed-until-meaningful percentages, plus status,
 * closesAt and a coarse connectionState.
 */

/** Row shape returned by the `get_results` RPC. */
interface GetResultsRow {
  team_id: string;
  name: string;
  color: string;
  team_position: number;
  count: number;
}

interface TeamMeta {
  id: string;
  pollId: string;
  name: string;
  color: string;
  position: number;
}

const BATCH_MS = 120;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8000;
// Percentages stay hidden until the room is meaningful (no "67%" at 3 votes).
const MEANINGFUL_TOTAL = 10;

export interface UseLiveTallyResult {
  /** Teams ordered by count desc (stable by team_position), ranked, with %. */
  teams: RankedTeam[];
  status: PollStatus | null;
  /** Server timestamp the poll auto-closes at, or null. Display derives the timer from this. */
  closesAt: string | null;
  connectionState: ConnectionState;
  /** True once the initial get_results read has resolved (success or empty). */
  ready: boolean;
}

function jitter(ms: number): number {
  // Full-jitter: random in [ms/2, ms] keeps reconnects spread out.
  return ms / 2 + Math.random() * (ms / 2);
}

function rankAndOrder(
  metas: Map<string, TeamMeta>,
  counts: Map<string, number>,
): RankedTeam[] {
  const total = [...counts.values()].reduce((s, c) => s + c, 0);
  const meaningful = total >= MEANINGFUL_TOTAL;

  const rows = [...metas.values()].map((m) => ({
    ...m,
    count: counts.get(m.id) ?? 0,
  }));

  // Sort by count desc, then by configured team_position asc for a stable order.
  rows.sort((a, b) => b.count - a.count || a.position - b.position);

  // Dense 1-based ranking; equal counts share a rank.
  let lastCount = Number.POSITIVE_INFINITY;
  let lastRank = 0;
  return rows.map((r, i): RankedTeam => {
    const rank = r.count === lastCount ? lastRank : i + 1;
    lastCount = r.count;
    lastRank = rank;
    return {
      id: r.id,
      pollId: r.pollId,
      name: r.name,
      color: r.color,
      count: r.count,
      rank,
      percentage:
        meaningful && total > 0 ? Math.round((r.count / total) * 100) : null,
    };
  });
}

export function useLiveTally(pollId: string): UseLiveTallyResult {
  const supabase = useMemo(() => createClient(), []);

  const [metas, setMetas] = useState<Map<string, TeamMeta>>(new Map());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [status, setStatus] = useState<PollStatus | null>(null);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [ready, setReady] = useState(false);

  // Mutable refs that must not trigger re-subscription.
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingCounts = useRef<Map<string, number>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const mounted = useRef(true);

  /** Coalesce queued absolute counts into state on a fixed cadence. */
  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      if (!mounted.current || pendingCounts.current.size === 0) return;
      setCounts((prev) => {
        const next = new Map(prev);
        for (const [teamId, count] of pendingCounts.current) {
          next.set(teamId, count);
        }
        return next;
      });
      pendingCounts.current.clear();
    }, BATCH_MS);
  }, []);

  const handleEvent = useCallback(
    (evt: RealtimeEvent) => {
      if (evt.type === "tally") {
        // Absolute value — latest wins; batched to the flush cadence.
        pendingCounts.current.set(evt.teamId, evt.count);
        scheduleFlush();
      } else if (evt.type === "status") {
        setStatus(evt.status);
        if (evt.closesAt !== undefined) setClosesAt(evt.closesAt ?? null);
      }
    },
    [scheduleFlush],
  );

  // Initial read (runs once per pollId): seed metadata + absolute counts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_results", {
        p_poll_id: pollId,
      });
      if (cancelled) return;
      if (!error && Array.isArray(data)) {
        const rows = data as GetResultsRow[];
        const mMap = new Map<string, TeamMeta>();
        const cMap = new Map<string, number>();
        for (const r of rows) {
          mMap.set(r.team_id, {
            id: r.team_id,
            pollId,
            name: r.name,
            color: r.color,
            position: r.team_position,
          });
          cMap.set(r.team_id, r.count ?? 0);
        }
        setMetas(mMap);
        setCounts(cMap);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pollId, supabase]);

  // Subscribe to the private channel, with jittered reconnect on drop.
  useEffect(() => {
    mounted.current = true;

    const connect = async () => {
      if (!mounted.current) return;
      // PRIVATE channel requires an explicit realtime auth token first.
      const token =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        (await supabase.auth.getSession()).data.session?.access_token ??
        "";
      await supabase.realtime.setAuth(token);

      const channel = supabase.channel(`poll:${pollId}`, {
        config: { private: true },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "tally" }, ({ payload }) =>
          handleEvent(payload as RealtimeEvent),
        )
        .on("broadcast", { event: "status" }, ({ payload }) =>
          handleEvent(payload as RealtimeEvent),
        )
        .subscribe((subStatus) => {
          if (!mounted.current) return;
          if (subStatus === "SUBSCRIBED") {
            reconnectAttempts.current = 0;
            setConnectionState("live");
          } else if (
            subStatus === "CHANNEL_ERROR" ||
            subStatus === "TIMED_OUT" ||
            subStatus === "CLOSED"
          ) {
            // NEVER blank the board: keep last counts, flag reconnecting.
            setConnectionState("reconnecting");
            scheduleReconnect();
          }
        });
    };

    const scheduleReconnect = () => {
      if (reconnectTimer.current || !mounted.current) return;
      const attempt = reconnectAttempts.current++;
      const backoff = Math.min(
        RECONNECT_BASE_MS * 2 ** attempt,
        RECONNECT_MAX_MS,
      );
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        void connect();
      }, jitter(backoff));
    };

    void connect();

    return () => {
      mounted.current = false;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [pollId, supabase, handleEvent]);

  const teams = useMemo(() => rankAndOrder(metas, counts), [metas, counts]);

  return { teams, status, closesAt, connectionState, ready };
}
