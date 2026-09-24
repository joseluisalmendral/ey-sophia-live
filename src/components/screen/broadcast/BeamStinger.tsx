"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { easings } from "@/lib/motion/tokens";

/**
 * BeamStinger — the EY-beam wipe that stitches projector stages together.
 *
 * Three parallelograms skewed -18deg (the beam angle) — EY yellow, yellow/60,
 * white/15 — sweep left→right with a 60 ms stagger in 560 ms (`easings.standard`:
 * fast in, so the frame is covered early, then a decelerating exit).
 * The stage underneath swaps while the bars cover the middle of the frame.
 * Transform-only (translateX on skewed slabs, `will-change: transform` for the
 * sweep's lifetime only); no filters.
 *
 * `variant="ya"` (count-in → live): a giant "¡YA!" slams in over a dimmed
 * frame first (0–~560 ms), then the beams wipe it away onto the live board.
 * Reduced motion: no beams; "¡YA!" is a 600 ms opacity flash, a plain wipe is
 * skipped (the stage crossfade already covers it).
 *
 * Purely decorative (aria-hidden, pointer-events none, no mascot keep-out:
 * the co-host re-enters after the stage change anyway).
 */

export type StingerVariant = "ya" | "wipe";

const SWEEP_S = 0.56;
const STAGGER_S = 0.06;
const BEAMS = [
  { bg: "var(--color-ey-yellow)", delay: 0 },
  { bg: "rgb(255 230 0 / 0.6)", delay: STAGGER_S },
  { bg: "rgb(255 255 255 / 0.15)", delay: STAGGER_S * 2 },
] as const;

export function BeamStinger({
  variant,
  reduced,
  onDone,
}: {
  variant: StingerVariant;
  reduced: boolean;
  onDone: () => void;
}) {
  const ya = variant === "ya";
  // Beams start after the "¡YA!" slam has landed.
  const beamStart = ya ? 0.45 : 0;
  const VEIL_S = beamStart + 0.42;
  const YA_S = beamStart + 0.3;
  const totalMs = reduced
    ? ya
      ? 650
      : 0
    : Math.round((beamStart + SWEEP_S + STAGGER_S * 2) * 1000) + 40;

  useEffect(() => {
    const id = setTimeout(onDone, totalMs);
    return () => clearTimeout(id);
  }, [onDone, totalMs]);

  if (reduced && !ya) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[70] overflow-hidden"
      aria-hidden
    >
      {ya && (
        <>
          {/* Dim veil: hides the lobby→live swap until the beams pass. */}
          <motion.div
            className="absolute inset-0 bg-cosmic-deep"
            initial={{ opacity: 0 }}
            animate={{ opacity: reduced ? [0, 0.8, 0] : [0, 0.96, 0.96, 0] }}
            transition={
              reduced
                ? { duration: 0.6, times: [0, 0.3, 1] }
                : // Holds until the beams fully cover the frame (~beamStart + 0.3 s).
                  { duration: VEIL_S, times: [0, 0.1, (beamStart + 0.3) / VEIL_S, 1], ease: "linear" }
            }
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              className="font-display font-black leading-none text-ey-yellow"
              style={{
                fontSize: "calc(var(--text-proj-hero) * 2.2)",
                textShadow: "0 0 60px rgb(255 230 0 / 0.45)",
                willChange: reduced ? undefined : "transform",
              }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.55 }}
              animate={
                reduced
                  ? { opacity: [0, 1, 0] }
                  : { opacity: [0, 1, 1, 0], scale: [0.55, 1.06, 1, 1.12] }
              }
              transition={
                reduced
                  ? { duration: 0.6, times: [0, 0.3, 1] }
                  : // Slam (0–0.16 s), hold, then out as the beams sweep over it.
                    { duration: YA_S, times: [0, 0.25, (beamStart + 0.14) / YA_S, 1], ease: easings.standard }
              }
            >
              ¡YA!
            </motion.span>
          </div>
        </>
      )}

      {!reduced &&
        BEAMS.map((b, i) => (
          <motion.div
            key={i}
            className="absolute -inset-y-[12%] left-0 w-[72%]"
            style={{
              background: b.bg,
              skewX: -18,
              willChange: "transform",
            }}
            initial={{ x: "-150%" }}
            animate={{ x: "160%" }}
            transition={{ duration: SWEEP_S, ease: easings.standard, delay: beamStart + b.delay }}
          />
        ))}
    </div>
  );
}

export default BeamStinger;
