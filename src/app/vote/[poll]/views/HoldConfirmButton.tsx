"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";
import { pickTextOn } from "@/lib/utils/contrast";
import type { Team } from "@/lib/types";
import { COPY } from "./shared";

/** Hold duration (spec §3.1.3): long enough to be deliberate, short enough to feel snappy. */
export const HOLD_MS = 650;
const DRAIN_MS = 200;
const HINT_MS = 2200;
const HAPTIC_DONE = [18, 40, 18];

/**
 * HoldConfirmButton — the irreversible vote as a 0.65 s ritual.
 *
 * - Press and hold: the pill fills left→right in the team colour (linear,
 *   650 ms). Completion → haptic [18,40,18] → `onConfirm()` (the EXISTING
 *   submit handler, untouched).
 * - Early release: the fill drains in 200 ms, a hint appears ("Mantén pulsado
 *   un momento") and the pill wiggles once. Never submits.
 * - Keyboard / assistive tech: a synthetic click (Enter, Space, screen-reader
 *   activation — `event.detail === 0`) confirms immediately; those presses are
 *   deliberate. `aria-description` explains the hold.
 * - Reduced motion: the fill shows as 3 opacity steps, no wiggle.
 *
 * The fill + ink label are transform/clip-path only (no layout, no filters).
 */
export function HoldConfirmButton({
  team,
  submitting,
  onConfirm,
  reduced,
}: {
  team: Team | null;
  submitting: boolean;
  onConfirm: () => void;
  reduced: boolean;
}) {
  const progress = useMotionValue(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const holding = useRef(false);
  const fired = useRef(false);
  const [hint, setHint] = useState(false);
  const wiggleRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready = !!team && !submitting;
  const state = submitting ? "sending" : team ? "ready" : "idle";
  const ink = team ? pickTextOn(team.color) : "#1a1a24";

  // Fill geometry: continuous scaleX, or 3 opacity steps when reduced.
  const scaleX = useTransform(progress, (p) => (reduced ? 1 : p));
  const fillOpacity = useTransform(progress, (p) =>
    reduced ? Math.floor(p * 3 + 1e-6) / 3 : 1,
  );
  const inkClip = useTransform(progress, (p) =>
    reduced
      ? p >= 1
        ? "inset(0 0% 0 0)"
        : "inset(0 100% 0 0)"
      : `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`,
  );

  // Reset whenever the selected team changes or a submit starts/ends: full
  // while sending, empty otherwise (a failed submit re-arms the hold).
  useEffect(() => {
    anim.current?.stop();
    holding.current = false;
    fired.current = submitting;
    progress.set(submitting ? 1 : 0);
  }, [team?.id, submitting, progress]);

  useEffect(
    () => () => {
      anim.current?.stop();
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const complete = () => {
    if (fired.current) return;
    fired.current = true;
    holding.current = false;
    setHint(false);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(HAPTIC_DONE);
    }
    onConfirm();
  };

  const start = () => {
    if (!ready || fired.current) return;
    holding.current = true;
    anim.current?.stop();
    const from = progress.get();
    anim.current = animate(progress, 1, {
      duration: (HOLD_MS * (1 - from)) / 1000,
      ease: "linear",
      onComplete: () => {
        if (holding.current) complete();
      },
    });
  };

  const cancel = () => {
    if (!holding.current || fired.current) return;
    holding.current = false;
    anim.current?.stop();
    anim.current = animate(progress, 0, {
      duration: DRAIN_MS / 1000,
      ease: [0.3, 0, 0.2, 1],
    });
    setHint(true);
    if (!reduced && wiggleRef.current) {
      animate(
        wiggleRef.current,
        { x: [0, -7, 7, -4, 4, 0] },
        { duration: 0.34, ease: "easeOut" },
      );
    }
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), HINT_MS);
  };

  const label = submitting
    ? COPY.sending
    : team
      ? `${COPY.ctaHold} ${team.name}`
      : COPY.ctaPick;

  // Ready: two lines ("MANTÉN PARA VOTAR A" + the team) so long names fit.
  const labelContent = submitting ? (
    <>
      <span
        aria-hidden
        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
      />
      <span>{COPY.sending}</span>
    </>
  ) : team ? (
    <span className="hold__stack">
      <span className="hold__kicker">{COPY.ctaHold}</span>
      <span className="hold__team">{team.name}</span>
    </span>
  ) : (
    <span>{COPY.ctaPick}</span>
  );

  return (
    <div className="relative">
      <AnimatePresence>
        {hint && (
          <motion.p
            key="hint"
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-x-0 -top-9 text-center"
          >
            <span className="inline-block rounded-pill bg-cosmic-deep/90 px-3.5 py-1.5 text-[0.875rem] font-semibold text-text ring-1 ring-white/15">
              {COPY.ctaHint}
            </span>
          </motion.p>
        )}
      </AnimatePresence>

      <div ref={wiggleRef}>
        <button
          type="button"
          className="hold"
          data-state={state}
          disabled={!ready}
          aria-disabled={!ready}
          aria-busy={submitting}
          {...{ "aria-description": COPY.ctaA11y }}
          style={{
            ["--team" as string]: team?.color ?? "transparent",
            ["--ink" as string]: ink,
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            start();
          }}
          onPointerUp={() => cancel()}
          onPointerCancel={() => cancel()}
          onLostPointerCapture={() => cancel()}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            // Keyboard (Enter/Space) and screen-reader activation dispatch a
            // synthetic click with detail 0 — deliberate: confirm at once.
            // Pointer clicks (detail >= 1) are handled by the hold above.
            if (e.detail === 0 && ready) {
              progress.set(1);
              complete();
            }
          }}
        >
          {team && (
            <motion.span
              aria-hidden
              className="hold__fill"
              style={{ scaleX, opacity: fillOpacity }}
            />
          )}
          <span className="sr-only">{label}</span>
          <span className="hold__label" aria-hidden>
            {labelContent}
          </span>
          {team && (
            <motion.span
              aria-hidden
              className="hold__label hold__label--ink"
              style={{ clipPath: inkClip }}
            >
              {labelContent}
            </motion.span>
          )}
        </button>
      </div>
    </div>
  );
}
