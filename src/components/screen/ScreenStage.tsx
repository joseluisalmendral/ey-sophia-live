"use client";

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { CountdownTimer } from "@/components/atoms/CountdownTimer";
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
  anonSeed,
  anonymousIdentity,
  applyAnonIdentity,
  identityFromMasked,
} from "./anonymize";
import { BarRace } from "./BarRace";
import { ChartView } from "./ChartView";
import { LobbyStage } from "./LobbyStage";
import { RevealStage } from "./RevealStage";
import { ScreenStageProvider, type RevealBeat, type ScreenStageFrame } from "./ScreenStageContext";
import { BeamStinger, type StingerVariant } from "./broadcast/BeamStinger";
import { JoinCode } from "./broadcast/JoinCode";
import { LiveBug } from "./broadcast/LiveBug";
import { LowerThird } from "./broadcast/LowerThird";
import { QrFrame } from "./broadcast/QrFrame";
import { Sep } from "./broadcast/Sep";

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
 * OPEN. The lobby (draft/countdown) shows the REAL finalists — the room must
 * see their team is in before voting starts — and the reveal (closed) always
 * receives the REAL teams. During open, every row reads "?" and paints with
 * its run-seeded anonymous color (see anonymize.ts: distinct palette far from
 * every real color, deranged against the lobby order, seed = pollId+runSeq,
 * the same identities the server wall ships). This keys off the DERIVED
 * `status` the container passes (local flip included), so a countdown→open
 * local flip masks at the exact moment the poll opens, before any broadcast
 * lands. Masking happens here, upstream of every chart, so both production
 * and /lab render through the same wall.
 *
 * BROADCAST GRAMMAR (E6): the header carries the live bug; lobby/count-in →
 * live and live → reveal are stitched by the EY-beam stinger (count-in → live
 * opens with a "¡YA!" frame); a lower third captions the open entry. Stingers
 * fire only on a real status transition, never on a mid-show reload.
 */

const SHOW_NAMES_DEFAULT = true;

/**
 * Projector root scale: the stage type is fluid (vw) with rem caps tuned for a
 * 1080p frame. Above 1920×1080 CSS px (a 4K projector at 100 % scaling) the
 * caps would freeze the type while the frame keeps growing, so the root font
 * grows with the 16:9 frame instead (never below the 16px default). 1080p and
 * smaller are untouched.
 */
function useProjectorRootScale() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.fontSize;
    root.style.fontSize = "max(16px, min(calc(100vw / 120), calc(100vh / 67.5)))";
    return () => {
      root.style.fontSize = prev;
    };
  }, []);
}

export interface ScreenStageProps {
  poll: Poll;
  /** Configured teams (SSR snapshot); the authority for the "no teams" guard. */
  teams: Team[];
  /**
   * `teams` already carry the anonymous identities (server wall: the page was
   * loaded while open + anonymous). They are then reused as-is, so server and
   * client agree byte for byte.
   */
  teamsMasked?: boolean;
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
  teamsMasked = false,
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
  useProjectorRootScale();
  // Reveal beat (suspense → curtain → cameras → podium) reported by RevealStage
  // so the mascot slot can hide itself during the curtain + camera cuts.
  const [revealBeat, setRevealBeat] = useState<RevealBeat | null>(null);

  // Run-scoped anonymous identities keyed by team id (realtime tallies map
  // through the same ids). Computed from the configured (lobby) order.
  const runSeq = poll.runSeq ?? 1;
  const identity = useMemo(
    () =>
      teamsMasked
        ? identityFromMasked(teams)
        : anonymousIdentity(teams, anonSeed(poll.id, runSeq)),
    [teamsMasked, teams, poll.id, runSeq],
  );
  const anonymized = poll.anonymousDisplay && status === "open";
  const displayLiveTeams = useMemo(
    () => (anonymized ? applyAnonIdentity(liveTeams, identity) : liveTeams),
    [anonymized, liveTeams, identity],
  );
  const totalVotes = useMemo(
    () => displayLiveTeams.reduce((s, t) => s + t.count, 0),
    [displayLiveTeams],
  );

