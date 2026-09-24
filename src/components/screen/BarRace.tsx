"use client";

import { memo, useState } from "react";
import { motion } from "motion/react";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { springs } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import { chipRem } from "./broadcast/chipRem";
import { adaptiveBarWidthPct } from "./chartScale";
import { teamInitials } from "./anonymize";
import type { RankedTeam } from "@/lib/types";

/**
 * BarRace — the continuous LIVE bar race (the projector differentiator).
 *
 * Bars are styled divs, NOT a chart library, for full brand control + 60fps:
 *  - REORDER is Motion `layout` (FLIP) on the honest `springs.reorder`
 *    (≈650 ms, no overshoot): rows move by GPU transform, never top/height.
 *  - LENGTH is a `scaleX` on the fill (transform, compositor-only) driven by
 *    the honest `springs.barWidthHonest` (zero overshoot: a bar never shows
 *    more than it has). The leader pins at 100%, everyone races relative to it.
 *  - Every bar is ALWAYS painted with its own team color; the leader is
 *    highlighted by ACCENTS only (full-saturation fill, glow, yellow count).
 *
 * Broadcast dressing (E6): rank medals (gold/silver/bronze discs, a neutral
 * disc from 4th on or while a team has no votes; a pop when a team CLIMBS,
 * never when it drops), glass (flat) tracks and right-aligned tabular
 * numerals. Medals are allowed on anonymous runs: a rank is not an identity.
 * The team name lives on its own layer above the fill (not inside it), so the
 * scaled fill never distorts the type.
 *
 * Reduced motion: layout reorders still apply but the global CSS collapses
 * them; the fill uses a short tween instead of a spring; no medal pop.
 */

export interface BarRaceProps {
  teams: RankedTeam[];
  showNames: boolean;
  reduced: boolean;
  /** Dim + desaturate for the reveal freeze beat. */
  frozen?: boolean;
}

const MEDAL: Record<number, { bg: string; ink: string; glow: string }> = {
  1: { bg: "#FFE600", ink: "#1a1a24", glow: "0 0 22px rgb(255 230 0 / 0.55)" },
  2: { bg: "#c4c4cd", ink: "#1a1a24", glow: "0 0 16px rgb(196 196 205 / 0.35)" },
  3: { bg: "#d08a4e", ink: "#1a1a24", glow: "0 0 16px rgb(208 138 78 / 0.35)" },
};

