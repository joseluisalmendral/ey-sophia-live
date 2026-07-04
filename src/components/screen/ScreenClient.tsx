"use client";

import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { CodeBadge } from "@/components/atoms/CodeBadge";
import { CountdownTimer } from "@/components/atoms/CountdownTimer";
import { QrCode } from "@/components/atoms/QrCode";
import { EyBeam } from "@/components/brand/EyBeam";
import { useLiveTally } from "@/lib/realtime/useLiveTally";
import { useLocalStatusFlip } from "@/lib/polling/useLocalStatusFlip";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import { durations, easings } from "@/lib/motion/tokens";
import type { Poll, PollStatus, Team } from "@/lib/types";
import {
  anonymizeIdentities,
  anonymizeRankedTeams,
  buildPositionIndex,
} from "./anonymize";
import { BarRace } from "./BarRace";
import { ChartView } from "./ChartView";
import { LobbyStage } from "./LobbyStage";
import { RevealStage } from "./RevealStage";

/**
 * ScreenClient — the projector showpiece (/screen/[poll]).
 *
 * 16:9, dark, projector-legible, layered over the cosmic ShaderBackground. The
 * displayed stage is derived from the live poll status (via useLiveTally), so an
 * admin opening/closing the poll flips the screen in realtime with no reload:
 *
 *   draft | countdown  -> LobbyStage  (giant QR to the VOTER url + teased zeros)
 *   open               -> LiveStage   (continuous bar-race OR donut/columns)
 *   closed             -> RevealStage (3-beat suspense -> podium -> fireworks)
 *
 * A persistent connection indicator (subtle) reflects the realtime state without
 * ever blanking the board on a gap (the hook keeps last counts).
 */

const SHOW_NAMES_DEFAULT = true;

export interface ScreenClientProps {
  poll: Poll;
  teams: Team[];
  /** Absolute URL the on-screen QR encodes — the VOTER url /vote/<join_code>. */
  voterUrl: string;
}

