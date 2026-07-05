"use client";

import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { QrCode } from "@/components/atoms/QrCode";
import { CountInTimer } from "@/components/atoms/CountInTimer";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { EyBeam } from "@/components/brand/EyBeam";
import { durations, easings } from "@/lib/motion/tokens";
import { useLobbyJoins } from "./useLobbyJoins";
import { teamInitial } from "./anonymize";
import type { Poll, RankedTeam, Team } from "@/lib/types";

/**
 * LobbyStage — the cinematic pre-voting screen (status draft/countdown).
 *
 * LEFT: a GIANT QR (encodes the VOTER url, never the screen url) as the clear
 * hero with a single instruction under it ("Escanea para unirte"), plus a live
 * joined counter: ONLY the number of participants (no aliases on the big
 * screen), rolling up via NumberFlow with a pop on every increment. The join
 * code is DEMOTED to a single discreet fallback line pinned to the very bottom
 * of the stage — outside the QR block — so it reads as the backup path, never
 * a competing step.
 * RIGHT: finalist cards teased at ZERO — anticipation, never a dead "no data".
 *
 * For `countdown` with a configured count-in, a BIG count-in to `opensAt` owns
 * the top of the join column ("La votación abre en… MM:SS"); otherwise an
 * evocative "preparados" pulse.
 */

export interface LobbyStageProps {
  poll: Poll;
  teams: Team[];
  /** Live ranked teams (all at zero pre-open) so colors/order stay consistent. */
  liveTeams: RankedTeam[];
  voterUrl: string;
  isCountdown: boolean;
  /** Server open timestamp (a FUTURE time during countdown) driving the count-in. */
  opensAt: string | null;
  reduced: boolean;
}

/** Extract a friendly "dominio/" hint from the absolute voter URL (host only). */
function domainHint(voterUrl: string): string {
  try {
    return new URL(voterUrl).host;
  } catch {
    return "";
  }
}

