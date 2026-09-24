"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { durations, easings } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import type { Team } from "@/lib/types";
import { COPY } from "./shared";

/** Press feedback: a quick, firm UI spring (tasteful, no wobble). */
const PRESS_SPRING = { type: "spring", stiffness: 520, damping: 30, mass: 0.7 } as const;
/** Haptic tick on the vote tap (Android; iOS ignores vibrate). */
const HAPTIC_TAP = 12;

/**
 * VoteButton — the sticky thumb-zone CTA: a normal, accessible button.
 *
 *  - idle (nothing picked): outlined, dim "Elige un equipo", disabled;
 *  - ready: filled in the picked team's color with contrast ink
 *    (pickTextOn), "VOTAR A" kicker + the team name (≤ 1 line, ellipsis).
 *    Changing the pick cross-fades the fill layer and the label (opacity /
 *    transform only);
 *  - pressed: scales to 0.97 on a firm spring + haptic tick, then calls the
 *    EXISTING submit handler (`onSubmit`, unchanged);
 *  - sending: spinner + "Enviando…", aria-busy, disabled.
 *
 * A tap is guarded against double submits until `submitting` resolves (a
 * second tap can land before React re-renders the disabled state). Enter /
 * Space / assistive tech work as on any button. Reduced motion: no scale, no
 * label travel — cross-fades only.
 */
export function VoteButton({
  team,
  submitting,
  onSubmit,
  reduced,
}: {
  team: Team | null;
  submitting: boolean;
  onSubmit: () => void;
  reduced: boolean;
}) {
  const fired = useRef(false);
  // Re-arm after a submit resolves (an error keeps the phone on this view) or
  // when the pick changes.
  useEffect(() => {
    if (!submitting) fired.current = false;
  }, [submitting, team?.id]);

  const ready = !!team && !submitting;
  const state = submitting ? "sending" : team ? "ready" : "idle";
  const ink = team ? pickTextOn(team.color) : undefined;

  const onClick = () => {
    if (!ready || fired.current) return;
    fired.current = true;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(HAPTIC_TAP);
    onSubmit();
  };

  const label = submitting
    ? COPY.sending
    : team
      ? `${COPY.ctaVote} ${team.name}`
      : COPY.ctaPick;

  return (
    <motion.button
      type="button"
      className="vbtn"
      data-state={state}
      disabled={!ready}
      aria-busy={submitting}
      aria-label={label}
      onClick={onClick}
      style={
        team
          ? { ["--team" as string]: team.color, ["--ink" as string]: ink }
          : undefined
      }
      whileTap={reduced || !ready ? undefined : { scale: 0.97 }}
      transition={PRESS_SPRING}
    >
      {/* Team fill, cross-faded when the pick changes (opacity only). */}
      <AnimatePresence initial={false}>
        {team && (
          <motion.span
            key={team.id}
            aria-hidden
            className="vbtn__fill"
            style={{ backgroundColor: team.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.fast, ease: easings.standard }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        <motion.span
          key={submitting ? "sending" : (team?.id ?? "idle")}
          aria-hidden
          className="vbtn__label"
          // Ink captured per label: the exiting label keeps its own contrast
          // color over the fading fill.
          style={ink ? { color: ink } : undefined}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: durations.fast, ease: easings.standard }}
        >
          {submitting ? (
            <>
              <span className="vbtn__spinner" />
              <span>{COPY.sending}</span>
            </>
          ) : team ? (
            <span className="vbtn__stack">
              <span className="vbtn__kicker">{COPY.ctaVote}</span>
              <span className="vbtn__team">{team.name}</span>
            </span>
          ) : (
            <span>{COPY.ctaPick}</span>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export default VoteButton;
