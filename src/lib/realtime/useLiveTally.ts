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
 *  - Broadcasts carry ABSOLUTE counts merged with "highest wins" (counts are
 *    monotonic within a run), so no race or reordering can regress the board;
 *    a dropped frame is healed by the periodic open-poll resync.
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
// Backstop resync cadence while the poll is OPEN: even if a tally broadcast is
// silently dropped (degraded wifi, throttled tab) no vote stays unpainted for
// longer than this.
const OPEN_RESYNC_MS = 30_000;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8000;
// Percentages stay hidden until the room is meaningful (no "67%" at 3 votes).
const MEANINGFUL_TOTAL = 10;

export interface UseLiveTallyOptions {
  /**
   * When false, the hook performs NO network work (no get_results read, no WS
   * subscription) and returns idle defaults. Lets a caller pause the whole
   * realtime lifecycle (e.g. an inactive admin tab) without unmounting.
   * Defaults to true.
   */
  enabled?: boolean;
  /**
   * External "the poll is open" signal used ONLY before the first status
   * broadcast (status === null): a screen that mounts mid-vote never receives
   * a status event, so without this the open-poll resync backstop would not
   * run. Once a broadcast status is known it is the sole authority again.
   * Defaults to false.
   */
  assumeOpen?: boolean;
}