  // Stingers: derived from real status transitions (state-during-render
  // pattern, no effects). A reload mid-show starts with no stinger and no
  // lower third.
  const [prevStatus, setPrevStatus] = useState(status);
  const [stinger, setStinger] = useState<{ id: number; variant: StingerVariant } | null>(null);
  const [stingerSeq, setStingerSeq] = useState(0);
  const [liveFresh, setLiveFresh] = useState(false);
  if (status !== prevStatus) {
    setPrevStatus(status);
    // Leaving the reveal (relaunch: closed -> draft) drops the last run's
    // beat, so the next close starts from "no beat" instead of flashing the
    // old "podium" into the mascot stage for a frame.
    if (prevStatus === "closed") setRevealBeat(null);
    const fromLobby = prevStatus === "draft" || prevStatus === "countdown";
    if (status === "open" && fromLobby) {
      setStingerSeq(stingerSeq + 1);
      setStinger({ id: stingerSeq + 1, variant: prevStatus === "countdown" ? "ya" : "wipe" });
      setLiveFresh(true);
    } else if (status === "closed" && prevStatus === "open") {
      setStingerSeq(stingerSeq + 1);
      setStinger({ id: stingerSeq + 1, variant: "wipe" });
    }
  }
  const endStinger = useCallback(() => setStinger(null), []);

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
                  <EyBeam surface="dark" size={36} label="" style={{ height: "2.25rem", width: "4.5rem" }} />
                  <span className="font-display text-[clamp(0.95rem,1.9vw,1.8rem)] font-black leading-none tracking-tight text-text">
                    <span className="text-sophia-accent glow-sophia">IA</span> HACKATHON
                  </span>
                </div>

