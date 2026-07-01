import type { Options } from "canvas-confetti";

/**
 * Fireworks / confetti finale engine.
 *
 * canvas-confetti is LAZY-loaded: the module (and its bundle cost) is only
 * downloaded the first time a burst actually fires — i.e. when the reveal
 * lands on the podium — not on the initial screen bundle. The dynamic import
 * is cached in a module-level promise so the second+ calls reuse it.
 */

type ConfettiFn = (opts: Options) => Promise<undefined> | null;

let confettiPromise: Promise<ConfettiFn> | null = null;

function loadConfetti(): Promise<ConfettiFn> {
  if (!confettiPromise) {
    confettiPromise = import("canvas-confetti").then((m) => m.default);
  }
  return confettiPromise;
}

const COLORS = ["#FFE600", "#96d3b4", "#7DB8FF", "#FFFFFF"];

/** Confetti edge-burst from both lower corners toward center. */
export async function fireConfettiBurst(): Promise<void> {
  const confetti = await loadConfetti();
  const common: Options = {
    particleCount: 90,
    spread: 70,
    startVelocity: 55,
    colors: COLORS,
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
      colors: COLORS,
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
export async function fireFireworkShell(): Promise<void> {
  const confetti = await loadConfetti();
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
    colors: COLORS,
    shapes: ["circle"],
    disableForReducedMotion: true,
    zIndex: 200,
  });
}

/**
 * Sustained fireworks finale: fires airburst shells on an interval for
 * `durationMs`, then STOPS. Returns a stop handle so the caller can clear the
 * interval early (e.g. on unmount). The interval is always cleared — never
 * persistent.
 */
export function startFireworksFinale(durationMs: number): () => void {
  const interval = setInterval(() => {
    void fireFireworkShell();
  }, 380);

  const stop = () => clearInterval(interval);

  const timeout = setTimeout(stop, durationMs);

  return () => {
    clearTimeout(timeout);
    stop();
  };
}
