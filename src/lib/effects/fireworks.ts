import type { Options } from "canvas-confetti";

/**
 * Fireworks / confetti finale engine.
 *
 * canvas-confetti is LAZY-loaded: the module (and its bundle cost) is only
 * downloaded the first time a burst actually fires — i.e. when the reveal
 * lands on the podium — not on the initial screen bundle. The dynamic import
 * is cached in a module-level promise so the second+ calls reuse it.
 *
 * Every burst can target a caller-owned canvas (`FinaleTarget.canvas`): the
 * reveal mounts one BEHIND the podium so particles never cover the crown,
 * names or scores. Without a canvas the library's own fixed full-page canvas
 * is used (legacy behaviour, e.g. the phone reveal).
 *
 * Palette: 3–4 brand hues only — the winner's team colour, EY yellow, white
 * and the mascot mint — never a rainbow.
 */

type ConfettiFn = (opts: Options) => Promise<undefined> | null;
type ConfettiModule = ConfettiFn & {
  create: (canvas?: HTMLCanvasElement, options?: { resize?: boolean; useWorker?: boolean }) => ConfettiFn;
};

let modulePromise: Promise<ConfettiModule> | null = null;

function loadModule(): Promise<ConfettiModule> {
  if (!modulePromise) {
    modulePromise = import("canvas-confetti").then((m) => m.default as unknown as ConfettiModule);
  }
  return modulePromise;
}

// One confetti instance per target canvas (the library binds its own render
// loop + resize logic to the element).
const instances = new WeakMap<HTMLCanvasElement, ConfettiFn>();

async function confettiFor(canvas?: HTMLCanvasElement | null): Promise<ConfettiFn> {
  const mod = await loadModule();
  if (!canvas) return mod;
  const cached = instances.get(canvas);
  if (cached) return cached;
  const fn = mod.create(canvas, { resize: true, useWorker: false });
  instances.set(canvas, fn);
  return fn;
}

export const EY_YELLOW = "#FFE600";
export const MASCOT_MINT = "#96d3b4";

/** Brand confetti palette: winner colour + EY yellow + white + mascot mint. */
export function brandConfettiColors(winnerColor?: string | null): string[] {
  const hues = [winnerColor, EY_YELLOW, "#FFFFFF", MASCOT_MINT].filter(
    (c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
  );
  return [...new Set(hues.map((c) => c.toUpperCase()))];
}

export interface FinaleTarget {
  /** Canvas to draw on (behind the podium). Omit for the page-level canvas. */
  canvas?: HTMLCanvasElement | null;
  /** Palette; defaults to the brand palette without a winner colour. */
  colors?: string[];
}

/** Confetti edge-burst from both lower corners toward center. */
export async function fireConfettiBurst(target: FinaleTarget = {}): Promise<void> {
  const confetti = await confettiFor(target.canvas);
  const colors = target.colors ?? brandConfettiColors();
  const common: Options = {
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
export async function fireFireworkShell(target: FinaleTarget = {}, particleCount = 45): Promise<void> {
  const confetti = await confettiFor(target.canvas);
  const x = 0.2 + Math.random() * 0.6;
  const y = 0.2 + Math.random() * 0.35;
  confetti({
    particleCount,
    startVelocity: 38,
    spread: 360,
    ticks: 90,
    gravity: 1.1,
    decay: 0.92,
    scalar: 1.05,
    origin: { x, y },
    colors: target.colors ?? brandConfettiColors(),
    shapes: ["circle"],
    disableForReducedMotion: true,
    zIndex: 200,
  });
}

/** Shell density: full for the first 3 s, then half (the finale fades, never cuts). */
const SHELL_PARTICLES = 45;
const SHELL_INTERVAL_MS = 400;
const HALF_DENSITY_AFTER_MS = 3000;

/**
 * Sustained fireworks finale: fires airburst shells on an interval for
 * `durationMs` (density halves after 3 s), then STOPS. Returns a stop handle so
 * the caller can clear the interval early (e.g. on unmount). The interval is
 * always cleared — never persistent.
 */
export function startFireworksFinale(durationMs: number, target: FinaleTarget = {}): () => void {
  const startedAt = Date.now();
  const interval = setInterval(() => {
    const dense = Date.now() - startedAt < HALF_DENSITY_AFTER_MS;
    void fireFireworkShell(target, dense ? SHELL_PARTICLES : Math.round(SHELL_PARTICLES / 2));
  }, SHELL_INTERVAL_MS);

  const stop = () => clearInterval(interval);

  const timeout = setTimeout(stop, durationMs);

  return () => {
    clearTimeout(timeout);
    stop();
  };
}
