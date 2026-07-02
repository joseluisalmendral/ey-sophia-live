"use client";

import { motion } from "motion/react";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { springs } from "@/lib/motion/tokens";
import type { Team } from "@/lib/types";
import { COPY, ViewWrap } from "./shared";

/**
 * Personal reveal — "tu equipo quedó #N". Only rendered for a fresh 'ok' vote
 * in this session; team + rank are guaranteed known by the caller.
 */
export function RevealView({
  team,
  rank,
  total,
  reduced,
}: {
  team: Team | null;
  rank: number | null;
  total: number;
  reduced: boolean;
}) {
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-7 py-10 text-center">
        <span className="text-micro uppercase tracking-[0.3em] text-ey-yellow">
          {COPY.revealKicker}
        </span>

        {team && rank ? (
          <>
            <p className="font-display text-h3 font-semibold text-text-dim">
              {COPY.revealRank}
            </p>
            <motion.div
              initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={springs.slam}
              className="font-display font-black leading-none"
              style={{
                fontSize: "var(--text-display-2xl)",
                // Always the team's real color; winners get a glow accent in
                // their own color instead of swapping to EY yellow.
                color: team.color,
                textShadow:
                  rank === 1
                    ? `0 0 48px color-mix(in srgb, ${team.color} 45%, transparent)`
                    : undefined,
              }}
            >
              #{rank}
            </motion.div>
            <div className="flex items-center gap-3">
              <TeamColorChip
                color={team.color}
                label={team.name.charAt(0).toUpperCase()}
                size={28}
              />
              <span className="font-display text-h2 font-bold text-text">
                {team.name}
              </span>
            </div>
            {rank === 1 && (
              <p className="font-display text-h3 font-extrabold text-ey-yellow">
                ¡Campeones! 🏆
              </p>
            )}
          </>
        ) : (
          <h2 className="max-w-xs text-balance font-display text-h1 font-extrabold text-text">
            {COPY.watch}
          </h2>
        )}

        <p className="text-micro uppercase tracking-[0.2em] text-text-dim">
          de {total} finalistas
        </p>
      </div>
    </ViewWrap>
  );
}
