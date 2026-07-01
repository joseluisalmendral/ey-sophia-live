"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { durations } from "@/lib/motion/tokens";
import { fireConfettiBurst, startFireworksFinale } from "@/lib/effects/fireworks";
import { playWinnerSting, type WinnerStingHandle } from "@/lib/effects/winnerSting";
import { Podium } from "./Podium";
import { resolveReveal, type RevealOutcome } from "./winner";
import type { RankedTeam, TieRule } from "@/lib/types";

/**
 * RevealStage — the CLOSED state finale: a 3-beat reveal choreography.
 *
 * Beats (driven by a single timed sequence; respects reduced-motion):
 *   (a) FREEZE + DIM  — the stage dims, suspense kicker fades in.
 *   (b) SUSPENSE HOLD — "Calculando ganador…" shimmer for ~2.4s. The pause IS
 *       the finale.
 *   (c) PODIUM        — the top-3 morph into the Olympic-asymmetry podium
 *       (Podium handles the rise + crown drop + score slam), then a confetti
 *       edge-burst at the landing frame + a WebAudio triumphant sting, then a
 *       ~4s sustained fireworks finale (rising shells + airbursts) that STOPS
 *       (never persistent).
 *
 * Finale engine note: both the edge-burst and the sustained "fireworks" are
 * driven by canvas-confetti (airburst shells launched on an interval), which is
 * now LAZY-loaded from src/lib/effects/fireworks.ts — it only downloads when the
 * reveal actually fires. The audio sting is WebAudio-synthesized in code
 * (src/lib/effects/winnerSting.ts); no asset is shipped.
 *
 * Tie + zero-vote: winner resolution is delegated to resolveReveal(); a zero-vote
 * close renders a designed "Sin votos esta vez" state (no crown, no crash).
 *
 * Reduced motion: the whole thing collapses to crossfades — static crown (Podium),
 * no confetti/fireworks/audio, shorter suspense.
 */

type Beat = "suspense" | "podium";

export interface RevealStageProps {
  teams: RankedTeam[];
  tieRule: TieRule;
  reduced: boolean;
  /**
   * True once the initial absolute tally (get_results) has resolved. The
   * choreography does NOT start until then: a screen that mounts on an already
   * closed poll would otherwise run the reveal against an empty tally (silent
   * finale + a false "Sin votos esta vez" podium while real votes are in flight).
   */
  ready: boolean;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * useRevealChoreography — owns all imperative reveal behavior:
 * the beat state machine + timers, the confetti/fireworks engine (with cleanup),
 * and the WebAudio winner sting. Returns the current beat plus the mute state
 * and toggle. Consumers become pure presentation over `beat` + `muted`.
 */
function useRevealChoreography(
  outcome: RevealOutcome,
  reduced: boolean,
  ready: boolean,
) {
  const [beat, setBeat] = useState<Beat>("suspense");
  const [scope, animate] = useAnimate();

  // useLatest: the choreography effect reads the outcome at FIRE time (after the
  // suspense beat), never from a mount-time closure — live.teams seeds async, so
  // the mount-time outcome is usually the empty zero-votes snapshot.
  const outcomeRef = useRef(outcome);
  useEffect(() => {
    outcomeRef.current = outcome;
  }, [outcome]);

  // Audio sting: attempted best-effort at the crown/confetti landing beat.
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  // Mirror into the ref from an effect (never during render — React Compiler rule);
  // the choreography effect reads `.current` at the fire moment.
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  const stingRef = useRef<WinnerStingHandle | null>(null);

  useEffect(() => {
    // Gate the whole choreography on the initial tally being seeded: the beats
    // and timings stay exactly as designed, they just start from real data.
    if (!ready) return;
    let cancelled = false;
    let stopFireworks: (() => void) | null = null;
    const suspenseMs = reduced ? 700 : durations.suspense * 1000;

    const run = async () => {
      // Beat (a) dim is handled by the scope's animate below.
      await animate(scope.current, { opacity: 1 }, { duration: durations.base / 1.5 });

      await wait(suspenseMs);
      if (cancelled) return;
      setBeat("podium");

      // Fire-time outcome (not the mount-time closure): decides the celebration
      // from the real final tally.
      const finalOutcome = outcomeRef.current;
      if (!reduced && !finalOutcome.zeroVotes && finalOutcome.winners.length > 0) {
        // Confetti edge-burst at podium landing (high zIndex, reduced-safe).
        await wait(900);
        if (cancelled) return;
        void fireConfettiBurst();

        // WebAudio triumphant sting at the crown/confetti beat (best-effort).
        if (!mutedRef.current) {
          stingRef.current = playWinnerSting();
        }

        // Sustained fireworks finale: airburst shells on an interval, then STOP.
        stopFireworks = startFireworksFinale(durations.fireworks * 1000);
      }
    };
    void run();

    return () => {
      cancelled = true;
      stopFireworks?.();
      stingRef.current?.stop();
      stingRef.current = null;
    };
    // Runs once when `ready` flips true (or immediately if already true on mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) {
        // Muting mid-reveal: stop any in-flight sting.
        stingRef.current?.stop();
        stingRef.current = null;
      }
      return next;
    });
  }, []);

  return { beat, scope, muted, toggleMute };
}

