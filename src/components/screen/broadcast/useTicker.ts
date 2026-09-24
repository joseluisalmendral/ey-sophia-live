"use client";

import { useEffect, useState } from "react";

/**
 * useTicker — a display-only wall clock for broadcast chrome (live bug,
 * count-in). Ticks every `ms` while `active`; the value is only used to derive
 * remaining time from SERVER timestamps (opensAt/closesAt), never accumulated,
 * so a resumed tab corrects itself on the next tick.
 */
export function useTicker(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/** Remaining ms until an ISO timestamp (0 when past / null when absent). */
export function remainingUntil(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, t - now) : null;
}