                {/* Right side: the broadcast live bug (state + vote total;
                    also the honest realtime-connection indicator). */}
                <div className="flex items-center" data-mascot-keepout="status">
                  <LiveBug
                    status={status}
                    opensAt={opensAt}
                    closesAt={closesAt}
                    total={totalVotes}
                    connectionState={connectionState}
                  />
                </div>
              </motion.header>
            )}
          </AnimatePresence>

          {/* Stage body */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              {(status === "draft" || status === "countdown") && (
                <StageWrap key="lobby" stage="lobby" reduced={reduced}>
                  <LobbyStage
                    poll={poll}
                    teams={teams}
                    liveTeams={liveTeams}
                    voterUrl={voterUrl}
                    isCountdown={status === "countdown"}
                    opensAt={opensAt}
                    reduced={reduced}
                    joined={joined}
                  />
                </StageWrap>
              )}

              {status === "open" && (
                <StageWrap key="live" stage="live" reduced={reduced}>
                  <LiveStage
                    poll={poll}
                    voterUrl={voterUrl}
                    liveTeams={displayLiveTeams}
                    showNames={showNames}
                    anonymized={anonymized}
                    closesAt={closesAt}
                    reduced={reduced}
                    fresh={liveFresh}
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

          {/* Stage stinger (above everything, transform-only, one-shot). */}
          {stinger && (
            <BeamStinger
              key={stinger.id}
              variant={stinger.variant}
              reduced={reduced}
              onDone={endStinger}
            />
          )}
        </div>
        </ScreenStageProvider>
      </main>
    </ShaderBackground>
  );
}

/* ------------------------------------------------------------------ */

function StageWrap({
  children,
  stage,
  reduced,
}: {
  children: ReactNode;
  /** QA hook (data-stage): lets /lab scan exactly one stage's DOM. */
  stage: "lobby" | "live";
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
      transition={{ duration: durations.base, ease: easings.standard }}
      className="absolute inset-0 flex flex-col"
      data-stage={stage}
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
  fresh,
}: {
  poll: Poll;
  voterUrl: string;
  liveTeams: RankedTeam[];
  showNames: boolean;
  /** Anonymous-display run: rows are already masked; adds the suspense badge. */
  anonymized: boolean;
  closesAt: string | null;
  reduced: boolean;
  /** Entered through a real open transition: caption it with the lower third. */
  fresh: boolean;
}) {
  const isDivRace = poll.chartType === "bar_race";

  return (
    <div className="relative grid h-full w-full grid-cols-[minmax(0,26%)_minmax(0,74%)] items-center gap-[clamp(1rem,2.5vw,2.5rem)] px-[clamp(1.25rem,3vw,3rem)] pb-[clamp(1rem,3vh,2.5rem)] pt-[clamp(0.5rem,1.5vh,1.5rem)]">
      {/* Persistent join rail — the QR stays big enough to scan from the back
          of the room (fluid ~200-300px, capped by viewport height so it never
          crowds the countdown on short screens). */}
      <div className="flex min-w-0 flex-col items-center gap-[clamp(0.6rem,1.8vh,1.4rem)]">
        <span className="font-display text-proj-label font-extrabold uppercase leading-none tracking-[0.16em] text-text">
          Escanea para unirte
        </span>
        <div data-mascot-keepout="qr" className="flex w-full justify-center">
          <QrFrame value={voterUrl} className="w-[min(13vw,25vh)]" />
        </div>
        <JoinCode code={poll.joinCode} size="rail" reduced={reduced} />
        {/* Prominent close countdown when a duration was configured. Pulses < 10s
            (handled inside CountdownTimer). Server-authoritative from closesAt. */}
        {closesAt && (
          <div
            className="mt-[clamp(0.3rem,1.2vh,1.2rem)] flex flex-col items-center gap-[0.2rem]"
            data-mascot-keepout="countdown"
          >
            <span className="font-display text-proj-label font-extrabold uppercase leading-none tracking-[0.18em] text-text-dim">
              Cierra en
            </span>
            <CountdownTimer closesAt={closesAt} size="hero" className="text-proj-number!" />
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
            className="mb-[clamp(0.6rem,1.8vh,1.4rem)] flex justify-center"
          >
            <span
              className="glass glass--flat flex items-center gap-[0.7em] px-[1.1em] py-[0.55em] font-display text-proj-label font-extrabold uppercase leading-none tracking-[0.18em] text-text/80"
              style={{ borderRadius: 9999 }}
              data-mascot-keepout="badge"
            >
              <svg viewBox="0 0 24 24" className="h-[1.05em] w-auto shrink-0 text-ey-yellow" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="4" y="11" width="16" height="10" rx="2.5" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Identidades ocultas
              <Sep className="mx-[0.2em]!" />
              se revelan al final
            </span>
          </motion.div>
        )}
        {isDivRace ? (
          <BarRace teams={liveTeams} showNames={showNames} reduced={reduced} anonymized={anonymized} />
        ) : (
          <div className="h-full min-h-0 w-full" data-mascot-keepout="chart">
            <ChartView
              type={poll.chartType === "donut" ? "donut" : "columns"}
              teams={liveTeams}
              showLegend={poll.showLegend}
              showNames={showNames}
              anonymized={anonymized}
            />
          </div>
        )}
        </div>
      </div>

      {/* Lower third on the open entry: bottom-left of the frame, over the
          rail's free foot (never over the chart, the QR or the countdown). */}
      {fresh && (
        <LowerThird
          kicker="En directo"
          title="¡Votación abierta!"
          body="Elige equipo y vota desde tu móvil"
          reduced={reduced}
          delayMs={reduced ? 300 : 1000}
          className="absolute bottom-[clamp(0.5rem,1.4vh,1.2rem)] left-[clamp(1.25rem,3vw,3rem)] z-20"
        />
      )}
    </div>
  );
});

export default ScreenStage;
