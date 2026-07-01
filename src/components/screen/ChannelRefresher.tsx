"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * ChannelRefresher — the invisible watcher that makes /tv/[slug] switch by
 * itself when the admin re-assigns the channel, with no manual reload.
 *
 * Mechanism (mirrors src/lib/polling/usePollStatus.ts, simplified for ONE
 * projector): a light poll of GET /api/channel/[slug] (CDN-cached, s-maxage=3)
 * every ~5s with ±30% jitter, paused while the tab is hidden, with per-request
 * timeout and capped exponential backoff on errors. When the assignment
 * fingerprint (pollId + updatedAt) differs from what the server rendered, it
 * calls router.refresh(): the server component re-resolves slug -> poll and the
 * screen remounts on the new poll (ScreenClient is keyed by poll id upstream).
 *
 * Renders nothing. Errors never surface — the projector keeps its last board.
 */

const BASE_INTERVAL_MS = 5000;
const MIN_INTERVAL_MS = 3000;
const JITTER_RATIO = 0.3;
const BACKOFF_MAX_MS = 30000;
const REQUEST_TIMEOUT_MS = 8000;

interface ChannelResponse {
  pollId: string | null;
  updatedAt: string;
}

/** Random interval in [base*(1-r), base*(1+r)], never below the hard floor. */
function jittered(base: number): number {
  const min = base * (1 - JITTER_RATIO);
  const max = base * (1 + JITTER_RATIO);
  return Math.max(MIN_INTERVAL_MS, min + Math.random() * (max - min));
}

export function ChannelRefresher({
  slug,
  pollId,
  updatedAt,
}: {
  slug: string;
  /** Poll currently rendered by the server (null = standby). */
  pollId: string | null;
  /** Channel row updated_at as rendered by the server. */
  updatedAt: string;
}) {
  const router = useRouter();

  // The server-rendered baseline. router.refresh() re-renders this component
  // with fresh props, so the refs track the latest committed assignment and a
  // refresh is only requested when the API reports something NEWER.
  const pollIdRef = useRef(pollId);
  const updatedAtRef = useRef(updatedAt);
  useEffect(() => {
    pollIdRef.current = pollId;
    updatedAtRef.current = updatedAt;
  }, [pollId, updatedAt]);

  // Fingerprint that already triggered a refresh. The API sits behind a CDN
  // (s-maxage), so after a refresh it can keep serving the SAME assignment for
  // a few seconds — or the server shell may not have resolved the poll the API
  // reports (pollId prop null). Remembering the acted-on fingerprint (plus the
  // strictly-newer updatedAt check below) guarantees one reassignment causes
  // exactly one refresh, never a loop.
  const refreshedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let inFlight = false;
    let errorStreak = 0;

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      if (!active) return;
      timer = setTimeout(tick, delay);
    };

    const nextDelay = () => {
      if (errorStreak > 0) {
        const backoff = Math.min(
          MIN_INTERVAL_MS * 2 ** (errorStreak - 1),
          BACKOFF_MAX_MS,
        );
        return jittered(backoff);
      }
      return jittered(BASE_INTERVAL_MS);
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
        const res = await fetch(`/api/channel/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!active) return;
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as ChannelResponse;
        if (!active) return;

        errorStreak = 0;
        // Refresh ONLY on an assignment strictly NEWER than the one the server
        // rendered ("newer than" on updated_at, not mere inequality — a stale
        // CDN echo of an older row must never re-trigger), and only once per
        // fingerprint (a repeated CDN response for the acted-on assignment, or
        // an assignment the server shell could not resolve, must not loop).
        const apiFingerprint = `${data.pollId ?? ""}|${data.updatedAt}`;
        const apiTs = new Date(data.updatedAt).getTime();
        const serverTs = new Date(updatedAtRef.current).getTime();
        const isNewer =
          Number.isFinite(apiTs) && Number.isFinite(serverTs) && apiTs > serverTs;
        if (isNewer && apiFingerprint !== refreshedFingerprintRef.current) {
          refreshedFingerprintRef.current = apiFingerprint;
          // Assignment changed: re-render the server shell with the new poll.
          router.refresh();
        }
      } catch {
        // Never surface to the projector; back off and keep the last board.
        if (active) errorStreak += 1;
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (active) schedule(nextDelay());
      }
    }

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (!document.hidden && active && !inFlight) void tick();
    };

    schedule(jittered(BASE_INTERVAL_MS));
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      controller?.abort();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [slug, router]);

  return null;
}

export default ChannelRefresher;
