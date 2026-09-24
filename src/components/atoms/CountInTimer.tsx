"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { easings, springs } from "@/lib/motion/tokens";

/**
 * CountInTimer — the projector's PRE-VOTING count-in to a server `opensAt`.
 *
 * Derived PURELY from the server `opensAt` (never a local accumulator), so a
 * resumed tab corrects itself instantly and every screen in the room agrees.
 *
 * Three phases (reported through `onPhase` so the lobby can clear the stage):
 *   "count"     > 5 s left — kicker "LA VOTACIÓN ABRE EN" + a hero MM:SS;
 *   "takeover"  last 5 s   — the number grows (×1.8 hero) inside a yellow
 *               progress ring that charges up to full at zero; each second
 *               lands with a small pop;
 *   "go"        0 s        — the full ring holds (empty centre) until the
 *               status flip — normally the same frame — when the stage
 *               stinger slams the "¡YA!" over the whole frame.
 *
 * The ring is two half-rings rotating in turn (transform only, one CSS
 * animation each, negative delays sync it to the real remaining time), so it
 * stays on the compositor. Reduced motion: static track ring, no pops.
 */

export type CountInPhase = "count" | "takeover" | "go";

export interface CountInTimerProps {
  /** Server ISO timestamp the poll opens at (a FUTURE time during countdown). */
  opensAt: string | null;
  reduced?: boolean;
  onPhase?: (phase: CountInPhase) => void;
}

const TAKEOVER_MS = 5000;

function remainingMs(opensAt: string): number {
  return Math.max(0, new Date(opensAt).getTime() - Date.now());
}

function format(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function phaseOf(ms: number): CountInPhase {
  if (ms <= 0) return "go";
  if (ms <= TAKEOVER_MS) return "takeover";
  return "count";
}

export function CountInTimer({ opensAt, reduced = false, onPhase }: CountInTimerProps) {
  const [ms, setMs] = useState<number>(() => (opensAt ? remainingMs(opensAt) : 0));

  useEffect(() => {
    if (!opensAt) return;
    const tick = () => setMs(remainingMs(opensAt));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [opensAt]);

  const phase = phaseOf(ms);
  useEffect(() => {
    onPhase?.(phase);
  }, [phase, onPhase]);

  if (!opensAt) return null;
  const totalSec = Math.ceil(ms / 1000);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {phase === "count" ? (
        <motion.div
          key="count"
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.25 }}
          transition={{ duration: 0.28, ease: easings.accel }}
          className="flex flex-col items-start gap-[clamp(0.3rem,1vh,0.8rem)]"
        >
          <span className="font-display text-proj-label font-extrabold uppercase tracking-[0.22em] text-ey-yellow">
            La votación abre en
          </span>
          <span
            role="timer"
            aria-live="off"
            aria-label={`La votación abre en ${format(ms)}`}
            className="font-display text-[calc(var(--text-proj-hero)*1.25)] font-black leading-[0.9] tracking-tight text-text tabular-nums"
          >
            {format(ms)}
          </span>
        </motion.div>
      ) : (
        <motion.div
          key="takeover"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduced ? { duration: 0.2 } : springs.enter}
          className="relative flex items-center justify-center"
          style={{ width: "var(--countin-ring)", height: "var(--countin-ring)" } as CSSProperties}
          data-countin-takeover=""
        >
          <ProgressRing reduced={reduced} startMs={ms} />
          <AnimatePresence mode="popLayout" initial={false}>
            {phase !== "go" && (
            <motion.span
              key={totalSec}
              role="timer"
              aria-live="off"
              aria-label={`La votación abre en ${totalSec} segundos`}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.35 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 22 }}
              className="relative font-display font-black leading-none text-ey-yellow tabular-nums"
              style={{
                fontSize: "calc(var(--text-proj-hero) * 1.8)",
                textShadow: "0 0 48px rgb(255 230 0 / 0.45)",
              }}
            >
              {totalSec}
            </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * ProgressRing — charges from empty to full over the last 5 s. Built from two
 * clipped half-rings: the right clip reveals 12→6 o'clock as its arc rotates
 * 0→180°, then the left clip reveals 6→12. Mount-time `startMs` becomes a
 * negative animation delay so the ring matches the real remaining time.
 */
function ProgressRing({ reduced, startMs }: { reduced: boolean; startMs: number }) {
  const [elapsed] = useState(() => Math.max(0, TAKEOVER_MS - startMs));
  const half = TAKEOVER_MS / 2;
  const thickness = "calc(var(--countin-ring) * 0.045)";
  const arc = (side: "left" | "right"): CSSProperties => ({
    position: "absolute",
    top: 0,
    width: "200%",
    height: "100%",
    left: side === "right" ? "-100%" : "0",
    borderRadius: "50%",
    border: `${thickness} solid transparent`,
    // The arc starts on the opposite (clipped) half and rotates into view.
    ...(side === "right"
      ? { borderLeftColor: "var(--color-ey-yellow)", borderBottomColor: "var(--color-ey-yellow)" }
      : { borderRightColor: "var(--color-ey-yellow)", borderTopColor: "var(--color-ey-yellow)" }),
    transform: "rotate(45deg)",
  });
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* Track */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: `${thickness} solid rgb(255 230 0 / 0.16)` }}
      />
      {!reduced && (
        <>
          <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                animation: `ringHalf ${half}ms linear ${-elapsed}ms both`,
                transformOrigin: "0% 50%",
              }}
            >
              <div style={arc("right")} />
            </div>
          </div>
          <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                animation: `ringHalf ${half}ms linear ${half - elapsed}ms both`,
                transformOrigin: "100% 50%",
              }}
            >
              <div style={arc("left")} />
            </div>
          </div>
          {/* Soft glow disc behind the number (static gradient, no filter). */}
          <div
            className="absolute inset-[12%] rounded-full"
            style={{ background: "radial-gradient(circle, rgb(255 230 0 / 0.14), transparent 70%)" }}
          />
        </>
      )}
    </div>
  );
}

export default CountInTimer;
