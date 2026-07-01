"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { durations } from "@/lib/motion/tokens";
import type { RankedTeam } from "@/lib/types";

/**
 * NameTease — teaser beat 2: PART of the winner's name is revealed. Roughly
 * 45% of the letters lock in (deterministic mask, so every projector shows the
 * same hint); the rest keep cycling scrambled glyphs, slot-machine style, in
 * the winner's team color. On a double-crown tie both names tease, stacked.
 *
 * Reduced motion: no cycling interval — hidden letters render as a static "·".
 */

export interface NameTeaseProps {
  winners: RankedTeam[];
  reduced: boolean;
}

const GLYPHS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789#*+";

/** Deterministic ~45% reveal mask — same hint on every screen, no hydration drift. */
function isRevealed(index: number, nameLength: number): boolean {
  // Small names reveal fewer absolute letters but keep the mystery.
  return ((index * 7 + nameLength * 3 + 2) % 10) < 4.5;
}

function scrambleChar(seed: number): string {
  return GLYPHS[seed % GLYPHS.length] as string;
}

export function NameTease({ winners, reduced }: NameTeaseProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
      <motion.span
        initial={{ opacity: 0, y: reduced ? 0 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.base }}
        className="text-[clamp(0.9rem,1.4vw,1.3rem)] font-bold uppercase tracking-[0.4em] text-ey-yellow"
      >
        Segunda pista
      </motion.span>

      <div className="flex flex-col items-center gap-[clamp(0.8rem,2vh,1.6rem)]">
        {winners.slice(0, 2).map((team, row) => (
          <TeaseRow key={team.id} team={team} row={row} tick={tick} reduced={reduced} />
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: durations.slow }}
        className="text-[clamp(1rem,1.8vw,1.6rem)] font-medium text-text-dim"
      >
        {winners.length === 2 ? "¿Los reconocéis?" : "¿Lo reconocéis?"}
      </motion.p>
    </div>
  );
}

function TeaseRow({
  team,
  row,
  tick,
  reduced,
}: {
  team: RankedTeam;
  row: number;
  tick: number;
  reduced: boolean;
}) {
  const name = team.name.toUpperCase();
  const letters = useMemo(() => Array.from(name), [name]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: reduced ? 1 : 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: durations.slow, delay: 0.2 + row * 0.15 }}
      className="flex max-w-[92vw] flex-wrap items-center justify-center gap-x-[0.08em] gap-y-2 font-display text-[clamp(1.8rem,6vw,5.5rem)] font-black leading-none tracking-[0.06em]"
      aria-label="Pista del nombre del equipo ganador"
    >
      {letters.map((ch, i) => {
        if (ch === " ") return <span key={i} className="w-[0.5em]" aria-hidden />;
        const revealed = isRevealed(i, letters.length);
        if (revealed) {
          return (
            <span
              key={i}
              className="text-text"
              style={{ textShadow: `0 0 26px color-mix(in srgb, ${team.color} 65%, transparent)` }}
            >
              {ch}
            </span>
          );
        }
        return (
          <span
            key={i}
            aria-hidden
            className="inline-block"
            style={{ color: team.color, opacity: reduced ? 0.5 : 0.75 }}
          >
            {reduced ? "·" : scrambleChar(tick * 31 + i * 13 + row * 7)}
          </span>
        );
      })}
    </motion.div>
  );
}

export default NameTease;
