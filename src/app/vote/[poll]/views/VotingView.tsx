"use client";

import { AnimatePresence, motion } from "motion/react";
import { CountdownTimer } from "@/components/atoms/CountdownTimer";
import { durations, easings } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import type { Team } from "@/lib/types";
import type { Phase } from "../phase";
import { COPY, CheckIcon, ViewWrap } from "./shared";

/** Selection spring: a confident pop with a touch of overshoot. */
const SELECT_SPRING = { type: "spring", stiffness: 420, damping: 22, mass: 0.8 } as const;

/**
 * VotingView — the open poll: full-width glass cards with a team-colour spine.
 * Selection is unmistakable (scale spring + 2 px team border + team light +
 * check badge) and the rest dim to 55 % + desaturate. Pure presentational;
 * the hold-to-confirm CTA lives in the shell's sticky footer.
 */
export function VotingView({
  teams,
  phase,
  selectedId,
  onSelect,
  reduced,
  closesAt,
}: {
  teams: Team[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reduced: boolean;
  closesAt: string | null;
}) {
  const locked = phase === "submitting";
  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduced ? 0 : 0.06, delayChildren: 0.08 },
    },
  };
  const item = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 22 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: durations.base, ease: easings.decel },
        },
      };

  const select = (id: string) => {
    if (locked) return;
    if (id !== selectedId && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
    onSelect(id);
  };

  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-col gap-1.5 pt-1">
        <h1 className="text-balance font-display text-m-title font-extrabold leading-[1.08] text-text">
          {COPY.voteTitle}
        </h1>
        <div className="flex min-h-8 items-center justify-between gap-3">
          <p className="text-[0.9375rem] font-medium text-text-dim">{COPY.pick}</p>
          <CountdownTimer closesAt={closesAt} size="chip" />
        </div>
      </div>

      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
        className="mt-4 flex flex-col gap-3"
        role="radiogroup"
        aria-label={COPY.voteTitle}
      >
        {teams.map((team) => {
          const selected = team.id === selectedId;
          const dim = selectedId !== null && !selected;
          const ink = pickTextOn(team.color);
          return (
            <motion.li key={team.id} variants={item}>
              <motion.button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => select(team.id)}
                disabled={locked}
                className="vcard"
                data-selected={selected}
                data-dim={dim}
                style={{ ["--team" as string]: team.color }}
                animate={reduced ? undefined : { scale: selected ? 1.02 : 1 }}
                whileTap={reduced || locked ? undefined : { scale: selected ? 1.0 : 0.975 }}
                transition={SELECT_SPRING}
              >
                <span className="vcard__spine" aria-hidden />
                <span className="vcard__name">{team.name}</span>
                <span
                  className="vcard__badge"
                  aria-hidden
                  style={
                    selected
                      ? { background: team.color, color: ink, boxShadow: "none" }
                      : undefined
                  }
                >
                  <AnimatePresence initial={false}>
                    {selected && (
                      <motion.span
                        key="check"
                        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.3, rotate: -25 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={reduced ? { duration: 0.2 } : SELECT_SPRING}
                        className="flex"
                      >
                        <CheckIcon size={18} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </motion.button>
            </motion.li>
          );
        })}
      </motion.ul>
    </ViewWrap>
  );
}
