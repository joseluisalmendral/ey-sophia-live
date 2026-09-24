"use client";

import { memo, useCallback, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountInTimer, type CountInPhase } from "@/components/atoms/CountInTimer";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { durations, easings } from "@/lib/motion/tokens";
import { teamInitials } from "./anonymize";
import { chipRem } from "./broadcast/chipRem";
import { JoinCode } from "./broadcast/JoinCode";
import { QrFrame } from "./broadcast/QrFrame";
import type { Poll, RankedTeam, Team } from "@/lib/types";

/**
 * LobbyStage — the pre-voting projector board (status draft/countdown).
 *
 * LEFT (36%): the QR (encodes the VOTER url) in a glass frame with four yellow
 * viewfinder corners, "Escanea para unirte" in white, and the typed-entry
 * fallback (JoinCode: "Entra con el código" + the big yellow code — never a
 * URL on the projector).
 * RIGHT (64%): kicker "VOTACIÓN FINAL" + the poll title (balanced, ≤ 2 lines),
 * the presence counter (mint, one ring ping per join) and the finalists as
 * glass rows — no counters, no numbering. Anonymous runs show the REAL
 * finalists here too: identities hide only while the vote is open.
 * COUNTDOWN: the count-in replaces the finalists as the hero of the right
 * column; in the last 5 s it takes the column over (ring + giant seconds) and
 * the title/presence step aside.
 *
 * The bottom 24% of the right column is a layout-reserved strip for the
 * co-host (anchors `lobby-lane` / `lobby-mid`); nothing else renders there.
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
  /** Distinct joins this run (null until the first successful read). */
  joined: number | null;
}

/** "IA Hackathon · Gran final" → two balanced lines, no "·" separators. */
function titleLines(title: string): string[] {
  const parts = title.split(/\s+[·•|—]\s+/).map((p) => p.trim()).filter(Boolean);
  return parts.length === 2 ? parts : [parts.join(" ")];
}

