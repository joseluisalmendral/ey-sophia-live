"use client";

import { useEffect, useState } from "react";

/**
 * CountdownTimer — renders MM:SS derived PURELY from a server `closesAt`
 * timestamp. The local ticker is display only: every render re-derives the
 * remaining time from `closesAt`, so a backgrounded/resumed tab corrects itself
 * instantly (the browser clock is never the authority — the server is).
 *
 * Under 10 seconds the timer pulses (EY-yellow) to build tension. At/below zero
 * it clamps to 00:00 and stops. Returns null when no `closesAt` is provided
 * (no duration configured).
 */

export interface CountdownTimerProps {
  /** Server ISO timestamp the poll closes at, or null when no duration set. */
  closesAt: string | null;
  size?: "hero" | "chip";
  className?: string;
}

function remainingMs(closesAt: string): number {
  return Math.max(0, new Date(closesAt).getTime() - Date.now());
}

function format(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CountdownTimer({
  closesAt,
  size = "chip",
  className,
}: CountdownTimerProps) {
  const [ms, setMs] = useState<number>(() =>
    closesAt ? remainingMs(closesAt) : 0,
  );

  useEffect(() => {
    if (!closesAt) return;
    // Re-derive from the server timestamp each tick (never accumulate locally).
    const tick = () => setMs(remainingMs(closesAt));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [closesAt]);

  if (!closesAt) return null;

  const urgent = ms <= 10_000 && ms > 0;
  const isHero = size === "hero";

  return (
    <span
      role="timer"
      aria-live={urgent ? "assertive" : "off"}
      aria-label={`Tiempo restante ${format(ms)}`}
      className={[
        "inline-flex items-center gap-1.5 rounded-pill font-display font-extrabold tabular-nums tracking-tight",
        isHero
          ? "px-5 py-2 text-display"
          : "border border-white/12 bg-cosmic-700/60 px-3 py-1 text-h3",
        urgent ? "text-ey-yellow" : "text-text",
        urgent ? "animate-[countdownPulse_1s_ease-in-out_infinite]" : "",
        className ?? "",
      ].join(" ")}
      style={
        urgent
          ? { textShadow: "0 0 20px rgba(255,230,0,0.45)" }
          : undefined
      }
    >
      {format(ms)}
    </span>
  );
}

export default CountdownTimer;
