"use client";

import { memo, useState } from "react";
import { motion } from "motion/react";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { springs, durations } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import { Crown } from "./Crown";
import { chipRem } from "./broadcast/chipRem";
import type { RankedTeam } from "@/lib/types";
import type { RevealOutcome } from "./winner";

/**
 * Podium — the Olympic-asymmetry winner stage.
 *
 * Layout order on screen is [2nd LEFT, 1st CENTER, 3rd RIGHT] with the 1st block
 * tallest and centered. Blocks rise from the floor via the podiumRise spring
 * (animating HEIGHT here is correct — these are entrances, not the live race
 * which never animates height). The winner score SLAMS in with the slam spring.
 *
 * Winner(s) wear a crown. DOUBLE CROWN (tie_rule double_crown and the top two
 * tied): the two co-winners stand side by side on equal tall plinths (each
 * shown ONCE, both "1º"), and the next team keeps its real place (competition
 * rank, e.g. 3º) on the short plinth to the right — nobody is duplicated or
 * dropped. Every plinth is painted with its OWN team color — the winner gets a
 * full-saturation fill plus accents (crown, glow-win shadow, yellow name),
 * never a bar-color swap to EY yellow.
 *
 * Names never collide: each block is a fixed-width column and the name wraps
 * inside it (≤ 2 balanced lines, ellipsis beyond), with a smaller size for
 * long names and for the shared double-crown pair.
 *
 * Reduced motion: blocks fade/scale in place, crown is static (handled in Crown),
 * CountUp uses NumberFlow's built-in reduced-motion.
 */

export interface PodiumProps {
  outcome: RevealOutcome;
  reduced: boolean;
}

// Relative heights for the asymmetric plinths (vh-driven).
const HEIGHTS = { first: 54, second: 40, third: 30 } as const;

export const Podium = memo(function Podium({ outcome, reduced }: PodiumProps) {
  const [first, second, third] = outcome.podium;
  const winnerIds = new Set(outcome.winners.map((w) => w.id));

  return (
    <div className="flex h-full w-full flex-col items-center justify-end gap-[clamp(1rem,3vh,2.5rem)] px-[clamp(1.5rem,4vw,4rem)] pb-[clamp(1.5rem,5vh,3.5rem)]">
      {outcome.doubleCrown && first && second ? (
        // Double crown: [co-winner A][co-winner B] share the top step, the next
        // team keeps its real (competition) place on the right.
        <div className="flex w-full max-w-[94rem] items-end justify-center gap-[clamp(1rem,2.4vw,3rem)]">
          <div className="flex items-end gap-[clamp(0.6rem,1.2vw,1.4rem)]">
            <PodiumBlock team={first} place={1} heightVh={HEIGHTS.first} isWinner reduced={reduced} delay={0} crownLabel="EMPATE" compact />
            <PodiumBlock team={second} place={1} heightVh={HEIGHTS.first} isWinner reduced={reduced} delay={0.12} crownLabel="EMPATE" compact />
          </div>
          {third && (
            <PodiumBlock
              team={third}
              place={placeOf(third.rank, 3)}
              heightVh={HEIGHTS.third}
              isWinner={false}
              reduced={reduced}
              delay={0.3}
              compact
            />
          )}
        </div>
      ) : (
        <div className="flex w-full max-w-[94rem] items-end justify-center gap-[clamp(1rem,3vw,3.5rem)]">
          {/* 2nd — LEFT */}
          {second && (
            <PodiumBlock
              team={second}
              place={2}
              heightVh={HEIGHTS.second}
              isWinner={winnerIds.has(second.id)}
              reduced={reduced}
              delay={0.15}
            />
          )}
          {/* 1st — CENTER (tallest) */}
          {first && (
            <PodiumBlock
              team={first}
              place={1}
              heightVh={HEIGHTS.first}
              isWinner={winnerIds.has(first.id)}
              reduced={reduced}
              delay={0}
            />
          )}
          {/* 3rd — RIGHT */}
          {third && (
            <PodiumBlock
              team={third}
              place={3}
              heightVh={HEIGHTS.third}
              isWinner={false}
              reduced={reduced}
              delay={0.3}
            />
          )}
        </div>
      )}
    </div>
  );
});

/** Displayed place: the team's competition rank when it is a podium step. */
function placeOf(rank: number, fallback: 1 | 2 | 3): 1 | 2 | 3 {
  return rank === 1 || rank === 2 || rank === 3 ? rank : fallback;
}

/**
 * Name size: a length tier (long names drop a step or two so they fit in two
 * balanced lines) capped so the LONGEST WORD always fits the column width —
 * the winner's name is never cut or broken mid-word.
 */
function nameSize(name: string, isWinner: boolean, compact: boolean): string {
  const tier = name.length > 24 ? 2 : name.length > 16 ? 1 : 0;
  const sizes = isWinner
    ? compact
      ? ["clamp(1.7rem,3vw,3.6rem)", "clamp(1.5rem,2.5vw,3rem)", "clamp(1.3rem,2.1vw,2.5rem)"]
      : ["clamp(1.8rem,4vw,4.2rem)", "clamp(1.7rem,3vw,3.6rem)", "clamp(1.5rem,2.3vw,2.8rem)"]
    : ["clamp(1.3rem,2.6vw,2.8rem)", "clamp(1.2rem,2vw,2.4rem)", "clamp(1.1rem,1.7vw,2rem)"];
  // Longest word in em (Overpass 900: capitals/digits ~0.76 em, lowercase
  // ~0.6 em), so "AMARILLO" never breaks mid-word.
  const longestWord = Math.max(
    2.4,
    ...name.split(/\s+/).map((w) =>
      [...w].reduce((sum, ch) => sum + (ch !== ch.toLowerCase() || /\d/.test(ch) ? 0.76 : 0.6), 0),
    ),
  );
  const column = compact ? "min(20vw, 21rem)" : "min(24vw, 21rem)";
  return `min(${sizes[tier]}, calc((${column} - 0.75rem) / ${longestWord.toFixed(2)}))`;
}

