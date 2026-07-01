"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QrCode } from "@/components/atoms/QrCode";
import { CountInTimer } from "@/components/atoms/CountInTimer";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { EyBeam } from "@/components/brand/EyBeam";
import { durations, easings } from "@/lib/motion/tokens";
import { usePresenceCount } from "./usePresenceCount";
import type { Poll, RankedTeam, Team } from "@/lib/types";

/**
 * LobbyStage — the cinematic pre-voting screen (status draft/countdown).
 *
 * LEFT: a GIANT QR (encodes the VOTER url, never the screen url) as the clear
 * hero + a live joined-count via Realtime presence (degrades to an inviting
 * "scan to join" prompt). The join code is DEMOTED to a small, clearly-labelled
 * fallback line under the QR ("¿No puedes escanear? …") so it reads as the backup
 * path, never a competing step.
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
  const joined = usePresenceCount(poll.id);
  const domain = domainHint(voterUrl);
  // A future opens_at drives the count-in; only show it during countdown.
  const showCountIn =
    isCountdown && opensAt !== null && new Date(opensAt).getTime() > Date.now();
  // Prefer live ranked teams (keeps order stable into the race); fall back to the
  // server snapshot so the right column is never blank before realtime is ready.
  const cards: Array<Pick<Team, "id" | "name" | "color">> =
    liveTeams.length > 0 ? liveTeams : teams;

  return (
    <div className="grid h-full w-full grid-cols-[minmax(0,42%)_minmax(0,58%)] items-center gap-[clamp(1.5rem,4vw,4rem)] px-[clamp(1.5rem,4vw,4.5rem)] py-[clamp(1rem,3vh,2.5rem)]">
      {/* LEFT — join column */}
      <div className="flex flex-col items-center gap-[clamp(1rem,2.4vh,2rem)] text-center">
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
          <QrCode value={voterUrl} size={300} />
        </motion.div>

        {/* Join code DEMOTED to a small, clearly-labelled fallback line — the QR
            is the hero; this is the backup path for phones that can't scan. */}
        <p className="max-w-[24ch] text-[clamp(0.75rem,1.05vw,1rem)] leading-relaxed text-text-dim">
          ¿No puedes escanear? Entra en{" "}
          {domain && (
            <span className="font-semibold text-text">{domain}/</span>
          )}{" "}
          e introduce el código{" "}
          <span className="font-mono font-bold uppercase tracking-[0.15em] text-text">
            {poll.joinCode}
          </span>
        </p>

        {/* Live joined count, or an inviting fallback prompt. */}
        <div className="flex min-h-[3rem] items-center justify-center">
          <AnimatePresence mode="wait">
            {joined !== null && joined > 0 ? (
              <motion.div
                key="joined"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.base }}
                className="flex items-baseline gap-2"
              >
                <span className="font-display text-[clamp(1.6rem,3vw,2.6rem)] font-black text-power-green tabular-nums">
                  <CountUp value={joined} />
                </span>
                <span className="text-[clamp(0.9rem,1.3vw,1.2rem)] font-semibold uppercase tracking-[0.18em] text-text-dim">
                  en la sala
                </span>
              </motion.div>
            ) : (
              <motion.span
                key="scan"
                initial={{ opacity: 0 }}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : { opacity: [0.55, 1, 0.55] }
                }
                exit={{ opacity: 0 }}
                transition={
                  reduced
                    ? { duration: durations.base }
                    : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                }
                className="font-display text-[clamp(1rem,1.6vw,1.4rem)] font-bold text-ey-yellow"
              >
                Escanea para unirte
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT — teased finalists */}
      <div className="flex h-full flex-col justify-center gap-[clamp(0.8rem,2vh,1.6rem)]">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: durations.slow, ease: easings.decel }}
          className="flex items-center gap-3"
        >
          <EyBeam surface="dark" size={40} label="" />
          <div className="flex flex-col">
            <h1 className="font-display text-[clamp(1.6rem,3vw,3rem)] font-black leading-none text-text">
              {poll.title}
            </h1>
            <span className="text-[clamp(0.8rem,1.2vw,1.1rem)] font-medium uppercase tracking-[0.22em] text-text-dim">
              {isCountdown ? "Preparados…" : "Los votos aparecen en cuanto abra la votación"}
            </span>
          </div>
        </motion.div>

        <ul className="flex flex-col gap-[clamp(0.5rem,1.4vh,1rem)]">
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
              className="flex items-center gap-[clamp(0.6rem,1.4vw,1.2rem)] rounded-lg border border-white/8 bg-white/[0.03] px-[clamp(0.8rem,1.6vw,1.4rem)] py-[clamp(0.6rem,1.6vh,1.1rem)]"
            >
              <TeamColorChip
                color={team.color}
                label={team.name.charAt(0).toUpperCase()}
                size={44}
              />
              <span className="flex-1 truncate font-display text-[clamp(1.1rem,2.2vw,2.2rem)] font-extrabold text-text">
                {team.name}
              </span>
              <motion.span
                animate={reduced ? undefined : { opacity: [0.4, 0.7, 0.4] }}
                transition={
                  reduced
                    ? undefined
                    : { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }
                }
                className="font-display text-[clamp(1.3rem,2.6vw,2.6rem)] font-black tabular-nums text-text-dim"
              >
                0
              </motion.span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
});

export default LobbyStage;
