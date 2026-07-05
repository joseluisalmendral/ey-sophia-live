"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { durations } from "@/lib/motion/tokens";
import { fireConfettiBurst, startFireworksFinale } from "@/lib/effects/fireworks";
import { playWinnerSting, type WinnerStingHandle } from "@/lib/effects/winnerSting";
import { Podium } from "./Podium";
import { resolveReveal, type RevealOutcome } from "./winner";
import { ColorHint } from "./reveal/ColorHint";
import { NameTease } from "./reveal/NameTease";
import { Curtain } from "./reveal/Curtain";
import { CameraCuts } from "./reveal/CameraCuts";
import { REVEAL_BEATS, REVEAL_BEATS_REDUCED } from "./reveal/constants";
import type { RankedTeam, TieRule } from "@/lib/types";

/**
 * RevealStage — the CLOSED state finale, now a 6-beat CINEMATIC arc:
 *
 *   (a) DIM       — the stage dims over the frozen race.
 *   (b) SUSPENSE  — "Y el equipo ganador es…" hold; at the END of this beat the
 *       final outcome is captured from the live ref (fire-time, never mount-time).
 *   (c) COLOR HINT — the winner's team color blooms across the dark (both colors
 *       on a double crown). First clue, no names.
 *   (d) NAME TEASE — ~45% of the winner's name locks in, the rest keeps cycling
 *       glitched glyphs in the team color. Second clue.
 *   (e) TELÓN     — a 3D theatre curtain slams shut: EY SophIA (IA in purple) on
 *       the left panel, thePower on the right, gold seam, roaming sheen,
 *       "Y el equipo ganador es…" pulsing on the join.
 *   (f) CAMERAS   — the curtain swings open onto PURE BLACK and a videogame-style
 *       champion presentation: 3 hard camera cuts (low-angle monolith, lateral
 *       dolly, frontal hero) with cinematic letterbox. The winner sting fires on
 *       the hero cut. See reveal/CameraCuts.tsx.
 *   (g) PODIUM    — letterbox retracts onto the podium climax: rise + crown +
 *       confetti edge-burst + ~4s fireworks finale that STOPS.
 *
 * Timings live in reveal/constants.ts (~22s full arc, ~7.5s reduced).
 *
 * Zero votes: hint + name-tease + camera beats are skipped (no winner); the
 * curtain still opens onto the designed "Sin votos esta vez" state.
 * Ties: resolveReveal() decides double_crown; hint/tease/cameras/podium all
 * render both co-winners. Reduced motion: same beats minus the camera cuts,
 * compressed, crossfades only, no confetti/fireworks/audio. The `ready` gate is
 * unchanged: nothing starts until the initial absolute tally has resolved.
 */

type Beat = "suspense" | "hint" | "name" | "curtain" | "cameras" | "podium";

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
 * useRevealChoreography — owns all imperative reveal behavior: the beat state
 * machine + timers, the fire-time outcome capture, the confetti/fireworks
 * engine (with cleanup), and the WebAudio winner sting. Consumers become pure
 * presentation over `beat` + `finalOutcome` + `muted`.
 */
