"use client";

import { useSyncExternalStore } from "react";

/**
 * useReducedMotionPref — SSR-safe `prefers-reduced-motion` reader built on
 * `useSyncExternalStore` (no setState-in-effect, no hydration flash).
 *
 * Returns false on the server snapshot (rich path is the default for the common
 * case), then the real OS preference on the client, staying live to changes.
 * Components use this to swap scale/burst/heavy motion for crossfades and to
 * disable haptics/rewards/confetti.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
