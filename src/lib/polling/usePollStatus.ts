"use client";

import { useEffect, useRef, useState } from "react";
import type { PollStatus } from "@/lib/types";

/**
 * usePollStatus — the voter's connection-free lifecycle watcher.
 *
 * REPLACES realtime for the voter path. Voters must NEVER open a WebSocket (that
 * counts against Supabase's 200 concurrent-connection cap and does not scale to
 * a large room). Instead each phone polls the CDN-cached `/api/poll/[id]/status`
 * endpoint on a slow, jittered, visibility-aware cadence. Because the endpoint
 * is `public, s-maxage=3`, the whole room collapses to a few origin hits/sec.
 *
 * Cadence + abuse-safety (all deliberate so the polling reads as normal traffic,
 * never an attack). The cadence is STATUS-AWARE so open-detection is fast without
 * ever approaching Vercel's DDoS threshold (all responses are CDN-cached, so a
 * whole room collapses to ~1 origin hit / s-maxage window regardless):
 *  - WAITING (status draft/countdown, not yet voted): ~4s — the voter is staring
 *    at the lobby waiting for the flip, so detect `open` within a few seconds. A
 *    full room behind ONE venue NAT IP then produces well under ~25 req/s (verified
 *    safe; the ~700 req/s trip point is far away), and responses are cache hits.
 *  - OPEN, not yet voted: ~8s — the vote cards are up; they only need the close
 *    flip now, so back off.
 *  - AFTER voting: ~20s — they only await close/reveal and watch the big screen.
 *  - A random initial delay (0..base) spreads the first poll so a room that loads
 *    together does not fire one synchronized same-IP burst.
 *  - ±30% random jitter per tick so phones that loaded together do not sync into
 *    a thundering herd hitting the origin on the same second.
 *  - A hard floor: never schedule a request sooner than MIN_INTERVAL_MS (3s).
 *  - Exponential backoff on fetch error (capped), so a flaky network backs off
 *    instead of hammering.
 *  - AbortController + an in-flight guard: requests never overlap.
 *  - Pause entirely while the tab is hidden (visibilitychange); on return, fire
 *    one immediate tick then resume the interval.
 *  - Stop polling once the poll is terminal (closed) AND the caller has finished
 *    handling the reveal (`stopWhenClosed`), so a closed poll costs nothing.
 *
 * NEVER surfaces an error to the UI: on repeated failures it simply keeps the
 * last known state. The voter flow degrades to the "watch the big screen"
 * message; it never shows a spinner-of-death or an error toast.
 */

/**
 * Cadence while WAITING for the open flip (status draft/countdown, not voted).
 * Fast so the lobby → cards transition lands within a few seconds when there is
 * no count-in. With a count-in the client flips locally at opens_at (instant),
 * so this is only the fallback/correction path.
 */
const BASE_INTERVAL_WAITING_MS = 4000;
/** Cadence once OPEN but not yet voted: back off, only the close flip remains. */
const BASE_INTERVAL_OPEN_MS = 8000;
/**
 * Cadence when OPEN with NO closes_at (manual admin close). There is no local
 * closes_at flip to lean on, so polling is the ONLY way this voter learns the
 * poll closed — poll faster to shrink the "buttons still up after close" window.
 * Still well above the 3s floor and CDN-cached, so origin load stays flat.
 */
const BASE_INTERVAL_OPEN_MANUAL_MS = 4000;
/** Slowest cadence after voting: they only await close/reveal. */
const BASE_INTERVAL_AFTER_MS = 20000;
/**
 * Cadence once CLOSED when the caller keeps polling (`stopWhenClosed: false`).
 * A closed poll only changes if the admin relaunches it (closed -> draft), so a
 * slow watch is enough for the phone to return to the lobby on its own.
 */
const BASE_INTERVAL_CLOSED_MS = 20000;
/** Hard floor — a scheduled tick is never sooner than this, jitter included. */
const MIN_INTERVAL_MS = 3000;
/** ±30% jitter to desync the room. */
const JITTER_RATIO = 0.3;
/** Backoff cap on repeated fetch errors. */
const BACKOFF_MAX_MS = 30000;
/** Per-request timeout so a hung fetch cannot wedge the loop. */
const REQUEST_TIMEOUT_MS = 8000;

interface StatusResponse {
  status: PollStatus;
  opensAt: string | null;
  closesAt: string | null;
}

export interface UsePollStatusOptions {
  /**
   * Pass true once the voter has acted (voted or already-voted): post-action they
   * only await close/reveal, so the cadence drops to the slowest AFTER interval.
   */
  hasActed?: boolean;
  /**
   * When true, polling STOPS as soon as the observed status is `closed`. The
   * caller sets this once it no longer needs live updates (e.g. reveal fetched).
   * Defaults to true — a closed poll is terminal for the voter.
   */
  stopWhenClosed?: boolean;
}

