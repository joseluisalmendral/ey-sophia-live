"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { durations, easings, springs } from "@/lib/motion/tokens";
import type { Team } from "@/lib/types";
import type { RankingEntry } from "../phase";
import { COPY, Kicker, ViewWrap, WatchPill, rankColor } from "./shared";

/** Let the projector lead: the phone reveals the rank 600 ms after the flip. */
export const REVEAL_DELAY_MS = 600;

/**
 * Personal result (spec §3.1.9, motion §D6). Only rendered for a fresh 'ok'
 * vote in this session. Kicker → "Tu equipo quedó" → giant #N (gold / silver /
 * bronze / white) slammed in over a team-colour flash → team name → compact
 * ranked list with the voter's team lit. While the one-shot results fetch is
 * in flight (or if it fails) the neutral "watch the big screen" state shows.
 */
export function RevealView({
  team,
  rank,
  total,
  ranking,
  reduced,
}: {
  team: Team | null;
  rank: number | null;
  total: number;
  ranking: readonly RankingEntry[] | null;
  reduced: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArmed(true), REVEAL_DELAY_MS);
    return () => clearTimeout(id);
  }, []);
  const show = armed && !!team && rank !== null;

  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center gap-5 pt-2 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Kicker>{COPY.revealKicker}</Kicker>
        </motion.div>

        <AnimatePresence mode="wait" initial={false}>
          {show && team && rank !== null ? (
            <RankBlock
              key="rank"
              team={team}
              rank={rank}
              total={total}
              ranking={ranking}
              reduced={reduced}
            />
          ) : (
            <motion.div
              key="neutral"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: durations.fast }}
              className="flex flex-1 flex-col items-center justify-center gap-5 pb-10"
            >
              <p className="max-w-[16rem] text-balance font-display text-m-title font-extrabold leading-[1.1] text-text">
                {COPY.revealRank}…
              </p>
              <WatchPill reduced={reduced} />
              <p className="text-m-label uppercase tracking-[0.2em] text-text-dim">
                {COPY.revealOf(total)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ViewWrap>
  );
}

function RankBlock({
  team,
  rank,
  total,
  ranking,
  reduced,
}: {
  team: Team;
  rank: number;
  total: number;
  ranking: readonly RankingEntry[] | null;
  reduced: boolean;
}) {
  const color = rankColor(rank);
  const fade = (delay: number) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduced ? 0 : delay, duration: 0.26, ease: easings.decel },
  });

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex w-full flex-col items-center gap-5"
    >
      <motion.p
        {...fade(0)}
        className="font-display text-[1.125rem] font-bold text-text-dim"
      >
        {COPY.revealRank}
      </motion.p>

      <div className="relative flex items-center justify-center">
        {/* Team-colour flash behind the number (opacity only). */}
        {!reduced && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute h-56 w-56 rounded-full"
            style={{
              background: `radial-gradient(closest-side, color-mix(in oklab, ${team.color} 70%, transparent), transparent)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            transition={{ delay: 0.26, duration: 0.6, ease: "easeOut" }}
          />
        )}
        <motion.span
          initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduced ? { duration: 0.25 } : { ...springs.slam, delay: 0.26 }}
          className="relative font-display font-black leading-[0.9] tabular-nums"
          style={{
            fontSize: "calc(var(--text-m-hero) * 2.2)",
            color,
            textShadow:
              rank === 1
                ? "0 0 36px rgb(255 230 0 / 0.55), 0 0 90px rgb(255 230 0 / 0.25)"
                : rank <= 3
                  ? "0 0 28px rgb(255 255 255 / 0.12)"
                  : undefined,
          }}
          aria-label={`Puesto ${rank}`}
        >
          #{rank}
        </motion.span>
      </div>

      <motion.div {...fade(0.46)} className="flex flex-col items-center gap-1">
        <span className="inline-flex max-w-full items-center gap-2.5">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ background: team.color, boxShadow: `0 0 12px ${team.color}` }}
          />
          <span className="line-clamp-2 text-balance font-display text-m-card font-extrabold leading-tight text-text">
            {team.name}
          </span>
        </span>
        {rank === 1 ? (
          <span className="font-display text-m-body font-extrabold text-ey-yellow">
            {COPY.revealChampion}
          </span>
        ) : (
          <span className="text-m-label uppercase tracking-[0.2em] text-text-dim">
            {COPY.revealOf(total)}
          </span>
        )}
      </motion.div>

      {ranking && ranking.length > 1 && (
        <motion.ol
          {...fade(0.66)}
          className="mt-1 flex w-full flex-col gap-1.5 text-left"
          aria-label="Clasificación final"
        >
          {ranking.map((row) => {
            const mine = row.id === team.id;
            return (
              <li
                key={row.id}
                className="vrow"
                data-mine={mine}
                style={{ ["--team" as string]: row.color, minHeight: 48 }}
              >
                <span className="vcard__spine" aria-hidden />
                <span
                  className="w-7 shrink-0 font-display text-m-body font-black tabular-nums"
                  style={{ color: rankColor(row.rank) }}
                >
                  {row.rank}
                </span>
                <span
                  className={`line-clamp-1 flex-1 font-display text-[0.9375rem] leading-tight ${
                    mine ? "font-extrabold text-text" : "font-semibold text-text/85"
                  }`}
                >
                  {row.name}
                  {mine && <span className="sr-only"> (tu equipo)</span>}
                </span>
                <span className="shrink-0 text-[0.875rem] font-semibold tabular-nums text-text-dim">
                  {COPY.votes(row.count)}
                </span>
              </li>
            );
          })}
        </motion.ol>
      )}
    </motion.div>
  );
}