function useRevealChoreography(
  outcome: RevealOutcome,
  reduced: boolean,
  ready: boolean,
) {
  const [beat, setBeat] = useState<Beat>("suspense");
  // Captured at the end of the suspense beat: the outcome the teasers and the
  // podium celebrate. Null until then.
  const [finalOutcome, setFinalOutcome] = useState<RevealOutcome | null>(null);
  const [scope, animate] = useAnimate();

  // useLatest: the choreography reads the outcome at FIRE time (after the
  // suspense beat), never from a mount-time closure — live.teams seeds async, so
  // the mount-time outcome is usually the empty zero-votes snapshot.
  const outcomeRef = useRef(outcome);
  useEffect(() => {
    outcomeRef.current = outcome;
  }, [outcome]);

  // Audio sting: attempted best-effort at the crown/confetti landing beat.
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  const stingRef = useRef<WinnerStingHandle | null>(null);

  useEffect(() => {
    // Gate the whole choreography on the initial tally being seeded.
    if (!ready) return;
    let cancelled = false;
    let stopFireworks: (() => void) | null = null;
    const t = reduced ? REVEAL_BEATS_REDUCED : REVEAL_BEATS;

    const run = async () => {
      // Beat (a) DIM.
      await animate(scope.current, { opacity: 1 }, { duration: t.dim });

      // Beat (b) SUSPENSE.
      await wait(t.suspense * 1000);
      if (cancelled) return;

      // Fire-time outcome: decides the whole arc from the real final tally.
      const fo = outcomeRef.current;
      setFinalOutcome(fo);
      const hasWinner = !fo.zeroVotes && fo.winners.length > 0;

      if (hasWinner) {
        // Beat (c) COLOR HINT.
        setBeat("hint");
        await wait(t.hint * 1000);
        if (cancelled) return;

        // Beat (d) NAME TEASE.
        setBeat("name");
        await wait(t.name * 1000);
        if (cancelled) return;
      }

      // Beat (e) TELÓN — closed hold with the co-brand.
      setBeat("curtain");
      await wait(t.curtainHold * 1000);
      if (cancelled) return;

      if (!reduced && hasWinner) {
        // Beat (f) CAMERAS — curtain opens onto black + 3 videogame-style cuts.
        setBeat("cameras");
        await wait((t.camLow + t.camDolly) * 1000);
        if (cancelled) return;

        // The winner sting lands ON the hero cut (cut 3) — the musical hit and
        // the hardest visual edit share the same frame.
        if (!mutedRef.current) {
          stingRef.current = playWinnerSting();
        }
        await wait(t.camHero * 1000);
        if (cancelled) return;

        // Beat (g) PODIUM — letterbox retracts onto the full climax.
        setBeat("podium");

        // Confetti edge-burst once the plinths land.
        await wait(600);
        if (cancelled) return;
        void fireConfettiBurst();

        // Sustained fireworks finale: airburst shells on an interval, then STOP.
        stopFireworks = startFireworksFinale(durations.fireworks * 1000);
      } else {
        // Reduced motion or zero votes: no camera cuts — the curtain's
        // AnimatePresence exit opens straight onto the podium / no-votes state.
        setBeat("podium");
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
        stingRef.current?.stop();
        stingRef.current = null;
      }
      return next;
    });
  }, []);

  return { beat, finalOutcome, scope, muted, toggleMute };
}

export function RevealStage({ teams, tieRule, reduced, ready }: RevealStageProps) {
  const liveOutcome = resolveReveal(teams, tieRule);
  const { beat, finalOutcome, scope, muted, toggleMute } = useRevealChoreography(
    liveOutcome,
    reduced,
    ready,
  );
  // Teasers/podium always celebrate the captured fire-time outcome.
  const outcome = finalOutcome ?? liveOutcome;
  const curtainOpenSeconds = (reduced ? REVEAL_BEATS_REDUCED : REVEAL_BEATS).curtainOpen;

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

      {/* Teasing + climax beats */}
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
              Y el equipo ganador es…
            </motion.h2>
          </motion.div>
        )}

        {beat === "hint" && (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.base }}
            className="relative z-10 h-full"
          >
            <ColorHint winners={outcome.winners} reduced={reduced} />
          </motion.div>
        )}

        {beat === "name" && (
          <motion.div
            key="name"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.base }}
            className="relative z-10 h-full"
          >
            <NameTease winners={outcome.winners} reduced={reduced} />
          </motion.div>
        )}

        {(beat === "curtain" || beat === "cameras" || beat === "podium") && (
          <motion.div
            key="climax"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: durations.base }}
            className="relative z-10 h-full"
          >
            {/* The podium mounts behind the curtain and is unveiled as it opens. */}
            {beat === "podium" &&
              (outcome.zeroVotes ? (
                <ZeroVotes reduced={reduced} />
              ) : (
                <Podium outcome={outcome} reduced={reduced} />
              ))}

            {/* CAMERAS beat: pure black + 3 videogame-style cuts behind the
                opening curtain; its exit retracts the letterbox onto the podium. */}
            <AnimatePresence>
              {beat === "cameras" && (
                <CameraCuts
                  winners={outcome.winners}
                  timings={reduced ? REVEAL_BEATS_REDUCED : REVEAL_BEATS}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TELÓN overlay — its AnimatePresence exit is the theatre opening. */}
      <AnimatePresence>
        {beat === "curtain" && (
          <Curtain reduced={reduced} openSeconds={curtainOpenSeconds} />
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
