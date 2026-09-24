"use client";

import { useEffect, useRef, useState } from "react";
import type { MascotConfig } from "@/components/mascot/MascotHost";

/**
 * useAssistantConfig — projector-only live Broqui config via HTTP polling.
 *
 * Mirrors ChannelRefresher's cadence/robustness (base 5s, ±30% jitter, paused
 * while hidden, capped backoff on errors) but returns STATE instead of calling
 * router.refresh(): MascotHost's `config` prop just needs {enabled,min,max} to
 * update, no server re-render. This is how the admin's Live Control "Broqui en
 * pantalla" switch and the config form's min/max settings reach the projector
 * without a reload and without a new realtime subscription.
 *
 * MOUNT ONLY IN ScreenClient (projector). Phones must never call this endpoint
 * — they read `assistantEnabled` once at SSR (see /vote/[poll]/page.tsx).
 */

const BASE_INTERVAL_MS = 5000;
const MIN_INTERVAL_MS = 3000;
const JITTER_RATIO = 0.3;
const BACKOFF_MAX_MS = 30000;
const REQUEST_TIMEOUT_MS = 8000;

interface AssistantResponse {
  enabled?: boolean;
  min?: number;
  max?: number;
  updatedAt?: string;
}

/** Random interval in [base*(1-r), base*(1+r)], never below the hard floor. */
function jittered(base: number): number {
  const min = base * (1 - JITTER_RATIO);
  const max = base * (1 + JITTER_RATIO);
  return Math.max(MIN_INTERVAL_MS, min + Math.random() * (max - min));
}

/**
 * @param pollId poll to poll config for.
 * @param initial SSR-resolved config (from the poll row already loaded by
 * ScreenClient) — rendered immediately, before the first client poll lands.
 */
export function useAssistantConfig(
  pollId: string,
  initial: MascotConfig,
): MascotConfig {
  const [config, setConfig] = useState<MascotConfig>(initial);

  // If the SSR snapshot changes (poll id / initial values from a fresh page
  // load — e.g. /tv/[slug] switching polls), resync the baseline once.
  const pollIdRef = useRef(pollId);
  useEffect(() => {
    if (pollIdRef.current !== pollId) {
      pollIdRef.current = pollId;
      setConfig(initial);
    }
    // Only re-baseline on an actual poll change — `initial` is a fresh object
    // every render and must not fight the live polled value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId]);

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
        const res = await fetch(
          `/api/poll/${encodeURIComponent(pollId)}/assistant`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!active) return;
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as AssistantResponse;
        if (!active) return;
        errorStreak = 0;
        if (typeof data.enabled === "boolean") {
          setConfig({
            enabled: data.enabled,
            min: typeof data.min === "number" ? data.min : undefined,
            max: typeof data.max === "number" ? data.max : undefined,
          });
        }
      } catch {
        // Keep the last known config; the next tick retries (with backoff).
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
  }, [pollId]);

  return config;
}

export default useAssistantConfig;
