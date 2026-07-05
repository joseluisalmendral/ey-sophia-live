"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { springs, durations } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import { Crown } from "./Crown";
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
 * Winner(s) wear a crown (two crowns on a double-crown tie, both sharing the
 * center plinth). Every plinth is painted with its OWN team color — the winner
 * gets a full-saturation fill plus accents (crown, glow-win shadow, yellow
 * name), never a bar-color swap to EY yellow.
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
      <div className="flex w-full max-w-[1500px] items-end justify-center gap-[clamp(1rem,3vw,3.5rem)]">
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
        {/* 1st — CENTER (tallest), or shared center on double crown */}
        {outcome.doubleCrown && first && second ? (
          <SharedCenter first={first} second={second} reduced={reduced} />
        ) : (
          first && (
            <PodiumBlock
              team={first}
              place={1}
              heightVh={HEIGHTS.first}
              isWinner={winnerIds.has(first.id)}
              reduced={reduced}
              delay={0}
            />
          )
        )}
        {/* 3rd — RIGHT */}
        {third && !outcome.doubleCrown && (
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
    </div>
  );
});

function SharedCenter({
  first,
  second,
  reduced,
}: {
  first: RankedTeam;
  second: RankedTeam;
  reduced: boolean;
}) {
  // Double-crown: two co-winners share the tall center plinth side by side.
  return (
    <div className="flex items-end gap-[clamp(0.6rem,1.5vw,1.5rem)]">
      <PodiumBlock team={first} place={1} heightVh={HEIGHTS.first} isWinner reduced={reduced} delay={0} crownLabel="EMPATE" />
      <PodiumBlock team={second} place={1} heightVh={HEIGHTS.first} isWinner reduced={reduced} delay={0.12} crownLabel="EMPATE" />
    </div>
  );
}

function PodiumBlock({
  team,
  place,
  heightVh,
  isWinner,
  reduced,
  delay,
  crownLabel,
}: {
  team: RankedTeam;
  place: 1 | 2 | 3;
  heightVh: number;
  isWinner: boolean;
  reduced: boolean;
  delay: number;
  crownLabel?: string;
}) {
  // Text inside the plinth contrasts against the team's real color (the winner
  // plinth is full-saturation team color, so contrast runs on that).
  const fg = pickTextOn(team.color);
  const plinthBg = isWinner
    ? `linear-gradient(180deg, color-mix(in srgb, ${team.color} 88%, #fff) 0%, ${team.color} 100%)`
    : `linear-gradient(180deg, color-mix(in srgb, ${team.color} 45%, var(--color-cosmic-700)) 0%, color-mix(in srgb, ${team.color} 22%, var(--color-cosmic-700)) 100%)`;

  return (
    <div className="flex w-[clamp(9rem,24vw,21rem)] flex-col items-center">
      {/* Crown above winners */}
      <div className="flex h-[clamp(5.5rem,14vh,9.5rem)] items-end justify-center">
        {isWinner && (
          <div className="flex flex-col items-center">
            <Crown size={reduced ? 92 : 128} delay={delay + 0.4} reduced={reduced} />
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
        className="mb-2 flex flex-col items-center gap-1.5 text-center"
      >
        <TeamColorChip
          color={team.color}
          label={team.name.charAt(0).toUpperCase()}
          size={isWinner ? 68 : 52}
        />
        <span
          className="max-w-full truncate font-display font-black leading-tight"
          style={{
            fontSize: isWinner ? "clamp(1.8rem,4vw,4.2rem)" : "clamp(1.3rem,2.8vw,2.8rem)",
            color: isWinner ? "var(--color-ey-yellow)" : "var(--color-text)",
            textShadow: isWinner ? "0 0 28px rgba(255,230,0,0.4)" : undefined,
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