export const LobbyStage = memo(function LobbyStage({
  poll,
  teams,
  liveTeams,
  voterUrl,
  isCountdown,
  opensAt,
  reduced,
}: LobbyStageProps) {
  const { count: joined } = useLobbyJoins(poll.id);
  // Premium pop: the counter scales up briefly every time the number grows.
  // NumberFlow keeps its digit roll; this adds the "someone just joined" beat.
  const [counterScope, animateCounter] = useAnimate();
  useEffect(() => {
    if (reduced || joined === null || joined <= 0) return;
    if (counterScope.current === null) return;
    void animateCounter(
      counterScope.current,
      { scale: [1, 1.16, 1] },
      { duration: 0.45, ease: "easeOut" },
    );
  }, [joined, reduced, animateCounter, counterScope]);
  const domain = domainHint(voterUrl);
  // A future opens_at drives the count-in; only show it during countdown.
  // Mount-time clock read (lazy state keeps render pure); the stage re-mounts on
  // every status flip, and CountInTimer owns the live ticking from here on.
  const [mountedAt] = useState(() => Date.now());
  const showCountIn =
    isCountdown && opensAt !== null && new Date(opensAt).getTime() > mountedAt;
  // Prefer live ranked teams (keeps order stable into the race); fall back to the
  // server snapshot so the right column is never blank before realtime is ready.
  const cards: Array<Pick<Team, "id" | "name" | "color">> =
    liveTeams.length > 0 ? liveTeams : teams;

  return (
    <div className="relative grid h-full w-full grid-cols-[minmax(0,42%)_minmax(0,58%)] items-center gap-[clamp(1.5rem,3.5vw,3.5rem)] px-[clamp(1.5rem,3.5vw,4rem)] py-[clamp(1rem,3vh,2.5rem)] pb-[clamp(2.2rem,5vh,3.4rem)]">
      {/* LEFT — join column. `justify-center` + the same vertical rhythm as the
          right column keeps both blocks on one shared optical axis. */}
      <div className="flex h-full flex-col items-center justify-center gap-[clamp(1rem,2.6vh,2.2rem)] text-center">
        {/* Count-in owns the top of the column while the poll is counting in. */}
        {showCountIn && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.base, ease: easings.decel }}
          >
            <CountInTimer opensAt={opensAt} />
          </motion.div>
        )}

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: durations.slow, ease: easings.decel }}
        >
          {/* Fluid QR: scales with the stage (viewport-capped) so it fills the
              join column on a big projector without ever forcing scroll. */}
          <QrCode
            value={voterUrl}
            size={400}
            className="w-[min(clamp(320px,26vw,500px),58vh)] max-w-full [&_svg]:h-auto [&_svg]:w-full"
          />
        </motion.div>

        {/* The ONLY instruction under the QR — one clear step, gently pulsing. */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
          transition={
            reduced
              ? { duration: durations.base }
              : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
          }
          className="font-display text-[clamp(1.2rem,2vw,1.9rem)] font-bold text-ey-yellow"
        >
          Escanea para unirte
        </motion.span>

        {/* Live joined counter: participants number only — no aliases on screen.
            No reserved height: an empty slot would push the QR off the shared
            optical center, so the block grows in with an animated height. */}
        <div className="flex w-full flex-col items-center justify-start">
          <AnimatePresence>
            {joined !== null && joined > 0 && (
              <motion.div
                key="joined-count"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: durations.base }}
                className="flex items-baseline gap-2 overflow-hidden"
              >
                <span
                  ref={counterScope}
                  className="inline-block font-display text-[clamp(2.6rem,4.8vw,4.6rem)] font-black text-power-green tabular-nums"
                >
                  <CountUp value={joined} />
                </span>
                <span className="text-[clamp(1rem,1.4vw,1.35rem)] font-semibold uppercase tracking-[0.18em] text-text-dim">
                  en la sala
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT — teased finalists */}
      <div className="flex h-full flex-col justify-center gap-[clamp(1rem,2.4vh,2rem)]">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: durations.slow, ease: easings.decel }}
          className="flex flex-col gap-[clamp(0.35rem,1vh,0.7rem)]"
        >
          <h1 className="font-display text-[clamp(1.9rem,3.4vw,3.5rem)] font-black leading-none text-text">
            {poll.title}
          </h1>
          <span className="text-[clamp(0.9rem,1.35vw,1.25rem)] font-medium uppercase tracking-[0.22em] text-text-dim">
            {isCountdown ? "Preparados…" : "Los votos aparecen en cuanto abra la votación"}
          </span>
        </motion.div>

        <ul className="flex flex-col gap-[clamp(0.6rem,1.6vh,1.2rem)]">
          {cards.map((team, i) => (
            <motion.li
              key={team.id}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: reduced ? 0 : 0.2 + i * 0.1,
                duration: durations.base,
                ease: easings.standard,
              }}
              className="flex items-center gap-[clamp(0.7rem,1.6vw,1.4rem)] rounded-lg border border-white/8 bg-white/[0.03] px-[clamp(0.9rem,1.8vw,1.6rem)] py-[clamp(0.7rem,1.9vh,1.35rem)]"
            >
              <TeamColorChip
                color={team.color}
                label={teamInitial(team.name)}
                size={52}
              />
              <span className="flex-1 truncate font-display text-[clamp(1.25rem,2.5vw,2.5rem)] font-extrabold text-text">
                {team.name}
              </span>
              <motion.span
                animate={reduced ? undefined : { opacity: [0.4, 0.7, 0.4] }}
                transition={
                  reduced
                    ? undefined
                    : { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }
                }
                className="font-display text-[clamp(1.45rem,2.9vw,2.9rem)] font-black tabular-nums text-text-dim"
              >
                0
              </motion.span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Fallback join path — a single discreet line pinned to the stage foot,
          well away from the QR block, for phones that can't scan. */}
      <p className="pointer-events-none absolute inset-x-0 bottom-[clamp(0.5rem,1.4vh,1rem)] text-center text-[clamp(0.65rem,0.9vw,0.85rem)] tracking-wide text-text-dim/70">
        ¿No puedes escanear? Entra en{" "}
        {domain && <span className="font-semibold text-text-dim">{domain}/</span>}{" "}
        con el código{" "}
        <span className="font-mono font-bold uppercase tracking-[0.15em] text-text-dim">
          {poll.joinCode}
        </span>
      </p>
    </div>
  );
});

export default LobbyStage;
