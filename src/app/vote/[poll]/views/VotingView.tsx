"use client";

import { AnimatePresence, motion } from "motion/react";
import { SophiaBanner } from "@/components/brand/SophiaBanner";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { CountdownTimer } from "@/components/atoms/CountdownTimer";
import { durations, easings, springs } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import type { Poll, Team } from "@/lib/types";
import type { Phase } from "../useVoteFlow";
import { COPY, CheckIcon, ViewWrap } from "./shared";

/** Pure presentational voting/lobby view. Props in, no business hooks. */
export function VotingView({
  poll,
  teams,
  phase,
  selectedId,
  onSelect,
  reduced,
  closesAt,
}: {
  poll: Poll;
  teams: Team[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reduced: boolean;
  closesAt: string | null;
}) {
  const isLobby = phase === "lobby";
  // Staggered entrance for the cards.
  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: 0.12 },
    },
  };
  const item = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 28, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1 },
      };

  return (
    <ViewWrap reduced={reduced}>
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.slow, ease: easings.decel }}
      >
        <SophiaBanner variant="hero" tagline={COPY.tagline} />
      </motion.div>

      {isLobby ? (
        <LobbyTeaser poll={poll} teams={teams} reduced={reduced} />
      ) : (
        <>
          <div className="mb-3 mt-7 flex items-center justify-between">
            <p className="text-small font-medium text-text-dim">{COPY.pick}</p>
            <CountdownTimer closesAt={closesAt} size="chip" />
          </div>

          <motion.ul
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-3"
          >
            {teams.map((team) => {
              const selected = team.id === selectedId;
              const fg = pickTextOn(team.color);
              return (
                <motion.li key={team.id} variants={item}>
                  <motion.button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(team.id)}
                    disabled={phase === "submitting"}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    transition={springs.card}
                    className="relative flex min-h-[88px] w-full items-center gap-4 overflow-hidden rounded-xl px-5 text-left transition-shadow"
                    style={{
                      backgroundColor: selected
                        ? team.color
                        : "var(--color-surface-raised)",
                      color: selected ? fg : "var(--color-text)",
                      boxShadow: selected
                        ? "var(--shadow-e2)"
                        : "var(--shadow-e1)",
                      outline: selected
                        ? `3px solid ${team.color}`
                        : "1px solid rgba(255,255,255,0.08)",
                      outlineOffset: selected ? "2px" : "0px",
                    }}
                  >
                    <TeamColorChip
                      color={team.color}
                      label={team.name.charAt(0).toUpperCase()}
                      size={40}
                    />
                    <span className="flex-1 font-display text-h3 font-bold">
                      {team.name}
                    </span>
                    {/* Selection shown by checkmark + ring, never hue alone. */}
                    <AnimatePresence>
                      {selected && (
                        <motion.span
                          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={springs.slam}
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: fg,
                            color: team.color,
                          }}
                          aria-hidden
                        >
                          <CheckIcon />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.li>
              );
            })}
          </motion.ul>
        </>
      )}
    </ViewWrap>
  );
}

function LobbyTeaser({
  poll,
  teams,
  reduced,
}: {
  poll: Poll;
  teams: Team[];
  reduced: boolean;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-6 text-center">
      <motion.div
        animate={reduced ? undefined : { opacity: [0.6, 1, 0.6] }}
        transition={
          reduced
            ? undefined
            : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
        className="flex flex-col items-center gap-2"
      >
        <span className="text-micro uppercase tracking-[0.3em] text-ey-yellow">
          {poll.status === "countdown" ? "Preparados…" : "En breve"}
        </span>
        <h2 className="font-display text-h1 font-extrabold text-text">
          {COPY.lobbyTitle}
        </h2>
        <p className="max-w-xs text-balance text-small leading-relaxed text-text-dim">
          {COPY.lobbySub}
        </p>
      </motion.div>

      {/* Finalists teased at zero — anticipation, never a dead "no data". */}
      <ul className="flex w-full flex-col gap-2.5">
        {teams.map((team, i) => (
          <motion.li
            key={team.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: reduced ? 0 : 0.15 + i * 0.08,
              duration: durations.base,
              ease: easings.standard,
            }}
            className="flex items-center gap-3 rounded-lg border border-white/8 bg-surface-raised/60 px-4 py-3"
          >
            <TeamColorChip
              color={team.color}
              label={team.name.charAt(0).toUpperCase()}
              size={32}
            />
            <span className="flex-1 text-left font-display text-body font-semibold text-text">
              {team.name}
            </span>
            <span className="tabular-nums text-h3 font-extrabold text-text-dim">
              0
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
