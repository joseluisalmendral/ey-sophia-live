"use client";

import { motion } from "motion/react";
import { durations } from "@/lib/motion/tokens";
import type { RankedTeam } from "@/lib/types";

/**
 * ColorHint — teaser beat 1: the winner's color blooms across the dark stage
 * before the name is known. On a double-crown tie both colors bloom, one from
 * each side. The color is the ONLY information leaked here — no names, no
 * numbers — so the room starts guessing.
 *
 * Reduced motion: a single static wash of the color(s), no pulse loop.
 */

export interface ColorHintProps {
  winners: RankedTeam[];
  reduced: boolean;
}

export function ColorHint({ winners, reduced }: ColorHintProps) {
  const colors = winners.slice(0, 2).map((w) => w.color);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 overflow-hidden text-center">
      {/* Color blooms behind the copy */}
      {colors.map((color, i) => (
        <motion.div
          key={`${color}-${i}`}
          aria-hidden
          className="pointer-events-none absolute rounded-full blur-3xl"
          style={{
            width: "70vmin",
            height: "70vmin",
            left: colors.length === 2 ? (i === 0 ? "8%" : "auto") : "50%",
            right: colors.length === 2 && i === 1 ? "8%" : "auto",
            top: "50%",
            translate: colors.length === 2 ? "0 -50%" : "-50% -50%",
            background: `radial-gradient(circle, color-mix(in srgb, ${color} 55%, transparent) 0%, transparent 68%)`,
          }}
          initial={{ opacity: 0, scale: reduced ? 1 : 0.4 }}
          animate={
            reduced
              ? { opacity: 0.8, scale: 1 }
              : { opacity: [0, 0.95, 0.55, 1], scale: [0.4, 1.05, 0.92, 1.1] }
          }
          transition={
            reduced
              ? { duration: durations.slow }
              : { duration: 2.4, times: [0, 0.35, 0.6, 1], ease: "easeInOut", delay: i * 0.25 }
          }
        />
      ))}

      <motion.span
        initial={{ opacity: 0, y: reduced ? 0 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.base }}
        className="relative z-10 text-[clamp(0.9rem,1.4vw,1.3rem)] font-bold uppercase tracking-[0.4em] text-ey-yellow"
      >
        Primera pista
      </motion.span>

      <motion.h2
        initial={{ opacity: 0, y: reduced ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.slow, delay: 0.15 }}
        className="relative z-10 max-w-5xl text-balance font-display text-[clamp(2rem,5.5vw,5rem)] font-black leading-tight text-text"
      >
        {colors.length === 2 ? "Dos colores iluminan la sala…" : "Su color ya ilumina la sala…"}
      </motion.h2>
    </div>
  );
}

export default ColorHint;
