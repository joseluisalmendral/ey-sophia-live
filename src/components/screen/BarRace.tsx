"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { springs } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import type { RankedTeam } from "@/lib/types";

/**
 * BarRace — the continuous LIVE bar race (the projector differentiator).
 *
 * Bars are styled divs, NOT a chart library, for full brand control + 60fps:
 *  - REORDER is Motion `layout` (FLIP): when ranks swap, rows animate via GPU
 *    transform, never by animating top/height. This is the smooth "race" feel.
 *  - WIDTH is a spring on the ABSOLUTE value as a % of the current leader's
 *    count, so the leader pins at 100% and everyone races relative to them.
 *  - The leader bar is EY-yellow with the glow-win shadow (the single highlight);
 *    everyone else is a cosmic-tinted track with a thin team-color spine so each
 *    team keeps its identity without competing with the yellow.
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
  const leaderCount = teams[0]?.count ?? 0;

  return (
    <ul
      className="flex w-full flex-col justify-center gap-[clamp(0.5rem,1.4vh,1.1rem)]"
      style={{ opacity: frozen ? 0.5 : 1, transition: "opacity 320ms ease" }}
    >
      {teams.map((team) => {
        const isLeader = team.rank === 1 && team.count > 0;
        // Width relative to the leader; min sliver so a team at 0 still reads.
        const pct =
          leaderCount > 0 ? Math.max((team.count / leaderCount) * 100, 2.5) : 2.5;
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
                className="flex w-[clamp(2.2rem,3vw,3.2rem)] shrink-0 items-center justify-center font-display text-[clamp(1.1rem,1.9vw,1.9rem)] font-black tabular-nums"
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
                          background:
                            "linear-gradient(90deg, color-mix(in srgb, var(--color-ey-yellow) 80%, #ffffff) 0%, var(--color-ey-yellow) 100%)",
                          boxShadow: "var(--shadow-glow-win)",
                        }
                      : {
                          background: `linear-gradient(90deg, color-mix(in srgb, ${team.color} 55%, var(--color-cosmic-700)) 0%, color-mix(in srgb, ${team.color} 30%, var(--color-cosmic-700)) 100%)`,
                        }
                  }
                >
                  {/* Team identity inside the bar (legible via pickTextOn for leader). */}
                  <span className="flex min-w-0 items-center gap-[clamp(0.4rem,0.9vw,0.8rem)] pl-[clamp(0.6rem,1.2vw,1.1rem)]">
                    <TeamColorChip
                      color={isLeader ? "#FFE600" : team.color}
                      label={team.name.charAt(0).toUpperCase()}
                      size={28}
                    />
                    {showNames && (
                      <span
                        className="truncate font-display text-[clamp(1rem,1.9vw,1.9rem)] font-extrabold"
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
              <div className="flex w-[clamp(4.5rem,9vw,9rem)] shrink-0 flex-col items-end leading-none">
                <span
                  className="font-display text-[clamp(1.3rem,2.6vw,2.8rem)] font-black tabular-nums"
                  style={{
                    color: isLeader ? "var(--color-ey-yellow)" : "var(--color-text)",
                    textShadow: isLeader
                      ? "0 0 24px rgba(255,230,0,0.4)"
                      : undefined,
                  }}
                >
                  <CountUp value={team.count} aria-label={`${team.name}: ${team.count} votos`} />
                </span>
                {team.percentage !== null && (
                  <span className="text-[clamp(0.7rem,1.1vw,1.05rem)] font-semibold tabular-nums text-text-dim">
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
