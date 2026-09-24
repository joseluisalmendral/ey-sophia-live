"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { durations, easings } from "@/lib/motion/tokens";
import type { Team } from "@/lib/types";
import { COPY, Kicker, ViewWrap, WatchPill } from "./shared";

/** Confirm moment length before the view settles into the calm wait (spec §3.1.6). */
export const CONFIRM_MOMENT_MS = 2500;

const ORB_SPRING = { type: "spring", stiffness: 320, damping: 18, mass: 0.9 } as const;
const OUT = [0, 0, 0.2, 1] as const;
const MINT = "#8ff5c8";
const YELLOW = "#ffe600";

/**
 * ConfirmView — fresh 'ok' vote. Two beats in one view:
 *  1. Confirm moment (0–2.5 s, motion §D5 "check-in-orb burst"): team-colour
 *     bloom from the CTA, orb pop, ring, mint check draw, 8 particles,
 *     "¡Voto dentro!", then the "Mira la pantalla grande" pill.
 *  2. Wait (after 2.5 s): content settles into a small orb + the look-up cue.
 *     Nothing else — attention belongs to the big screen.
 * Reduced motion: orb + check fade, no ring/particles/bloom, same copy.
 */
export function ConfirmView({ team, reduced }: { team: Team; reduced: boolean }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), CONFIRM_MOMENT_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <ViewWrap reduced={reduced}>
      {!reduced && <Bloom color={team.color} />}
      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <AnimatePresence mode="wait" initial={false}>
          {!settled ? (
            <motion.div
              key="moment"
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -10 }}
              transition={{ duration: durations.fast, ease: easings.accel }}
              className="flex flex-col items-center gap-7"
            >
              <Orb color={team.color} size={112} reduced={reduced} burst={!reduced} />
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0.1 : 0.32, duration: 0.32, ease: OUT }}
                className="flex flex-col items-center gap-2.5"
              >
                <h1 className="font-display text-m-hero font-black leading-none text-text">
                  {COPY.confirmHero}
                </h1>
                <p className="max-w-[18rem] text-balance text-m-body leading-snug text-text-dim">
                  {COPY.confirmYour}{" "}
                  <strong className="font-extrabold" style={{ color: team.color }}>
                    {team.name}
                  </strong>{" "}
                  {COPY.confirmIn}
                </p>
              </motion.div>
              <WatchPill reduced={reduced} delay={reduced ? 0.2 : 0.56} />
            </motion.div>
          ) : (
            <motion.div
              key="wait"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: durations.base, ease: easings.decel }}
              className="flex flex-col items-center gap-6"
            >
              <LookUp reduced={reduced} />
              <div className="flex flex-col items-center gap-2">
                <h1 className="max-w-[16rem] text-balance font-display text-m-title font-extrabold leading-[1.1] text-text">
                  {COPY.watch}
                </h1>
                <p className="text-m-body text-text-dim">{COPY.waitSub}</p>
              </div>
              <div
                className="vrow"
                data-mine="true"
                style={{ ["--team" as string]: team.color }}
              >
                <Orb color={team.color} size={30} reduced burst={false} />
                <span className="flex min-w-0 flex-col items-start">
                  <Kicker className="text-text-dim">{COPY.waitYour}</Kicker>
                  <span className="line-clamp-1 font-display text-m-body font-extrabold text-text">
                    {team.name}
                  </span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ViewWrap>
  );
}

/** Team-colour bloom expanding from the CTA (bottom centre), 500 ms, one-shot. */
function Bloom({ color }: { color: string }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed bottom-0 left-1/2 z-0 aspect-square w-[140vw] max-w-[640px] rounded-full"
      style={{
        x: "-50%",
        y: "50%",
        background: `radial-gradient(closest-side, color-mix(in oklab, ${color} 55%, transparent), transparent)`,
      }}
      initial={{ scale: 0.15, opacity: 0.9 }}
      animate={{ scale: 1.6, opacity: 0 }}
      transition={{ duration: 0.5, ease: OUT }}
    />
  );
}

/**
 * Orb — dark glass disc with a team-colour rim and a mint check drawn with
 * pathLength. `burst` adds the ring + 8 particles (team ×5, yellow ×3).
 */
function Orb({
  color,
  size,
  reduced,
  burst,
}: {
  color: string;
  size: number;
  reduced: boolean;
  burst: boolean;
}) {
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4 + Math.PI / 8;
    const dist = 60 + ((i * 37) % 51); // 60–110 px, deterministic spread
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      c: i % 8 < 5 ? color : YELLOW,
    };
  });
  const big = size >= 60;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {burst && (
        <>
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `inset 0 0 0 2px ${color}` }}
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ delay: 0.06, duration: 0.52, ease: OUT }}
          />
          {particles.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{ background: p.c, left: "50%", top: "50%", marginLeft: -3, marginTop: -3 }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.6 }}
              transition={{ delay: 0.16, duration: 0.48, ease: OUT }}
            />
          ))}
        </>
      )}
      <motion.div
        className="relative flex h-full w-full items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 35%, color-mix(in oklab, ${color} 28%, #0d1433), #070b1f 72%)`,
          boxShadow: big
            ? `inset 0 0 0 3px ${color}, 0 0 44px -4px color-mix(in oklab, ${color} 60%, transparent), inset 0 2px 0 rgb(255 255 255 / 0.25)`
            : `inset 0 0 0 2px ${color}`,
        }}
        initial={reduced ? { opacity: 0 } : { scale: 0 }}
        animate={reduced ? { opacity: 1 } : { scale: 1 }}
        transition={reduced ? { duration: 0.3 } : ORB_SPRING}
      >
        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 24 24"
          fill="none"
          stroke={MINT}
          strokeWidth={big ? 2.6 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <motion.path
            d="M4.5 12.5 9.5 17.5 19.5 6.5"
            initial={{ pathLength: reduced ? 1 : 0, opacity: reduced ? 0 : 1 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={reduced ? { duration: 0.3 } : { delay: 0.12, duration: 0.26, ease: [0.2, 0, 0, 1] }}
          />
        </svg>
      </motion.div>
    </div>
  );
}

/** Look-up cue: stacked chevrons drifting upward (6 px loop). */
function LookUp({ reduced }: { reduced: boolean }) {
  return (
    <div
      className="relative flex h-20 w-20 items-center justify-center rounded-full"
      style={{
        background: "radial-gradient(circle, rgb(255 230 0 / 0.14), transparent 70%)",
        boxShadow: "inset 0 0 0 1.5px rgb(255 230 0 / 0.35)",
      }}
      aria-hidden
    >
      <motion.svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke={YELLOW}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={reduced ? undefined : { y: [3, -3, 3] }}
        transition={reduced ? undefined : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M6 12.5 12 6.5l6 6" />
        <path d="M6 18.5 12 12.5l6 6" opacity="0.45" />
      </motion.svg>
    </div>
  );
}
