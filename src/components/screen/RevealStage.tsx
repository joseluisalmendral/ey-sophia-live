"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import confetti from "canvas-confetti";
import { durations } from "@/lib/motion/tokens";
import { Podium } from "./Podium";
import { resolveReveal } from "./winner";
import type { RankedTeam, TieRule } from "@/lib/types";

/**
 * RevealStage — the CLOSED state finale: a 3-beat reveal choreography.
 *
 * Beats (driven by a single timed sequence; respects reduced-motion):
 *   (a) FREEZE + DIM  — the stage dims, suspense kicker fades in, audio sting
 *       attempts to play (mute toggle provided; degrades silently if blocked).
 *   (b) SUSPENSE HOLD — "Calculando ganador…" shimmer for ~2.4s. The pause IS
 *       the finale.
 *   (c) PODIUM        — the top-3 morph into the Olympic-asymmetry podium
 *       (Podium handles the rise + crown drop + score slam), then a confetti
 *       edge-burst at the landing frame, then a ~4s sustained fireworks finale
 *       (rising shells + airbursts) that STOPS (never persistent).
 *
 * Finale engine note: we drive both the edge-burst and the sustained "fireworks"
 * with canvas-confetti (airburst shells launched on an interval), rather than the
 * @tsparticles/fireworks preset. That preset's dependency tree is incomplete in
 * this install (missing transitive @tsparticles/plugin-interactivity) and adding
 * deps is out of scope here; canvas-confetti is fully present and gives the same
 * cinematic effect with a guaranteed clean build and a hard stop.
 *
 * Tie + zero-vote: winner resolution is delegated to resolveReveal(); a zero-vote
 * close renders a designed "Sin votos esta vez" state (no crown, no crash).
 *
 * Reduced motion: the whole thing collapses to crossfades — static crown (Podium),
 * no confetti/fireworks (disableForReducedMotion), shorter suspense.
 */

type Beat = "suspense" | "podium";

export interface RevealStageProps {
  teams: RankedTeam[];
  tieRule: TieRule;
  reduced: boolean;
}

export function RevealStage({ teams, tieRule, reduced }: RevealStageProps) {
  const outcome = resolveReveal(teams, tieRule);
  const [beat, setBeat] = useState<Beat>("suspense");
  const [scope, animate] = useAnimate();

  // Interval handle for the sustained fireworks finale (so it can be stopped).
  const finaleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio sting: muted by default-safe — we ATTEMPT autoplay and expose a toggle.
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Run the timed beat sequence once on mount.
  useEffect(() => {
    let cancelled = false;
    const suspenseMs = reduced ? 700 : durations.suspense * 1000;

    const stopFinale = () => {
      if (finaleTimer.current) {
        clearInterval(finaleTimer.current);
        finaleTimer.current = null;
      }
    };

    const run = async () => {
      // Beat (a) dim is handled by the scope's animate below.
      await animate(scope.current, { opacity: 1 }, { duration: durations.base / 1.5 });

      // Attempt audio sting (best-effort; autoplay may be blocked).
      if (!reduced && audioRef.current) {
        audioRef.current.volume = 0.6;
        audioRef.current.play().catch(() => {
          /* autoplay blocked — degrade silently, user can unmute */
        });
      }

      await wait(suspenseMs);
      if (cancelled) return;
      setBeat("podium");

      if (!reduced && !outcome.zeroVotes && outcome.winners.length > 0) {
        // Confetti edge-burst at podium landing (high zIndex, reduced-safe).
        await wait(900);
        if (cancelled) return;
        fireConfettiBurst();

        // Sustained fireworks finale: airburst shells on an interval, then STOP.
        finaleTimer.current = setInterval(fireFireworkShell, 380);
        await wait(durations.fireworks * 1000);
        stopFinale(); // never persistent
      }
    };
    void run();

    return () => {
      cancelled = true;
      stopFinale();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    if (muted) {
      a.muted = false;
      a.play().catch(() => {});
      setMuted(false);
    } else {
      a.muted = true;
      setMuted(true);
    }
  };

  return (
    <div ref={scope} className="relative h-full w-full" style={{ opacity: 0 }}>
      {/* Dim veil over the frozen stage. */}
      <div className="pointer-events-none absolute inset-0 bg-cosmic-deep/55" aria-hidden />

      {/* Audio sting element (no asset shipped — wired for one if added later). */}
      <audio ref={audioRef} preload="auto" aria-hidden>
        <source src="/sfx/winner-sting.mp3" type="audio/mpeg" />
      </audio>

      {/* Mute toggle (always available, degrades if no audio). */}
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

/** Confetti edge-burst from both lower corners toward center. */
function fireConfettiBurst() {
  const colors = ["#FFE600", "#96d3b4", "#7DB8FF", "#FFFFFF"];
  const common: confetti.Options = {
    particleCount: 90,
    spread: 70,
    startVelocity: 55,
    colors,
    disableForReducedMotion: true,
    zIndex: 200,
  };
  confetti({ ...common, angle: 60, origin: { x: 0, y: 1 } });
  confetti({ ...common, angle: 120, origin: { x: 1, y: 1 } });
  // A center pop a beat later.
  setTimeout(() => {
    confetti({
      particleCount: 140,
      spread: 120,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.55 },
      colors,
      disableForReducedMotion: true,
      zIndex: 200,
    });
  }, 250);
}

/**
 * One airburst "firework shell": a tight high-velocity radial burst at a random
 * point in the upper stage, simulating an exploding shell. Called on an interval
 * to build the sustained finale, then the interval is cleared (never persistent).
 */
function fireFireworkShell() {
  const colors = ["#FFE600", "#96d3b4", "#7DB8FF", "#FFFFFF"];
  const x = 0.2 + Math.random() * 0.6;
  const y = 0.2 + Math.random() * 0.35;
  confetti({
    particleCount: 60,
    startVelocity: 38,
    spread: 360,
    ticks: 90,
    gravity: 1.1,
    decay: 0.92,
    scalar: 1.05,
    origin: { x, y },
    colors,
    shapes: ["circle"],
    disableForReducedMotion: true,
    zIndex: 200,
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
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
