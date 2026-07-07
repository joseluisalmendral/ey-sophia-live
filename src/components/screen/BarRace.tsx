"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { springs } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import { adaptiveBarWidthPct } from "./chartScale";
import { teamInitial } from "./anonymize";
import type { RankedTeam } from "@/lib/types";

/**
 * BarRace — the continuous LIVE bar race (the projector differentiator).
 *
 * Bars are styled divs, NOT a chart library, for full brand control + 60fps:
 *  - REORDER is Motion `layout` (FLIP): when ranks swap, rows animate via GPU
 *    transform, never by animating top/height. This is the smooth "race" feel.
 *  - WIDTH is a spring on the ABSOLUTE value as a % of the current leader's
 *    count, so the leader pins at 100% and everyone races relative to them.
 *  - Every bar is ALWAYS painted with its own team color (a team named "Azul"
 *    must look blue even while leading). The leader is highlighted by ACCENTS
 *    only: a full-saturation fill, the glow-win shadow, and yellow rank/count
 *    text — never by swapping the bar color to EY yellow.
 *
 * Counts show immediately (CountUp). Percentages are whole-number and only once
 * meaningful — `RankedTeam.percentage` is null until then (handled upstream),
 * so we never print "67%" at 3 votes.
 *
 * Reduced motion: `layout` reorders still apply but the global CSS collapses
 * their duration; widths use a plain transition instead of a spring.
 */

export interface BarRaceProps {
  teams: RankedTeam[];
  showNames: boolean;
  reduced: boolean;
  /** Dim + desaturate for the reveal freeze beat. */
  frozen?: boolean;
}

export const BarRace = memo(function BarRace({
  teams,
  showNames,
  reduced,
  frozen = false,
}: BarRaceProps) {
  // Adaptive scale inputs: the leader pins at 100, and the field's real spread
  // [trailer, leader] is stretched into the visible band (confidence-blended by
  // total votes) so a tight race READS as tight and a blowout READS as a blowout.
  const counts = teams.map((t) => t.count);
  const leaderCount = counts.length ? Math.max(...counts) : 0;
  const trailerCount = counts.length ? Math.min(...counts) : 0;
  const totalCount = counts.reduce((s, c) => s + c, 0);

  return (
    <ul
      className="flex w-full flex-col justify-center gap-[clamp(0.5rem,1.4vh,1.1rem)]"
      style={{ opacity: frozen ? 0.5 : 1, transition: "opacity 320ms ease" }}
    >
      {teams.map((team) => {
        const isLeader = team.rank === 1 && team.count > 0;
        // Adaptive width: honest near-empty, dramatic once the room is real.
        const pct = adaptiveBarWidthPct({
          count: team.count,
          leader: leaderCount,
          trailer: trailerCount,
          total: totalCount,
        });
        const fg = pickTextOn(team.color);

        return (
          <motion.li
            key={team.id}
            layout
            transition={reduced ? { duration: 0.2 } : springs.podiumRise}
            className="relative"
          >
            <div className="flex items-center gap-[clamp(0.5rem,1.2vw,1rem)]">
              {/* Rank pill */}
              <span
                className="flex w-[clamp(2.6rem,3.6vw,3.9rem)] shrink-0 items-center justify-center font-display text-[clamp(1.3rem,2.4vw,2.5rem)] font-black tabular-nums"
                style={{ color: isLeader ? "var(--color-ey-yellow)" : "var(--color-text-dim)" }}
                aria-hidden
              >
                {team.rank}
              </span>

              {/* The bar track + fill */}
              <div className="relative h-[clamp(2.6rem,5.6vh,4.6rem)] flex-1 overflow-hidden rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
                <motion.div
                  className="absolute inset-y-0 left-0 flex items-center rounded-md"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={
                    reduced
                      ? { duration: 0.25, ease: "easeOut" }
                      : springs.barWidth
                  }
                  style={
                    isLeader
                      ? {
                          // Full-saturation team color + glow: the leader pops
                          // without losing its identity color.
                          background: `linear-gradient(90deg, color-mix(in srgb, ${team.color} 85%, #ffffff) 0%, ${team.color} 100%)`,
                          boxShadow: "var(--shadow-glow-win)",
                        }
                      : {
                          background: `linear-gradient(90deg, color-mix(in srgb, ${team.color} 55%, var(--color-cosmic-700)) 0%, color-mix(in srgb, ${team.color} 30%, var(--color-cosmic-700)) 100%)`,
                        }
                  }
                >
                  {/* Team identity inside the bar (legible via pickTextOn for
                      leader). On anonymous runs the name is empty: the chip
                      renders as a plain color dot (no initial) and the name
                      span is skipped entirely, giving the bar the full width. */}
                  <span className="flex min-w-0 items-center gap-[clamp(0.4rem,0.9vw,0.8rem)] pl-[clamp(0.6rem,1.2vw,1.1rem)]">
                    <TeamColorChip
                      color={team.color}
                      label={teamInitial(team.name) || undefined}
                      size={28}
                    />
                    {showNames && team.name && (
                      <span
                        className="truncate font-display text-[clamp(1.2rem,2.4vw,2.5rem)] font-extrabold"
                        style={{
                          color: isLeader ? fg : "var(--color-text)",
                          textShadow: isLeader
                            ? "none"
                            : "0 1px 8px rgba(0,0,0,0.6)",
                        }}
                      >
                        {team.name}
                      </span>
                    )}
                  </span>
                </motion.div>
              </div>

              {/* Count + (optional) percentage, outside the bar so it never clips. */}
              <div className="flex w-[clamp(5.5rem,10.5vw,10.5rem)] shrink-0 flex-col items-end leading-none">
                <span
                  className="font-display text-[clamp(1.7rem,3.4vw,3.7rem)] font-black tabular-nums"
                  style={{
                    color: isLeader ? "var(--color-ey-yellow)" : "var(--color-text)",
                    textShadow: isLeader
                      ? "0 0 24px rgba(255,230,0,0.4)"
                      : undefined,
                  }}
                >
                  <CountUp
                    value={team.count}
                    aria-label={
                      team.name
                        ? `${team.name}: ${team.count} votos`
                        : `${team.count} votos`
                    }
                  />
                </span>
                {team.percentage !== null && (
                  <span className="text-[clamp(0.9rem,1.4vw,1.45rem)] font-semibold tabular-nums text-text-dim">
                    {team.percentage}%
                  </span>
                )}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
});

export default BarRace;