export function ScreenClient({ poll, teams, voterUrl }: ScreenClientProps) {
  const reduced = useReducedMotionPref();
  // Effective status derived from the SSR snapshot ALONE (local flip included):
  // before the first status broadcast the hook has no status, so this is the
  // only signal that the poll is already open — it keeps the open-poll resync
  // backstop running for a screen that mounts mid-vote.
  const ssrEffectiveStatus = useLocalStatusFlip(
    poll.status,
    poll.opensAt,
    poll.closesAt,
  );
  const live = useLiveTally(poll.id, {
    assumeOpen: ssrEffectiveStatus === "open",
  });

  // Live status wins once realtime is up; fall back to the server snapshot.
  const baseStatus: PollStatus = live.status ?? poll.status;
  // Once a status broadcast has arrived, its opens_at/closes_at are
  // authoritative INCLUDING null: after a relaunch the server clears both, and
  // falling back to the stale SSR snapshot would let the local flip re-derive
  // open/closed from the previous run's deadlines. The SSR snapshot is only
  // trusted before the first broadcast.
  const opensAt = live.status !== null ? live.opensAt : poll.opensAt;
  const closesAt = live.status !== null ? live.closesAt : poll.closesAt;

  // LOCAL FLIP (same as the voter's): when a count-in is configured, derive
  // `open` CLIENT-SIDE the instant opens_at passes instead of waiting for the
  // status broadcast round-trip. countdown → live then lands on the projector
  // at the exact same wall-clock moment the phones flip to the vote cards.
  // Forward-only; the realtime `status` broadcast remains the authority.
  const status = useLocalStatusFlip(baseStatus, opensAt, closesAt);
  const showNames = poll.showLegend ? SHOW_NAMES_DEFAULT : false;

  // ANONYMOUS DISPLAY (presentation-only): identities hide ONLY while the vote
  // is OPEN. The lobby (draft/countdown) shows the REAL teams — the room must
  // see their team is in before voting starts — and the reveal (closed) always
  // receives the REAL teams. During open, rows rewrite to identical "???"
  // labels with indigo shades keyed on the CONFIGURED team position (never the
  // ranking, which would re-identify teams as bars swap). This keys off the
  // DERIVED `status` (local flip included), so a countdown→open local flip
  // masks at the exact moment the poll opens, before any broadcast lands.
  // Data flow (useLiveTally) is untouched; only the render props are masked.
  const positionById = useMemo(() => buildPositionIndex(teams), [teams]);
  const anonymized = poll.anonymousDisplay && status === "open";
  const displayLiveTeams = useMemo(
    () =>
      anonymized ? anonymizeRankedTeams(live.teams, positionById) : live.teams,
    [anonymized, live.teams, positionById],
  );
  const displayTeams = useMemo(
    () => (anonymized ? anonymizeIdentities(teams, positionById) : teams),
    [anonymized, teams, positionById],
  );

  // Graceful guard: a misconfigured poll (no teams) must never render a broken
  // race/donut/podium. Show a calm "in preparation" board instead. Uses the SSR
  // teams as the authority (live.teams may be empty before the RPC resolves).
  const hasTeams = teams.length > 0;
  if (!hasTeams) {
    return (
      <ShaderBackground>
        <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden px-8 text-center">
          <div className="flex flex-col items-center gap-6">
            <EyBeam surface="dark" size={64} label="" />
            <h1 className="font-display text-[clamp(2rem,5vw,4rem)] font-black text-text">
              {poll.title}
            </h1>
            <p className="max-w-[40ch] text-[clamp(1rem,2vw,1.5rem)] font-semibold text-text-dim">
              Preparando la votación… todavía no hay equipos configurados.
            </p>
          </div>
        </main>
      </ShaderBackground>
    );
  }

  return (
    <ShaderBackground>
      {/* 16:9 projector frame. Aspect-locked + centered so it reads identically
          on any projector; full-bleed dark stage underneath. */}
      <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden">
        <div className="relative flex aspect-video max-h-[100dvh] w-full max-w-[177.78vh] flex-col">
          {/* Top brand bar (hidden during reveal so the finale owns the stage). */}
          <AnimatePresence>
            {status !== "closed" && (
              <motion.header
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.base, ease: easings.standard }}
                className="z-10 flex shrink-0 items-center justify-between px-[clamp(1.5rem,4vw,4rem)] pt-[clamp(0.8rem,2.5vh,2rem)]"
              >
                <div className="flex items-center gap-3">
                  <EyBeam surface="dark" size={36} label="" />
                  <span className="font-display text-[clamp(1.1rem,2vw,1.8rem)] font-black leading-none text-text">
                    Soph<span className="text-sophia-accent glow-sophia">IA</span>
                    <span className="ml-2 text-[clamp(0.7rem,1.1vw,1rem)] font-bold uppercase tracking-[0.25em] text-text-dim">
                      EN VIVO
                    </span>
                  </span>
                </div>

                {/* Right side: connection meta (live only). The close countdown
                    lives prominently in the LiveStage join rail, not here. */}
                {status === "open" && (
                  <div className="flex items-center gap-[clamp(0.75rem,2vw,1.5rem)]">
                    <ConnectionDot state={live.connectionState} />
                  </div>
                )}
              </motion.header>
            )}
          </AnimatePresence>

          {/* Stage body */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              {(status === "draft" || status === "countdown") && (
                <StageWrap key="lobby" reduced={reduced}>
                  <LobbyStage
                    poll={poll}
                    teams={displayTeams}
                    liveTeams={displayLiveTeams}
                    voterUrl={voterUrl}
                    isCountdown={status === "countdown"}
                    opensAt={opensAt}
                    reduced={reduced}
                  />
                </StageWrap>
              )}

              {status === "open" && (
                <StageWrap key="live" reduced={reduced}>
                  <LiveStage
                    poll={poll}
                    voterUrl={voterUrl}
                    liveTeams={displayLiveTeams}
                    showNames={showNames}
                    anonymized={anonymized}
                    closesAt={closesAt}
                    reduced={reduced}
                  />
                </StageWrap>
              )}

              {status === "closed" && (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: durations.base }}
                  className="absolute inset-0"
                >
                  {/* `ready` gates the reveal choreography until the initial
                      absolute tally has seeded (live.teams starts empty). */}
                  <RevealStage
                    teams={live.teams}
                    tieRule={poll.tieRule}
                    reduced={reduced}
                    ready={live.ready}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </ShaderBackground>
  );
}

/* ------------------------------------------------------------------ */

function StageWrap({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
      transition={{ duration: durations.base, ease: easings.standard }}
      className="absolute inset-0 flex flex-col"
    >
      {children}
    </motion.div>
  );
}