export const BarRace = memo(function BarRace({
  teams,
  showNames,
  reduced,
  frozen = false,
}: BarRaceProps) {
  const counts = teams.map((t) => t.count);
  const names = teams.map((t) => t.name);
  const leaderCount = counts.length ? Math.max(...counts) : 0;
  const trailerCount = counts.length ? Math.min(...counts) : 0;
  const totalCount = counts.reduce((s, c) => s + c, 0);
  const n = teams.length;
  const dense = n >= 5;
  const rowH = n <= 3 ? "h-[clamp(3.2rem,8.6vh,6.6rem)]" : n === 4 ? "h-[clamp(3rem,7.2vh,5.6rem)]" : "h-[clamp(2.6rem,6vh,4.8rem)]";
  const medalPx = n <= 3 ? "clamp(2.8rem,3.6vw,4.4rem)" : "clamp(2.4rem,3vw,3.6rem)";

  return (
    <ul
      className={[
        "flex w-full flex-col justify-center",
        dense ? "gap-[clamp(0.45rem,1.2vh,0.9rem)]" : "gap-[clamp(0.6rem,1.8vh,1.4rem)]",
      ].join(" ")}
      style={{ opacity: frozen ? 0.5 : 1, transition: "opacity 320ms ease" }}
      data-mascot-keepout="chart"
    >
      {teams.map((team) => {
        const isLeader = team.rank === 1 && team.count > 0;
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
            transition={reduced ? { duration: 0.2 } : springs.reorder}
            className="relative"
            data-rank={team.rank}
          >
            <div className="flex items-center gap-[clamp(0.6rem,1.2vw,1.2rem)]">
              <RankMedal rank={team.rank} active={team.count > 0} size={medalPx} reduced={reduced} />

              {/* Track (flat glass) + scaled fill + name layer */}
              <div
                className={`glass glass--flat relative ${rowH} min-w-0 flex-1 overflow-hidden`}
                style={{ borderRadius: "0.9rem" }}
              >
                <motion.div
                  className="absolute inset-0 origin-left"
                  initial={false}
                  animate={{ scaleX: pct / 100 }}
                  transition={reduced ? { duration: 0.25, ease: "easeOut" } : springs.barWidthHonest}
                  style={{
                    borderRadius: "0.9rem",
                    willChange: "transform",
                    background: isLeader
                      ? `linear-gradient(90deg, color-mix(in srgb, ${team.color} 85%, #ffffff) 0%, ${team.color} 100%)`
                      : `linear-gradient(90deg, color-mix(in srgb, ${team.color} 55%, var(--color-cosmic-700)) 0%, color-mix(in srgb, ${team.color} 30%, var(--color-cosmic-700)) 100%)`,
                    boxShadow: isLeader ? "var(--shadow-glow-win)" : undefined,
                  }}
                />
                {/* Identity layer: on anonymous runs the name is empty, the
                    chip collapses to a plain grey dot and no label renders. */}
                <span className="relative z-[1] flex h-full min-w-0 items-center gap-[clamp(0.5rem,0.9vw,0.9rem)] pl-[clamp(0.7rem,1.2vw,1.2rem)] pr-3">
                  <TeamColorChip
                    color={team.color}
                    label={teamInitials(team.name, names) || undefined}
                    size={dense ? 30 : 36}
                    style={chipRem(dense ? 1.875 : 2.25, teamInitials(team.name, names))}
                  />
                  {showNames && team.name && (
                    <span
                      className={[
                        "min-w-0 truncate font-display font-extrabold leading-tight",
                        dense ? "text-[clamp(1.2rem,2.1vw,2.5rem)]" : "text-proj-h2",
                      ].join(" ")}
                      style={{
                        color: isLeader ? fg : "var(--color-text)",
                        textShadow: isLeader ? "none" : "0 1px 8px rgba(0,0,0,0.6)",
                      }}
                    >
                      {team.name}
                    </span>
                  )}
                </span>
              </div>

              {/* Count (+ %), right-aligned tabular numerals, outside the bar. */}
              <div
                className={[
                  "flex shrink-0 items-end justify-end leading-none",
                  dense ? "w-[clamp(7rem,12vw,13rem)] flex-row items-center gap-[0.5em]" : "w-[clamp(6rem,11vw,12rem)] flex-col",
                ].join(" ")}
              >
                {dense && team.percentage !== null && (
                  <span className="font-display text-proj-label font-bold tabular-nums text-text-dim">
                    {team.percentage}%
                  </span>
                )}
                <span
                  className={[
                    "font-display font-black tabular-nums",
                    dense ? "text-[clamp(2rem,3.4vw,4rem)]" : "text-proj-number",
                  ].join(" ")}
                  style={{
                    color: isLeader ? "var(--color-ey-yellow)" : "var(--color-text)",
                    textShadow: isLeader ? "0 0 24px rgba(255,230,0,0.4)" : undefined,
                    transition: "color 300ms ease",
                  }}
                >
                  <CountUp
                    value={team.count}
                    aria-label={team.name ? `${team.name}: ${team.count} votos` : `${team.count} votos`}
                  />
                </span>
                {!dense && team.percentage !== null && (
                  <span className="mt-1 font-display text-proj-label font-bold tabular-nums text-text-dim">
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

/**
 * RankMedal — gold/silver/bronze disc for ranks 1–3 (neutral ring from 4th
 * on, or while the team has no votes). Pops only when the rank IMPROVES.
 */
function RankMedal({
  rank,
  active,
  size,
  reduced,
}: {
  rank: number;
  active: boolean;
  size: string;
  reduced: boolean;
}) {
  // Derived "climbed" pulse without effects: remember the previous rank.
  const [prev, setPrev] = useState(rank);
  const [pops, setPops] = useState(0);
  if (rank !== prev) {
    setPrev(rank);
    if (rank < prev && active) setPops(pops + 1);
  }
  const medal = active ? MEDAL[rank] : undefined;
  return (
    <motion.span
      key={pops}
      initial={reduced || pops === 0 ? false : { scale: 1.28 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 16 }}
      className="flex shrink-0 items-center justify-center rounded-full font-display font-black leading-none tabular-nums"
      style={{
        width: size,
        height: size,
        fontSize: `calc(${size} * 0.5)`,
        background: medal ? medal.bg : "rgb(255 255 255 / 0.05)",
        color: medal ? medal.ink : "var(--color-text-dim)",
        boxShadow: medal ? `${medal.glow}, inset 0 -3px 0 rgb(0 0 0 / 0.18), inset 0 2px 0 rgb(255 255 255 / 0.45)` : "inset 0 0 0 2px rgb(255 255 255 / 0.18)",
      }}
      aria-hidden
    >
      {rank}
    </motion.span>
  );
}

export default BarRace;