function PodiumBlock({
  team,
  place,
  heightVh,
  isWinner,
  reduced,
  delay,
  crownLabel,
  compact = false,
}: {
  team: RankedTeam;
  place: 1 | 2 | 3;
  heightVh: number;
  isWinner: boolean;
  reduced: boolean;
  delay: number;
  crownLabel?: string;
  /** Three-across double-crown row: slightly narrower columns + type. */
  compact?: boolean;
}) {
  // Projector root scale (ScreenStage grows the root font above 1080p); the
  // crown takes px, so it is scaled by the same factor. Client-only mount.
  const [rootK] = useState(() =>
    typeof window === "undefined"
      ? 1
      : Math.max(1, parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1),
  );
  // Text inside the plinth contrasts against the team's real color (the winner
  // plinth is full-saturation team color, so contrast runs on that).
  const fg = pickTextOn(team.color);
  const plinthBg = isWinner
    ? `linear-gradient(180deg, color-mix(in srgb, ${team.color} 88%, #fff) 0%, ${team.color} 100%)`
    : `linear-gradient(180deg, color-mix(in srgb, ${team.color} 45%, var(--color-cosmic-700)) 0%, color-mix(in srgb, ${team.color} 22%, var(--color-cosmic-700)) 100%)`;

  return (
    <div
      className={[
        "flex shrink-0 flex-col items-center",
        // Widths stay capped (21rem): the podium must leave both side margins
        // free for the co-host anchors (podium-left / podium-right).
        compact ? "w-[clamp(9rem,20vw,21rem)]" : "w-[clamp(9rem,24vw,21rem)]",
      ].join(" ")}
    >
      {/* Crown, identity and plinth each carry their REAL rendered bounds as
          mascot keep-outs (a long name overflows this column on purpose). */}
      <div
        className="flex h-[clamp(5.5rem,14vh,9.5rem)] items-end justify-center"
        data-mascot-keepout="podium-crown"
      >
        {isWinner && (
          <div className="flex flex-col items-center">
            <Crown size={Math.round((reduced ? 92 : 128) * rootK)} delay={delay + 0.4} reduced={reduced} />
            {crownLabel && (
              <span className="mt-1 rounded-pill bg-ey-yellow px-3 py-0.5 font-display text-[clamp(0.7rem,1vw,0.95rem)] font-black uppercase tracking-[0.15em] text-ey-confident">
                {crownLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Team identity */}
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.5, duration: durations.base }}
        className="mb-2 flex w-full flex-col items-center gap-1.5 text-center"
        data-mascot-keepout="podium-name"
      >
        <TeamColorChip
          color={team.color}
          label={team.name.charAt(0).toUpperCase()}
          size={isWinner ? 68 : 52}
          style={chipRem(isWinner ? 4.25 : 3.25)}
        />
        <span
          className="line-clamp-3 w-full break-words px-1 font-display font-black leading-[1.05]"
          style={{
            fontSize: nameSize(team.name, isWinner, compact),
            color: isWinner ? "var(--color-ey-yellow)" : "var(--color-text)",
            textShadow: isWinner ? "0 0 28px rgba(255,230,0,0.4)" : undefined,
            textWrap: "balance",
          }}
        >
          {team.name}
        </span>
      </motion.div>

      {/* The rising plinth */}
      <motion.div
        initial={reduced ? { opacity: 0, height: `${heightVh}vh` } : { height: 0 }}
        animate={{ opacity: 1, height: `${heightVh}vh` }}
        transition={reduced ? { duration: durations.base } : { ...springs.podiumRise, delay }}
        className="relative flex w-full items-start justify-center overflow-hidden rounded-t-xl"
        data-mascot-keepout="podium-plinth"
        style={{
          background: plinthBg,
          boxShadow: isWinner ? "var(--shadow-glow-win)" : "var(--shadow-e2)",
        }}
      >
        <div className="flex flex-col items-center gap-1 pt-[clamp(0.8rem,2vh,1.6rem)]">
          <span
            className="font-display font-black leading-none tabular-nums"
            style={{ fontSize: isWinner ? "clamp(2.6rem,5.2vw,5.4rem)" : "clamp(1.7rem,3.2vw,3.2rem)", color: fg }}
          >
            {place}
            <span style={{ fontSize: "0.5em" }}>º</span>
          </span>
          {/* Winner score SLAMS in */}
          <motion.span
            initial={reduced ? { opacity: 0 } : { scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { delay: delay + 0.6, duration: durations.base } : { ...springs.slam, delay: delay + 0.7 }}
            className="font-display font-black leading-none tabular-nums"
            style={{ fontSize: isWinner ? "clamp(2rem,4.2vw,4.6rem)" : "clamp(1.4rem,2.7vw,2.7rem)", color: fg }}
          >
            <CountUp value={team.count} aria-label={`${team.name}: ${team.count} votos`} />
          </motion.span>
          <span className="text-[clamp(0.7rem,1.1vw,1.05rem)] font-bold uppercase tracking-[0.18em]" style={{ color: fg, opacity: 0.75 }}>
            votos
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export default Podium;
