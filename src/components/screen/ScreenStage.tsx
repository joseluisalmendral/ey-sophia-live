"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { CodeBadge } from "@/components/atoms/CodeBadge";
import { CountdownTimer } from "@/components/atoms/CountdownTimer";
import { QrCode } from "@/components/atoms/QrCode";
import { EyBeam } from "@/components/brand/EyBeam";
import { durations, easings } from "@/lib/motion/tokens";
import type {
  ConnectionState,
  Poll,
  PollStatus,
  RankedTeam,
  Team,
} from "@/lib/types";
import {
  anonymizeIdentities,
  anonymizeRankedTeams,
  buildPositionIndex,
} from "./anonymize";
import { BarRace } from "./BarRace";
import { ChartView } from "./ChartView";
import { LobbyStage } from "./LobbyStage";
import { RevealStage } from "./RevealStage";
import { ScreenStageProvider, type RevealBeat, type ScreenStageFrame } from "./ScreenStageContext";

/**
 * ScreenStage — the PRESENTATIONAL projector board (no data hooks, no network).
 *
 * Everything the projector draws lives here; the containers only compute the
 * inputs. Two containers feed it:
 *   - ScreenClient (/screen, /tv): realtime tally + local status flip + lobby
 *     join polling.
 *   - /lab (rehearsal): the virtual-clock scenario engine, no Supabase at all.
 *
 *   draft | countdown  -> LobbyStage  (giant QR to the VOTER url + teased zeros)
 *   open               -> LiveStage   (continuous bar-race OR donut/columns)
 *   closed             -> RevealStage (3-beat suspense -> podium -> fireworks)
 *
 * ANONYMOUS DISPLAY (presentation-only): identities hide ONLY while the vote is
 * OPEN. The lobby (draft/countdown) shows the REAL teams — the room must see
 * their team is in before voting starts — and the reveal (closed) always
 * receives the REAL teams. During open, rows rewrite to identical EMPTY labels
 * with neutral grey shades keyed on the CONFIGURED team position (never the
 * ranking, which would re-identify teams as bars swap). This keys off the
 * DERIVED `status` the container passes (local flip included), so a
 * countdown→open local flip masks at the exact moment the poll opens, before
 * any broadcast lands. Masking happens here, upstream of every chart, so both
 * production and /lab render through the same wall.
 */

const SHOW_NAMES_DEFAULT = true;

export interface ScreenStageProps {
  poll: Poll;
  /** Configured teams (SSR snapshot); the authority for the "no teams" guard. */
  teams: Team[];
  /** Live ranked teams (real identities; masked here while anonymous + open). */
  liveTeams: RankedTeam[];
  /** Absolute URL the on-screen QR encodes — the VOTER url /vote/<join_code>. */
  voterUrl: string;
  /** Effective (derived) status, local flip included. */
  status: PollStatus;
  opensAt: string | null;
  closesAt: string | null;
  /** Distinct lobby joins this run; null until known. */
  joined: number | null;
  connectionState: ConnectionState;
  /** Initial absolute tally resolved — gates the reveal choreography. */
  ready: boolean;
  reduced: boolean;
  /**
   * Mascot host mount point: rendered inside the 16:9 frame, OUTSIDE the
   * stage AnimatePresence and above the stages. Default: nothing.
   */
  mascotSlot?: ReactNode;
}

