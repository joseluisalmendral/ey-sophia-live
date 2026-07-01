"use client";

import { useEffect, useState } from "react";

/**
 * CountInTimer — the projector's PRE-VOTING count-in to a server `opensAt`.
 *
 * Renders a big, projector-legible "La votación abre en… MM:SS" derived PURELY
 * from the server `opensAt` timestamp (never a local accumulator), so a resumed
 * tab corrects itself instantly and every screen in the room agrees.
 *
 * Under 10s it pulses (EY-yellow) to build tension, and collapses to a giant
 * single number for the final seconds. Returns null when no future `opensAt` is
 * provided (nothing to count in to).
 */

export interface CountInTimerProps {
  /** Server ISO timestamp the poll opens at (a FUTURE time during countdown). */
  opensAt: string | null;
}

function remainingMs(opensAt: string): number {
  return Math.max(0, new Date(opensAt).getTime() - Date.now());
}

function format(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CountInTimer({ opensAt }: CountInTimerProps) {
  const [ms, setMs] = useState<number>(() =>
    opensAt ? remainingMs(opensAt) : 0,
  );

  useEffect(() => {
    if (!opensAt) return;
    const tick = () => setMs(remainingMs(opensAt));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [opensAt]);

  // Only render a count-in when there is a future open moment to count toward.
  if (!opensAt || ms <= 0) return null;

  const totalSec = Math.ceil(ms / 1000);
  const urgent = ms <= 10_000;
  // Final 10s: a single giant number owns the stage. Otherwise MM:SS.
  const display = urgent ? String(totalSec) : format(ms);

  return (
    <div className="flex flex-col items-center gap-[clamp(0.5rem,1.6vh,1.4rem)] text-center">
      <span className="font-display text-[clamp(0.9rem,1.6vw,1.5rem)] font-bold uppercase tracking-[0.28em] text-ey-yellow">
        La votación abre en
      </span>
      <span
        role="timer"
        aria-live="off"
        aria-label={`La votación abre en ${
          urgent ? `${totalSec} segundos` : format(ms)
        }`}
        className={[
          "font-display font-black tabular-nums leading-none tracking-tight text-text",
          urgent
            ? "text-[clamp(6rem,22vw,18rem)] text-ey-yellow animate-[countdownPulse_1s_ease-in-out_infinite]"
            : "text-[clamp(3.5rem,12vw,9rem)]",
        ].join(" ")}
        style={
          urgent
            ? { textShadow: "0 0 40px rgba(255,230,0,0.5)" }
            : undefined
        }
      >
        {display}
      </span>
    </div>
  );
}

export default CountInTimer;