export function RevealStage({ teams, tieRule, reduced, ready }: RevealStageProps) {
  const outcome = resolveReveal(teams, tieRule);
  const { beat, scope, muted, toggleMute } = useRevealChoreography(
    outcome,
    reduced,
    ready,
  );

  return (
    <div ref={scope} className="relative h-full w-full" style={{ opacity: 0 }}>
      {/* Dim veil over the frozen stage. */}
      <div className="pointer-events-none absolute inset-0 bg-cosmic-deep/55" aria-hidden />

      {/* Mute toggle (always available). */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute right-[clamp(1rem,2vw,2rem)] top-[clamp(1rem,2vh,2rem)] z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-text-dim backdrop-blur transition-colors hover:text-text"
        aria-label={muted ? "Activar sonido" : "Silenciar"}
      >
        {muted ? <SpeakerOff /> : <SpeakerOn />}
      </button>

      <AnimatePresence mode="wait">
        {beat === "suspense" && (
          <motion.div
            key="suspense"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.base }}
            className="relative z-10 flex h-full flex-col items-center justify-center gap-6 text-center"
          >
            <span className="text-[clamp(0.9rem,1.4vw,1.3rem)] font-bold uppercase tracking-[0.4em] text-ey-yellow">
              Resultado final
            </span>
            <motion.h2
              animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }}
              transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="font-display text-[clamp(2rem,6vw,5.5rem)] font-black leading-none text-text"
            >
              Calculando ganador…
            </motion.h2>
          </motion.div>
        )}

        {beat === "podium" && (
          <motion.div
            key="podium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: durations.base }}
            className="relative z-10 h-full"
          >
            {outcome.zeroVotes ? (
              <ZeroVotes reduced={reduced} />
            ) : (
              <Podium outcome={outcome} reduced={reduced} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function ZeroVotes({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: durations.slow }}
        className="text-[clamp(3rem,8vw,7rem)]"
        aria-hidden
      >
        🌌
      </motion.div>
      <h2 className="font-display text-[clamp(2rem,5vw,4.5rem)] font-black text-text">
        Sin votos esta vez
      </h2>
      <p className="max-w-2xl text-balance text-[clamp(1rem,1.8vw,1.6rem)] text-text-dim">
        El cosmos quedó en silencio. La próxima ronda será vuestra.
      </p>
    </div>
  );
}

function SpeakerOn() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

function SpeakerOff() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="m23 9-6 6M17 9l6 6" />
    </svg>
  );
}

export default RevealStage;