export function ScreenStage({
  poll,
  teams,
  liveTeams,
  voterUrl,
  status,
  opensAt,
  closesAt,
  joined,
  connectionState,
  ready,
  reduced,
  mascotSlot = null,
}: ScreenStageProps) {
  const showNames = poll.showLegend ? SHOW_NAMES_DEFAULT : false;
  // Reveal beat (suspense → curtain → cameras → podium) reported by RevealStage
  // so the mascot slot can hide itself during the curtain + camera cuts.
  const [revealBeat, setRevealBeat] = useState<RevealBeat | null>(null);

  const positionById = useMemo(() => buildPositionIndex(teams), [teams]);
  const anonymized = poll.anonymousDisplay && status === "open";
  const displayLiveTeams = useMemo(
    () =>
      anonymized ? anonymizeRankedTeams(liveTeams, positionById) : liveTeams,
    [anonymized, liveTeams, positionById],
  );
  const displayTeams = useMemo(
    () => (anonymized ? anonymizeIdentities(teams, positionById) : teams),
    [anonymized, teams, positionById],
  );

  // Graceful guard: a misconfigured poll (no teams) must never render a broken
  // race/donut/podium. Show a calm "in preparation" board instead. Uses the SSR
  // teams as the authority (liveTeams may be empty before the RPC resolves).
  const hasTeams = teams.length > 0;

  // Derived projector data for the mascot slot (read-only, masked upstream).
  const frame = useMemo<ScreenStageFrame>(
    () => ({
      status,
      teams: displayLiveTeams,
      anonymized,
      chartType: poll.chartType,
      opensAt,
      closesAt,
      joined,
      revealBeat: status === "closed" ? revealBeat : null,
    }),
    [status, displayLiveTeams, anonymized, poll.chartType, opensAt, closesAt, joined, revealBeat],
  );

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
        <ScreenStageProvider value={frame}>
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
                <div className="flex items-center gap-3" data-mascot-keepout="header">
                  <EyBeam surface="dark" size={36} label="" />
                  <span className="font-display text-[clamp(0.95rem,1.9vw,1.8rem)] font-black leading-none tracking-tight text-text">
                    <span className="text-sophia-accent glow-sophia">IA</span> HACKATHON
                    <span className="ml-2 text-[clamp(0.6rem,1vw,1rem)] font-bold uppercase tracking-[0.2em] text-text-dim">
                      EN VIVO
                    </span>
                  </span>
                </div>

                {/* Right side: connection meta (live only). The close countdown
                    lives prominently in the LiveStage join rail, not here. */}
                {status === "open" && (
                  <div className="flex items-center gap-[clamp(0.75rem,2vw,1.5rem)]" data-mascot-keepout="status">
                    <ConnectionDot state={connectionState} />
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
                    joined={joined}
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
                      absolute tally has seeded (liveTeams starts empty). */}
                  <RevealStage
                    teams={liveTeams}
                    tieRule={poll.tieRule}
                    reduced={reduced}
                    ready={ready}
                    onBeatChange={setRevealBeat}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mascot host (E3). Outside the stage AnimatePresence so stage
              transitions never remount it. */}
          {mascotSlot}
        </div>
        </ScreenStageProvider>
      </main>
    </ShaderBackground>
  );
}

/* ------------------------------------------------------------------ */

function StageWrap({
  children,
  reduced,
}: {
  children: ReactNode;
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
  liveTeams: RankedTeam[];
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
        <div data-mascot-keepout="qr" className="flex w-full justify-center">
          <QrCode
            value={voterUrl}
            size={280}
            className="w-[min(clamp(200px,15.5vw,300px),34vh)] max-w-full [&_svg]:h-auto [&_svg]:w-full"
          />
        </div>
        <div data-mascot-keepout="code">
          <CodeBadge code={poll.joinCode} caption="Únete" size="inline" />
        </div>
        {/* Prominent close countdown when a duration was configured. Pulses < 10s
            (handled inside CountdownTimer). Server-authoritative from closesAt. */}
        {closesAt && (
          <div
            className="mt-[clamp(0.4rem,1.5vh,1.4rem)] flex flex-col items-center gap-1"
            data-mascot-keepout="countdown"
          >
            <span className="font-display text-[clamp(0.6rem,0.9vw,0.9rem)] font-bold uppercase tracking-[0.22em] text-text-dim">
              Cierra en
            </span>
            <CountdownTimer closesAt={closesAt} size="hero" />
          </div>
        )}
      </div>

      {/* Visualization pane: a reserved TOP BAND for the co-host (mascot at
          either end, bubble extending inwards) and the chart in the remaining
          height, vertically centred. The band is layout, not decoration: the
          chart never grows into it, so the mascot never covers a bar. */}
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="relative h-[18%] w-full shrink-0" aria-hidden>
          <div
            data-mascot-anchor="live-band-right"
            data-mascot-size="190"
            data-mascot-bubble="left,above-left"
            data-mascot-bubble-max="0.44"
            data-mascot-edge="right"
            className="absolute inset-y-0 right-0 w-[19%]"
          />
          <div
            data-mascot-anchor="live-band-left"
            data-mascot-size="180"
            data-mascot-bubble="right,above-right"
            data-mascot-bubble-max="0.44"
            data-mascot-edge="right"
            className="absolute inset-y-0 left-0 w-[19%]"
          />
        </div>
        {/* Bottom-right corner of the pane: free when the race has ≤ 4 rows
            (validated against the chart keep-out at runtime). */}
        <div
          data-mascot-anchor="live-corner"
          data-mascot-size="180"
          data-mascot-bubble="left,above-left"
          data-mascot-bubble-max="0.4"
          data-mascot-edge="right"
          className="pointer-events-none absolute bottom-0 right-0 h-[24%] w-[18%]"
          aria-hidden
        />
        <div className="flex min-h-0 flex-1 flex-col justify-center">
        {/* Suspense badge: discreet but visible — the audience must know the
            hidden identities are intentional drama, not a rendering glitch. */}
        {anonymized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: durations.base }}
            className="mb-[clamp(0.5rem,1.4vh,1rem)] flex items-center justify-center gap-2"
            data-mascot-keepout="badge"
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
          <div className="h-full min-h-0 w-full" data-mascot-keepout="chart">
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
    </div>
  );
});

const ConnectionDot = memo(function ConnectionDot({
  state,
}: {
  state: ConnectionState;
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

export default ScreenStage;
