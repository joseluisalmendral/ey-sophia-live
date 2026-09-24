"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { durations, easings } from "@/lib/motion/tokens";
import type { Poll, Team } from "@/lib/types";
import {
  COPY,
  HoldIcon,
  Kicker,
  ScreenIcon,
  TapIcon,
  ViewWrap,
} from "./shared";

/**
 * LobbyView — the voter's PRE-OPEN state (retention, spec §3.1.2).
 *
 * Unmistakably "not yet": no selectable cards. It keeps the wait alive with a
 * countdown hero (when a count-in is configured), the finalists list (phones
 * always see real identities; read-only rows, no numbering) and the 3-step
 * "Cómo va" so the hold-to-confirm is not a surprise. The mascot host row
 * above (PhoneMascot) carries the ambient lines and the poke.
 */
export function LobbyView({
  poll,
  teams,
  opensAt,
  reduced,
}: {
  poll: Poll;
  teams: Team[];
  opensAt: string | null;
  reduced: boolean;
}) {
  const isCountdown = poll.status === "countdown";
  const rise = (i: number) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: reduced ? 0 : 0.08 + i * 0.07,
      duration: durations.base,
      ease: easings.decel,
    },
  });

  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-col gap-6 pt-2">
        <motion.div {...rise(0)} className="flex flex-col gap-2">
          <Kicker>{isCountdown ? COPY.lobbyKickerCountdown : COPY.lobbyKicker}</Kicker>
          <h1 className="text-balance font-display text-m-title font-extrabold leading-[1.08] text-text">
            {COPY.lobbyTitle}
          </h1>
          <p className="text-m-body leading-snug text-text-dim">{COPY.lobbyHint}</p>
        </motion.div>

        <OpensInCountdown opensAt={opensAt} reduced={reduced} />

        {teams.length > 0 && (
          <motion.section {...rise(1)} aria-labelledby="finalists-h" className="flex flex-col gap-2.5">
            <h2 id="finalists-h" className="flex items-baseline justify-between">
              <Kicker className="text-text-dim">{COPY.finalists}</Kicker>
              <span className="text-m-label font-semibold text-text-dim/70">{teams.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="vrow"
                  style={{ ["--team" as string]: team.color }}
                >
                  <span className="vcard__spine" aria-hidden />
                  <span className="line-clamp-2 font-display text-m-body font-bold leading-tight text-text">
                    {team.name}
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        <motion.section {...rise(2)} aria-labelledby="how-h" className="flex flex-col gap-2.5">
          <h2 id="how-h">
            <Kicker className="text-text-dim">{COPY.howTitle}</Kicker>
          </h2>
          <ol className="vpanel grid grid-cols-3 gap-1 px-2 py-3.5">
            <Step n={1} label={COPY.howPick} icon={<TapIcon size={22} />} />
            <Step n={2} label={COPY.howHold} icon={<HoldIcon size={22} />} accent />
            <Step n={3} label={COPY.howWatch} icon={<ScreenIcon size={22} />} />
          </ol>
        </motion.section>
      </div>
    </ViewWrap>
  );
}

function Step({
  n,
  label,
  icon,
  accent = false,
}: {
  n: number;
  label: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <li className="flex flex-col items-center gap-2 text-center">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full ${
          accent
            ? "bg-ey-yellow/12 text-ey-yellow ring-1 ring-ey-yellow/40"
            : "bg-white/[0.06] text-text ring-1 ring-white/12"
        }`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="text-[0.8125rem] font-semibold leading-tight text-text">
        <span className="sr-only">Paso {n}: </span>
        {label}
      </span>
    </li>
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
