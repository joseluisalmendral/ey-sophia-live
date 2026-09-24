"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { durations, easings } from "@/lib/motion/tokens";
import type { Poll, Team } from "@/lib/types";
import { COPY, Kicker, ViewWrap } from "./shared";

/**
 * LobbyView — the voter's PRE-OPEN state.
 *
 * DELIBERATELY does NOT render the candidates: showing them before the poll
 * opens made voters think they could already pick. The screen must make it
 * unmistakable that voting has NOT started yet — a pulsing wait cue, a clear
 * message and (when a count-in is configured) a live "Abre en MM:SS". The
 * candidate cards appear the instant the poll opens (the flow flips locally
 * at opensAt), so the transition feels like a real "start".
 */
export function LobbyView({
  poll,
  opensAt,
  reduced,
}: {
  poll: Poll;
  teams: Team[];
  opensAt: string | null;
  reduced: boolean;
}) {
  const isCountdown = poll.status === "countdown";

  return (
    <ViewWrap reduced={reduced}>
      <div className="flex min-h-[62svh] flex-col items-center justify-center gap-7 pt-2 text-center">
        {/* Wait cue: a soft pulsing ring so it reads as "not yet", not "broken". */}
        <motion.div
          aria-hidden
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={
            reduced
              ? { opacity: 1 }
              : { opacity: [0.85, 1, 0.85], scale: [1, 1.06, 1] }
          }
          transition={
            reduced
              ? { duration: durations.base }
              : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          }
          className="flex h-24 w-24 items-center justify-center rounded-full border border-ey-yellow/30 bg-ey-yellow/[0.06] text-5xl shadow-[0_0_40px_-8px_rgb(255_230_0/0.35)]"
        >
          ⏳
        </motion.div>

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.08, duration: durations.base, ease: easings.decel }}
          className="flex flex-col items-center gap-3"
        >
          <Kicker>{isCountdown ? COPY.lobbyKickerCountdown : COPY.lobbyKicker}</Kicker>
          <h1 className="text-balance font-display text-m-title font-extrabold leading-[1.08] text-text">
            {COPY.lobbyTitle}
          </h1>
          <p className="max-w-xs text-balance text-m-body leading-snug text-text-dim">
            {COPY.lobbyHint}
          </p>
        </motion.div>

        <OpensInCountdown opensAt={opensAt} reduced={reduced} />
      </div>
    </ViewWrap>
  );
}

/**
 * OpensInCountdown — "Abre en MM:SS" hero derived purely from the server
 * `opensAt` (re-derived each tick, never accumulated). Null when there is no
 * future open moment. The interval stops while the tab is hidden.
 */
function OpensInCountdown({
  opensAt,
  reduced,
}: {
  opensAt: string | null;
  reduced: boolean;
}) {
  const [ms, setMs] = useState<number>(() =>
    opensAt ? Math.max(0, new Date(opensAt).getTime() - Date.now()) : 0,
  );

  useEffect(() => {
    if (!opensAt) return;
    const target = new Date(opensAt).getTime();
    const tick = () => setMs(Math.max(0, target - Date.now()));
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      tick();
      if (id === null) id = setInterval(tick, 250);
    };
    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [opensAt]);

  if (!opensAt || ms <= 0) return null;

  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const label = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const last5 = totalSec <= 5;

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: durations.base, ease: easings.decel }}
      className="vpanel flex items-center justify-between gap-4 px-5 py-4"
    >
      <Kicker className="text-text-dim">{COPY.opensIn}</Kicker>
      <span
        role="timer"
        aria-live="off"
        aria-label={`La votación abre en ${label}`}
        className="font-display font-black leading-none tabular-nums text-ey-yellow"
        style={{
          fontSize: "calc(var(--text-m-hero) * 1.2)",
          textShadow: last5 ? "0 0 28px rgb(255 230 0 / 0.45)" : undefined,
        }}
      >
        {label}
      </span>
    </motion.div>
  );
}