export interface UseLiveTallyResult {
  /** Teams ordered by count desc (stable by team_position), ranked, with %. */
  teams: RankedTeam[];
  status: PollStatus | null;
  /**
   * Server timestamp the poll opens at, or null. During `countdown` this is a
   * FUTURE timestamp, so the projector derives its pre-vote count-in from it.
   */
  opensAt: string | null;
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

export function useLiveTally(
  pollId: string,
  options?: UseLiveTallyOptions,
): UseLiveTallyResult {
  const enabled = options?.enabled ?? true;
  const assumeOpen = options?.assumeOpen ?? false;
  const supabase = useMemo(() => createClient(), []);

  const [metas, setMetas] = useState<Map<string, TeamMeta>>(new Map());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [status, setStatus] = useState<PollStatus | null>(null);
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [ready, setReady] = useState(false);

  // Mutable refs that must not trigger re-subscription.
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingCounts = useRef<Map<string, number>>(new Map());
  // Run epoch: bumped on every legitimate reset boundary (status -> draft, i.e.
  // a relaunch). Any snapshot that STARTED before the bump is from the previous
  // run and is discarded on arrival, so a slow in-flight read can never
  // resurrect the previous run's counts after the reset.
  const runEpoch = useRef(0);
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
          // Monotonic within a run: counts are absolute and only grow, so max()
          // makes a late/stale frame harmless instead of a regression.
          next.set(teamId, Math.max(next.get(teamId) ?? 0, count));
        }
        return next;
      });
      pendingCounts.current.clear();
    }, BATCH_MS);
  }, []);

  // Guard against a stale in-flight snapshot applying after a pollId switch.
  const pollIdRef = useRef(pollId);
  useEffect(() => {
    pollIdRef.current = pollId;
  }, [pollId]);

  /**
   * Authoritative resync: fetch the absolute snapshot via `get_results` and
   * MERGE it into state with max() per team (never a blanking replace).
   *
   * Within a run counts are absolute and MONOTONIC (votes only insert), so
   * "highest wins" is always correct and makes every race harmless by
   * construction: overlapping snapshots resolving out of order, a snapshot
   * racing a broadcast, or a stale queued flush can each only be a no-op,
   * never a regression. (The previous "latest wins + lastBroadcastAt" guard
   * could regress when two snapshots overlapped: the older read applying last
   * pinned the board short until the next event.)
   *
   * The only legitimate DECREASE is a relaunch reset — that path goes through
   * the `status: draft` handler, which bumps `runEpoch` and clears state
   * explicitly; any snapshot started before the bump is discarded here.
   *
   * Runs on mount, after every SUBSCRIBED transition, on status events, on
   * visibilitychange, and on the OPEN_RESYNC_MS backstop while open.
   */
  const refreshSnapshot = useCallback(async () => {
    const epochAtStart = runEpoch.current;
    const { data, error } = await supabase.rpc("get_results", {
      p_poll_id: pollId,
    });
    if (pollIdRef.current !== pollId) return;
    // A reset happened while this read was in flight: the data belongs to the
    // previous run — applying it would resurrect pre-relaunch counts.
    if (runEpoch.current !== epochAtStart) return;
    if (error || !Array.isArray(data)) return;
    const rows = data as GetResultsRow[];
    const mMap = new Map<string, TeamMeta>();
    for (const r of rows) {
      mMap.set(r.team_id, {
        id: r.team_id,
        pollId,
        name: r.name,
        color: r.color,
        position: r.team_position,
      });
    }
    setMetas(mMap);
    setCounts((prev) => {
      const next = new Map(prev);
      for (const r of rows) {
        next.set(r.team_id, Math.max(next.get(r.team_id) ?? 0, r.count ?? 0));
      }
      return next;
    });
  }, [pollId, supabase]);

  // useLatest mirror so the effects below (and the status handler) can trigger
  // resyncs without coupling to refreshSnapshot's render identity.
  const refreshSnapshotRef = useRef(refreshSnapshot);
  useEffect(() => {
    refreshSnapshotRef.current = refreshSnapshot;
  }, [refreshSnapshot]);

  const handleEvent = useCallback(
    (evt: RealtimeEvent) => {
      // Wire shape is snake_case (DB triggers emit it verbatim — engram #926).
      if (evt.type === "tally") {
        // Absolute value — highest wins (monotonic within a run); batched to
        // the flush cadence.
        pendingCounts.current.set(
          evt.team_id,
          Math.max(pendingCounts.current.get(evt.team_id) ?? 0, evt.count),
        );
        scheduleFlush();
      } else if (evt.type === "status") {
        setStatus(evt.status);
        // A poll that changed status AFTER this screen mounted carries the fresh
        // opens_at/closes_at here, so the count-in (countdown) and the close timer
        // (open) appear on the flip even though the initial snapshot had none.
        if (evt.opens_at !== undefined) setOpensAt(evt.opens_at ?? null);
        if (evt.closes_at !== undefined) setClosesAt(evt.closes_at ?? null);
        // Relaunch (relaunch_poll: closed -> draft) is the ONE legitimate
        // decrease: team_tallies reset via a direct UPDATE with no tally
        // broadcasts. Reset explicitly here — bump the run epoch (discards any
        // in-flight snapshot of the previous run), drop queued frames, and
        // zero the board. No tally broadcast can legitimately arrive while the
        // poll is in draft/countdown (cast_vote rejects), so this cannot race
        // with real votes of the new run.
        // `countdown` is also a pre-vote boundary (counts are 0 by contract),
        // so it doubles as the reset if the screen missed the draft event
        // while reconnecting during a relaunch.
        if (evt.status === "draft" || evt.status === "countdown") {
          runEpoch.current++;
          pendingCounts.current.clear();
          setCounts(new Map());
        }
        // Every status flip may also mean counts changed without broadcasts —
        // resync the absolute snapshot (max-merge, so it can never regress).
        void refreshSnapshotRef.current();
      }
    },
    [scheduleFlush],
  );

  // useLatest: keep the newest handler in a ref so the subscribe effect below can
  // stay decoupled from render identity (deps = [pollId, supabase, enabled] only).
  // The ref is written in an effect (never during render) to satisfy the React
  // Compiler's refs rule; the WS callbacks read `.current` at fire time.
  const handleEventRef = useRef(handleEvent);
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  // Initial read (runs once per pollId): seed metadata + absolute counts.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      await refreshSnapshotRef.current();
      // Ready = the initial read RESOLVED (success or empty) — consumers gate
      // "no votes" states on it, so it must flip even on an RPC error.
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pollId, supabase, enabled]);

  // Subscribe to the private channel, with jittered reconnect on drop.
  // Deps are ONLY [pollId, supabase, enabled] — the event handler is read from a
  // ref, so the WS channel lifecycle is decoupled from render identity and never
  // tears down/re-subscribes on an unrelated re-render.
  useEffect(() => {
    if (!enabled) return;
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
          handleEventRef.current(payload as RealtimeEvent),
        )
        .on("broadcast", { event: "status" }, ({ payload }) =>
          handleEventRef.current(payload as RealtimeEvent),
        )
        .subscribe((subStatus) => {
          if (!mounted.current) return;
          if (subStatus === "SUBSCRIBED") {
            reconnectAttempts.current = 0;
            setConnectionState("live");
            // Authoritative resync on EVERY (re)join: votes broadcast during the
            // gap (initial-read→SUBSCRIBED, or a reconnect window) never replay,
            // so the absolute snapshot is the only way to catch up.
            void refreshSnapshotRef.current();
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
  }, [pollId, supabase, enabled]);

  // Cheap correctness net: when the tab returns to the foreground (browsers
  // throttle/park hidden tabs and their sockets), resync the absolute snapshot
  // so any tally missed while hidden is recovered without waiting for the next
  // broadcast. Never blanks the board (refreshSnapshot merges).
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const onVisibility = () => {
      if (!document.hidden) void refreshSnapshotRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);

  // Backstop resync while voting is live: realtime broadcast is best-effort,
  // so a silently dropped frame (venue wifi, throttled tab) would otherwise
  // leave the board short until the NEXT event. A cheap periodic get_results
  // (max-merge, never regresses) bounds that staleness to OPEN_RESYNC_MS.
  // The broadcast status gates it once known; before the first broadcast the
  // caller's `assumeOpen` signal (derived from its effective status) keeps the
  // backstop running for a client that mounted mid-vote and never got a flip.
  useEffect(() => {
    const effectivelyOpen =
      status === "open" || (status === null && assumeOpen);
    if (!enabled || !effectivelyOpen) return;
    const interval = setInterval(() => {
      void refreshSnapshotRef.current();
    }, OPEN_RESYNC_MS);
    return () => clearInterval(interval);
  }, [enabled, status, assumeOpen]);

  const teams = useMemo(() => rankAndOrder(metas, counts), [metas, counts]);

  // When paused, report the idle "connecting" state (derived, not stored) so a
  // stale "live"/"reconnecting" never leaks after the caller flips enabled off.
  return {
    teams,
    status,
    opensAt,
    closesAt,
    connectionState: enabled ? connectionState : "connecting",
    ready,
  };
}
