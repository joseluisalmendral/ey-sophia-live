"use client";

import { useEffect, useState } from "react";
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
  opensAt,
  closesAt,
}: {
  poll: Poll;
  teams: Team[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reduced: boolean;
  opensAt: string | null;
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
        <LobbyWaiting poll={poll} opensAt={opensAt} reduced={reduced} />
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

/**
 * LobbyWaiting — the voter's PRE-OPEN state.
 *
 * DELIBERATELY does NOT render the team options. Showing the teams before the
 * poll opens made voters think they could already pick (confusing) — the whole
 * point of this screen is to make it unmistakable that voting has NOT started
 * yet and they must WAIT. So: a lock/wait cue, a clear message, and (when a
 * count-in is configured) a live "abre en MM:SS" so they know how long. The
 * option cards appear the instant the poll opens (the flow flips locally at
 * opensAt), which makes the transition feel like a real "start".
 */
function LobbyWaiting({
  poll,
  opensAt,
  reduced,
}: {
  poll: Poll;
  opensAt: string | null;
  reduced: boolean;
}) {
  const isCountdown = poll.status === "countdown";

  return (
    <div className="mt-10 flex flex-1 flex-col items-center justify-center gap-7 text-center">
      {/* Wait cue: a soft pulsing lock so it reads as "not yet", not "broken". */}
      <motion.div
        aria-hidden
        animate={reduced ? undefined : { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
        transition={
          reduced
            ? undefined
            : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
        className="flex h-24 w-24 items-center justify-center rounded-full border border-ey-yellow/25 bg-ey-yellow/5 text-5xl"
      >
        ⏳
      </motion.div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-micro uppercase tracking-[0.3em] text-ey-yellow">
          {isCountdown ? "Preparados…" : "En breve"}
        </span>
        <h2 className="font-display text-h1 font-extrabold text-text">
          {COPY.lobbyTitle}
        </h2>
        <p className="max-w-xs text-balance text-small leading-relaxed text-text-dim">
          {COPY.lobbyWaitHint}
        </p>
      </div>

      {/* Live count-in to opens_at when configured, so the wait has a horizon. */}
      <OpensInCountdown opensAt={opensAt} />
    </div>
  );
}

/**
 * OpensInCountdown — small "Abre en MM:SS" derived purely from the server
 * `opensAt` (re-derived each tick, never accumulated). Returns null when there
 * is no future open moment to count toward.
 */
function OpensInCountdown({ opensAt }: { opensAt: string | null }) {
  const [ms, setMs] = useState<number>(() =>
    opensAt ? Math.max(0, new Date(opensAt).getTime() - Date.now()) : 0,
  );

  useEffect(() => {
    if (!opensAt) return;
    const tick = () =>
      setMs(Math.max(0, new Date(opensAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [opensAt]);

  if (!opensAt || ms <= 0) return null;

  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const label = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-micro uppercase tracking-[0.22em] text-text-dim">
        Abre en
      </span>
      <span
        role="timer"
        aria-live="off"
        aria-label={`La votación abre en ${label}`}
        className="font-display text-display font-black tabular-nums text-ey-yellow"
      >
        {label}
      </span>
    </div>
  );
}