export const LobbyStage = memo(function LobbyStage({
  poll,
  teams,
  liveTeams,
  voterUrl,
  isCountdown,
  opensAt,
  reduced,
  joined,
}: LobbyStageProps) {
  // A future opens_at drives the count-in; only during countdown. Mount-time
  // clock read (lazy state keeps render pure); the stage re-mounts on every
  // status flip and CountInTimer owns the live ticking from there on.
  const [mountedAt] = useState(() => Date.now());
  const showCountIn =
    isCountdown && opensAt !== null && new Date(opensAt).getTime() > mountedAt;
  const [phase, setPhase] = useState<CountInPhase>("count");
  const onPhase = useCallback((p: CountInPhase) => setPhase(p), []);
  const takeover = showCountIn && phase !== "count";

  const cards: Array<Pick<Team, "id" | "name" | "color">> =
    liveTeams.length > 0 ? liveTeams : teams;
  const lines = titleLines(poll.title);

  return (
    <div
      className="relative grid h-full w-full grid-cols-[minmax(0,36%)_minmax(0,64%)] gap-[clamp(1.5rem,3vw,3.5rem)] px-[clamp(1.5rem,3.5vw,4rem)] py-[clamp(0.8rem,2.4vh,2rem)]"
      style={{ "--countin-ring": "min(50vh, 30vw)" } as CSSProperties}
    >
      {/* LEFT — join column */}
      <div className="flex min-w-0 flex-col items-center justify-center gap-[clamp(0.8rem,2.4vh,2rem)] text-center">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: durations.slow, ease: easings.decel }}
          data-mascot-keepout="qr"
        >
          <QrFrame value={voterUrl} className="w-[min(24vw,42vh)]" />
        </motion.div>

        <span className="font-display text-proj-h2 font-black leading-none text-text">
          Escanea para unirte
        </span>

        <JoinCode code={poll.joinCode} size="hero" reduced={reduced} />
      </div>

      {/* RIGHT — programme column + reserved mascot strip (bottom 24%). */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <div
          className={[
            "flex min-h-0 flex-1 flex-col justify-center gap-[clamp(0.9rem,2.4vh,2rem)]",
            takeover ? "items-center" : "items-stretch",
          ].join(" ")}
        >
          <AnimatePresence initial={false}>
            {!takeover && (
              <motion.div
                key="head"
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: durations.slow, ease: easings.decel }}
                className="flex items-end justify-between gap-[clamp(1rem,2vw,2rem)]"
              >
                <div className="flex min-w-0 flex-col gap-[clamp(0.3rem,0.9vh,0.7rem)]" data-mascot-keepout="title">
                  <span className="font-display text-proj-label font-extrabold uppercase leading-none tracking-[0.22em] text-ey-yellow">
                    Votación final
                  </span>
                  <h1
                    className="line-clamp-2 font-display text-proj-h1 font-black leading-[1.02] text-text"
                    style={{ textWrap: "balance" }}
                  >
                    {lines.map((l, i) => (
                      <span key={i} className="block">
                        {l}
                      </span>
                    ))}
                  </h1>
                </div>
                <Presence joined={joined} />
              </motion.div>
            )}
          </AnimatePresence>

          {showCountIn ? (
            <div
              className={takeover ? "self-center" : "self-start"}
              data-mascot-keepout="countdown"
            >
              <CountInTimer opensAt={opensAt} reduced={reduced} onPhase={onPhase} />
            </div>
          ) : isCountdown ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={reduced ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
              transition={reduced ? { duration: durations.base } : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="font-display text-proj-h2 font-black uppercase tracking-[0.12em] text-ey-yellow"
              data-mascot-keepout="countdown"
            >
              Preparados…
            </motion.span>
          ) : (
            <Finalists cards={cards} reduced={reduced} />
          )}
        </div>
        {/* Reserved co-host strip (layout, not decoration). */}
        <div className="h-[24%] shrink-0" aria-hidden />
      </div>

      {/* Mascot anchors (layout-reserved, empty): the two ends of the bottom
          strip of the right column + the top-right corner. The host validates
          each against the keep-outs at runtime and skips any that collide. */}
      <div
        data-mascot-anchor="lobby-lane"
        data-mascot-size="220"
        data-mascot-bubble="left,above-left"
        data-mascot-bubble-max="0.36"
        data-mascot-edge="right"
        className="pointer-events-none absolute bottom-[3%] right-[2%] h-[24%] w-[22%]"
        aria-hidden
      />
      <div
        data-mascot-anchor="lobby-mid"
        data-mascot-size="190"
        data-mascot-bubble="above-right,right,above"
        data-mascot-bubble-max="0.32"
        data-mascot-edge="bottom"
        className="pointer-events-none absolute bottom-[3%] left-[40%] h-[22%] w-[14%]"
        aria-hidden
      />
      <div
        data-mascot-anchor="lobby-top"
        data-mascot-size="170"
        data-mascot-bubble="left,below,above-left"
        data-mascot-bubble-max="0.4"
        data-mascot-edge="right"
        className="pointer-events-none absolute right-[2%] top-[1%] h-[19%] w-[15%]"
        aria-hidden
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */

/** Joined counter: mint number + label; the mint dot pings once per join. */
function Presence({ joined }: { joined: number | null }) {
  if (joined === null || joined <= 0) return null;
  return (
    <div className="flex shrink-0 flex-col items-end gap-[0.45rem]" data-mascot-keepout="counter">
      <span className="font-display text-proj-number font-black leading-none text-power-green tabular-nums">
        <CountUp value={joined} aria-label={`${joined} en la sala`} />
      </span>
      <span className="flex items-center gap-[0.6em] font-display text-proj-label font-extrabold uppercase leading-none tracking-[0.2em] text-text-dim">
        <span className="relative inline-flex h-[0.45em] w-[0.45em]" aria-hidden>
          {/* Re-keyed on every join: the ring restarts (transform/opacity). */}
          <span key={joined} className="presence-ping absolute -inset-[0.45em] rounded-full border-2 border-power-green" />
          <span className="h-full w-full rounded-full bg-power-green" style={{ boxShadow: "0 0 10px var(--color-power-green)" }} />
        </span>
        en la sala
      </span>
    </div>
  );
}

function Finalists({
  cards,
  reduced,
}: {
  cards: Array<Pick<Team, "id" | "name" | "color">>;
  reduced: boolean;
}) {
  const dense = cards.length >= 5;
  const names = cards.map((c) => c.name);
  return (
    <ul
      className={[
        "flex flex-col",
        dense ? "gap-[clamp(0.35rem,0.9vh,0.7rem)]" : "gap-[clamp(0.55rem,1.4vh,1.1rem)]",
      ].join(" ")}
      data-mascot-keepout="finalists"
    >
      {cards.map((team, i) => (
        <motion.li
          key={team.id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduced ? 0 : 0.2 + i * 0.08, duration: durations.base, ease: easings.standard }}
          className={[
            "glass glass--flat flex items-center gap-[clamp(0.8rem,1.4vw,1.4rem)] px-[clamp(0.9rem,1.5vw,1.6rem)]",
            dense ? "py-[clamp(0.4rem,1vh,0.8rem)]" : "py-[clamp(0.7rem,1.6vh,1.2rem)]",
          ].join(" ")}
          style={{ borderRadius: "1.1rem" }}
        >
          <span aria-hidden className="h-[70%] w-1.5 shrink-0 self-center rounded-full" style={{ backgroundColor: team.color }} />
          <TeamColorChip color={team.color} label={teamInitials(team.name, names)} size={dense ? 44 : 52} style={chipRem(dense ? 2.75 : 3.25, teamInitials(team.name, names))} />
          <span
            className={[
              "min-w-0 flex-1 truncate font-display font-extrabold leading-tight text-text",
              dense ? "text-[clamp(1.4rem,2vw,2.6rem)]" : "text-proj-h2",
            ].join(" ")}
          >
            {team.name}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

export default LobbyStage;