export interface UsePollStatusResult {
  /** Last known status, or null until the first successful read. */
  status: PollStatus | null;
  /** Last known open timestamp (server-authoritative), or null. Drives the local opens_at flip. */
  opensAt: string | null;
  /** Last known close timestamp (server-authoritative), or null. */
  closesAt: string | null;
  /** True once the first read (success) has resolved. */
  ready: boolean;
}

/** Random interval in [base*(1-r), base*(1+r)], never below the hard floor. */
function jittered(base: number): number {
  const min = base * (1 - JITTER_RATIO);
  const max = base * (1 + JITTER_RATIO);
  const value = min + Math.random() * (max - min);
  return Math.max(MIN_INTERVAL_MS, value);
}

export function usePollStatus(
  pollId: string,
  options?: UsePollStatusOptions,
): UsePollStatusResult {
  const hasActed = options?.hasActed ?? false;
  const stopWhenClosed = options?.stopWhenClosed ?? true;

  const [status, setStatus] = useState<PollStatus | null>(null);
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Read the cadence inputs from refs inside the loop so the polling effect can
  // depend ONLY on [pollId] and never tear down / restart on an unrelated
  // re-render or when the voter acts.
  const hasActedRef = useRef(hasActed);
  const stopWhenClosedRef = useRef(stopWhenClosed);
  const statusRef = useRef<PollStatus | null>(null);
  // Last known closesAt, read inside the loop to pick the OPEN cadence (manual
  // close vs timed close) without restarting the polling effect.
  const closesAtRef = useRef<string | null>(null);
  useEffect(() => {
    hasActedRef.current = hasActed;
  }, [hasActed]);
  useEffect(() => {
    stopWhenClosedRef.current = stopWhenClosed;
  }, [stopWhenClosed]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let inFlight = false;
    let errorStreak = 0;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const terminal = () =>
      stopWhenClosedRef.current && statusRef.current === "closed";

    const schedule = (delay: number) => {
      clearTimer();
      if (!active || terminal()) return;
      timer = setTimeout(tick, delay);
    };

    const nextDelay = () => {
      if (errorStreak > 0) {
        // Exponential backoff on the error streak, capped, with jitter.
        const backoff = Math.min(
          MIN_INTERVAL_MS * 2 ** (errorStreak - 1),
          BACKOFF_MAX_MS,
        );
        return jittered(backoff);
      }
      // Status-aware cadence: fast while waiting for the open flip, back off once
      // open (only the close flip remains), slowest after the voter has acted or
      // once the poll is closed (only a relaunch can change it).
      let base: number;
      if (statusRef.current === "closed") {
        base = BASE_INTERVAL_CLOSED_MS;
      } else if (hasActedRef.current) {
        base = BASE_INTERVAL_AFTER_MS;
      } else if (statusRef.current === "open") {
        // Manual-close polls (no closes_at) rely on polling alone to learn the
        // close, so they keep a faster cadence than timed polls.
        base =
          closesAtRef.current === null
            ? BASE_INTERVAL_OPEN_MANUAL_MS
            : BASE_INTERVAL_OPEN_MS;
      } else {
        base = BASE_INTERVAL_WAITING_MS;
      }
      return jittered(base);
    };

    async function tick() {
      if (!active || inFlight) return;
      // Pause while hidden: reschedule a check without touching the network.
      if (typeof document !== "undefined" && document.hidden) {
        schedule(MIN_INTERVAL_MS);
        return;
      }

      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(
          `/api/poll/${encodeURIComponent(pollId)}/status`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!active) return;
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as StatusResponse;
        if (!active) return;

        // Success: reset backoff, commit the last known state.
        errorStreak = 0;
        statusRef.current = data.status;
        closesAtRef.current = data.closesAt;
        setStatus(data.status);
        setOpensAt(data.opensAt);
        setClosesAt(data.closesAt);
        setReady(true);
      } catch {
        // NEVER surface to the UI. Grow the backoff and keep the last state.
        if (active) errorStreak += 1;
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (active) schedule(nextDelay());
      }
    }

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (!document.hidden && active && !inFlight && !terminal()) {
        // Returned to foreground: fire one immediate tick, then resume cadence.
        void tick();
      }
    };

    // Spread the FIRST request across the base interval so a room that scans the
    // QR together does not fire a synchronized burst from the venue's single NAT
    // IP (Vercel's DDoS mitigation would read a big same-IP spike as an attack).
    // The SSR snapshot already renders the correct initial state, so delaying the
    // first client poll costs no UX.
    schedule(Math.random() * BASE_INTERVAL_WAITING_MS);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      active = false;
      clearTimer();
      controller?.abort();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [pollId]);

  return { status, opensAt, closesAt, ready };
}
