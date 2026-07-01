/**
 * Reveal choreography timings (seconds).
 *
 * The cinematic arc is: dim -> suspense -> color hint -> name tease -> curtain
 * (closed hold) -> curtain opens onto the podium climax. Total time from close
 * to podium is the sum of the beats (~11s full motion, ~5s reduced) — tune here.
 */

export interface RevealBeatTimings {
  /** Initial dim of the frozen stage. */
  dim: number;
  /** "Resultado final / Y el equipo ganador es…" hold. */
  suspense: number;
  /** Winner-color bloom teaser (skipped on zero votes). */
  hint: number;
  /** Partial-name glitch teaser (skipped on zero votes). */
  name: number;
  /** Curtain closed hold: EY SophIA | thePower branding + sheen. */
  curtainHold: number;
  /** Curtain panels swinging open onto the podium. */
  curtainOpen: number;
}

export const REVEAL_BEATS: RevealBeatTimings = {
  dim: 0.5,
  suspense: 2.2,
  hint: 2.6,
  name: 3.2,
  curtainHold: 2.4,
  curtainOpen: 1.2,
};

/** Same beats, compressed, for prefers-reduced-motion (crossfades only). */
export const REVEAL_BEATS_REDUCED: RevealBeatTimings = {
  dim: 0.3,
  suspense: 0.9,
  hint: 1.2,
  name: 1.6,
  curtainHold: 1.4,
  curtainOpen: 0.5,
};
