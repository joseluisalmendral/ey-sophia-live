"use client";

import { memo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QrCode } from "@/components/atoms/QrCode";
import { CountInTimer } from "@/components/atoms/CountInTimer";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { EyBeam } from "@/components/brand/EyBeam";
import { durations, easings } from "@/lib/motion/tokens";
import { useLobbyRoster, type LobbyMember } from "./usePresenceCount";
import type { Poll, RankedTeam, Team } from "@/lib/types";

/**
 * LobbyStage — the cinematic pre-voting screen (status draft/countdown).
 *
 * LEFT: a GIANT QR (encodes the VOTER url, never the screen url) as the clear
 * hero with a single instruction under it ("Escanea para unirte"), plus a live
 * joined feed via Realtime presence: a prominent counter and a stream of
 * anonymous alias chips ("Vega 12") animating in as voters arrive. The join
 * code is DEMOTED to a single discreet fallback line pinned to the very bottom
 * of the stage — outside the QR block — so it reads as the backup path, never
 * a competing step.
 * RIGHT: finalist cards teased at ZERO — anticipation, never a dead "no data".
 *
 * For `countdown` with a configured count-in, a BIG count-in to `opensAt` owns
 * the top of the join column ("La votación abre en… MM:SS"); otherwise an
 * evocative "preparados" pulse.
 */

/** How many recent joiners to show as chips in the feed. */
const FEED_SIZE = 6;

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
  const { count: joined, members } = useLobbyRoster(poll.id);
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
    <div className="relative grid h-full w-full grid-cols-[minmax(0,42%)_minmax(0,58%)] items-center gap-[clamp(1.5rem,4vw,4rem)] px-[clamp(1.5rem,4vw,4.5rem)] py-[clamp(1rem,3vh,2.5rem)] pb-[clamp(2.2rem,5vh,3.4rem)]">
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

        {/* The ONLY instruction under the QR — one clear step, gently pulsing. */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
          transition={
            reduced
              ? { duration: durations.base }
              : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
          }
          className="font-display text-[clamp(1.1rem,1.8vw,1.6rem)] font-bold text-ey-yellow"
        >
          Escanea para unirte
        </motion.span>

        {/* Live joined feed: prominent counter + stream of anonymous alias chips. */}
        <div className="flex min-h-[6rem] w-full flex-col items-center justify-start gap-[clamp(0.5rem,1.2vh,0.9rem)]">
          <AnimatePresence>
            {joined !== null && joined > 0 && (
              <motion.div
                key="joined-count"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.base }}
                className="flex items-baseline gap-2"
              >
                <span className="font-display text-[clamp(1.8rem,3.2vw,2.8rem)] font-black text-power-green tabular-nums">
                  <CountUp value={joined} />
                </span>
                <span className="text-[clamp(0.9rem,1.3vw,1.2rem)] font-semibold uppercase tracking-[0.18em] text-text-dim">
                  en la sala
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <JoinFeed members={members} reduced={reduced} />
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

/**
 * JoinFeed — the last few voters who joined, as anonymous alias chips.
 *
 * Newest chip enters first (leftmost) with a pop; older chips slide along via
 * layout animation and fade toward the tail, so the row reads as a living
 * stream without ever growing unbounded. Entries without an alias (legacy
 * payloads) are counted in the counter but skipped here — nothing breaks.
 */
function JoinFeed({
  members,
  reduced,
}: {
  members: LobbyMember[];
  reduced: boolean;
}) {
  const recent = members.filter((m) => m.alias !== null).slice(0, FEED_SIZE);
  if (recent.length === 0) return null;

  return (
    <ul
      className="flex max-w-full flex-wrap items-center justify-center gap-[clamp(0.35rem,0.8vw,0.6rem)]"
      aria-label="Últimos en unirse"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {recent.map((m, i) => (
          <motion.li
            key={m.key}
            layout={!reduced}
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.85 }
            }
            animate={{
              opacity: Math.max(0.35, 1 - i * 0.13),
              y: 0,
              scale: 1,
            }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={{ duration: durations.base, ease: easings.decel }}
            className="flex items-center gap-2 rounded-pill border border-white/10 bg-white/[0.05] py-[0.3em] pl-[0.35em] pr-[0.9em] text-[clamp(0.8rem,1.1vw,1.05rem)] font-semibold text-text"
          >
            <span
              aria-hidden
              className="flex h-[1.7em] w-[1.7em] items-center justify-center rounded-full bg-sophia-purple/25 font-display text-[0.85em] font-black text-text"
            >
              {m.alias?.charAt(0)}
            </span>
            {m.alias}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export default LobbyStage;