/**
 * LiveStage — the OPEN state. A persistent compact QR/code rail on the left so
 * latecomers can still join, and the live visualization on the right driven by
 * the poll's chart_type.
 */
const LiveStage = memo(function LiveStage({
  poll,
  voterUrl,
  liveTeams,
  showNames,
  anonymized,
  closesAt,
  reduced,
}: {
  poll: Poll;
  voterUrl: string;
  liveTeams: ReturnType<typeof useLiveTally>["teams"];
  showNames: boolean;
  /** Anonymous-display run: rows are already masked; adds the suspense badge. */
  anonymized: boolean;
  closesAt: string | null;
  reduced: boolean;
}) {
  const isDivRace = poll.chartType === "bar_race";

  return (
    <div className="grid h-full w-full grid-cols-[minmax(0,26%)_minmax(0,74%)] items-center gap-[clamp(1rem,2.5vw,2.5rem)] px-[clamp(1.25rem,3vw,3rem)] pb-[clamp(1rem,3vh,2.5rem)] pt-[clamp(0.5rem,1.5vh,1.5rem)]">
      {/* Persistent join rail — the QR stays big enough to scan from the back
          of the room (fluid ~200-300px, capped by viewport height so it never
          crowds the countdown on short screens). */}
      <div className="flex min-w-0 flex-col items-center gap-[clamp(0.6rem,1.6vh,1.2rem)]">
        <span className="font-display text-[clamp(0.7rem,1.1vw,1.05rem)] font-bold uppercase tracking-[0.22em] text-text-dim">
          Escanea para unirte
        </span>
        <QrCode
          value={voterUrl}
          size={280}
          className="w-[min(clamp(200px,15.5vw,300px),34vh)] max-w-full [&_svg]:h-auto [&_svg]:w-full"
        />
        <CodeBadge code={poll.joinCode} caption="Únete" size="inline" />
        {/* Prominent close countdown when a duration was configured. Pulses < 10s
            (handled inside CountdownTimer). Server-authoritative from closesAt. */}
        {closesAt && (
          <div className="mt-[clamp(0.4rem,1.5vh,1.4rem)] flex flex-col items-center gap-1">
            <span className="font-display text-[clamp(0.6rem,0.9vw,0.9rem)] font-bold uppercase tracking-[0.22em] text-text-dim">
              Cierra en
            </span>
            <CountdownTimer closesAt={closesAt} size="hero" />
          </div>
        )}
      </div>

      {/* Visualization */}
      <div className="flex h-full min-h-0 flex-col justify-center">
        {/* Suspense badge: discreet but visible — the audience must know the
            hidden identities are intentional drama, not a rendering glitch. */}
        {anonymized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: durations.base }}
            className="mb-[clamp(0.5rem,1.4vh,1rem)] flex items-center justify-center gap-2"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-sophia-accent"
              style={{ boxShadow: "0 0 12px var(--color-sophia-accent)" }}
            />
            <span className="font-display text-[clamp(0.75rem,1.2vw,1.1rem)] font-bold uppercase tracking-[0.24em] text-text-dim">
              Identidades ocultas — se revelan al final
            </span>
          </motion.div>
        )}
        {isDivRace ? (
          <BarRace teams={liveTeams} showNames={showNames} reduced={reduced} />
        ) : (
          <div className="h-full min-h-0 w-full">
            <ChartView
              type={poll.chartType === "donut" ? "donut" : "columns"}
              teams={liveTeams}
              showLegend={poll.showLegend}
              showNames={showNames}
            />
          </div>
        )}
      </div>
    </div>
  );
});

const ConnectionDot = memo(function ConnectionDot({
  state,
}: {
  state: ReturnType<typeof useLiveTally>["connectionState"];
}) {
  const live = state === "live";
  const color = live
    ? "var(--color-power-green)"
    : state === "reconnecting"
      ? "var(--color-ey-yellow)"
      : "var(--color-ey-gray1)";
  const label =
    state === "live"
      ? "En directo"
      : state === "reconnecting"
        ? "Reconectando…"
        : "Conectando…";
  return (
    <span className="flex items-center gap-2 text-[clamp(0.7rem,1vw,0.95rem)] font-semibold uppercase tracking-[0.15em] text-text-dim">
      <motion.span
        animate={live ? { opacity: [1, 0.4, 1] } : { opacity: 0.7 }}
        transition={live ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
});

export default ScreenClient;
