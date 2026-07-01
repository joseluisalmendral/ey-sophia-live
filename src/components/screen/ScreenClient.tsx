"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { CodeBadge } from "@/components/atoms/CodeBadge";
import { CountdownTimer } from "@/components/atoms/CountdownTimer";
import { QrCode } from "@/components/atoms/QrCode";
import { EyBeam } from "@/components/brand/EyBeam";
import { useLiveTally } from "@/lib/realtime/useLiveTally";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import { durations, easings } from "@/lib/motion/tokens";
import type { Poll, PollStatus, Team } from "@/lib/types";
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
  const live = useLiveTally(poll.id);

  // Live status wins once realtime is up; fall back to the server snapshot.
  const status: PollStatus = live.status ?? poll.status;
  const closesAt = live.closesAt ?? poll.closesAt;
  const showNames = poll.showLegend ? SHOW_NAMES_DEFAULT : false;

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
                    Soph<span className="text-ey-yellow">IA</span>
                    <span className="ml-2 text-[clamp(0.7rem,1.1vw,1rem)] font-bold uppercase tracking-[0.25em] text-text-dim">
                      Live
                    </span>
                  </span>
                </div>

                {/* Right side: race-time meta (live only). */}
                {status === "open" && (
                  <div className="flex items-center gap-[clamp(0.75rem,2vw,1.5rem)]">
                    {closesAt && <CountdownTimer closesAt={closesAt} size="chip" />}
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
                    teams={teams}
                    liveTeams={live.teams}
                    voterUrl={voterUrl}
                    isCountdown={status === "countdown"}
                    reduced={reduced}
                  />
                </StageWrap>
              )}

              {status === "open" && (
                <StageWrap key="live" reduced={reduced}>
                  <LiveStage
                    poll={poll}
                    voterUrl={voterUrl}
                    liveTeams={live.teams}
                    showNames={showNames}
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
                  <RevealStage teams={live.teams} tieRule={poll.tieRule} reduced={reduced} />
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
  reduced,
}: {
  poll: Poll;
  voterUrl: string;
  liveTeams: ReturnType<typeof useLiveTally>["teams"];
  showNames: boolean;
  reduced: boolean;
}) {
  const isDivRace = poll.chartType === "bar_race";

  return (
    <div className="grid h-full w-full grid-cols-[minmax(0,18%)_minmax(0,82%)] items-center gap-[clamp(1rem,3vw,3rem)] px-[clamp(1.5rem,4vw,4rem)] pb-[clamp(1rem,3vh,2.5rem)] pt-[clamp(0.5rem,1.5vh,1.5rem)]">
      {/* Persistent join rail */}
      <div className="flex flex-col items-center gap-[clamp(0.6rem,1.6vh,1.2rem)]">
        <QrCode value={voterUrl} size={140} />
        <CodeBadge code={poll.joinCode} caption="Únete" size="inline" />
      </div>

      {/* Visualization */}
      <div className="flex h-full min-h-0 flex-col justify-center">
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
