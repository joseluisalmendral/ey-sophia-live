/**
 * Reveal choreography timings (seconds).
 *
 * The cinematic arc is: dim -> suspense -> color hint -> name tease -> curtain
 * (closed hold) -> curtain opens onto the podium climax. Total time from close
 * to podium is the sum of the beats (~17s full motion, ~7.5s reduced) — tune
 * here. Room-tested: ~11s felt rushed live — the audience needs air to guess
 * on each clue — so suspense and both teasers breathe longer. Every extended
 * beat carries a running loop (title pulse, bloom breathing, glitch cycle,
 * curtain sheen) so nothing reads as frozen.
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
  dim: 0.6,
  suspense: 3.2,
  hint: 3.8,
  name: 4.6,
  curtainHold: 3.4,
  curtainOpen: 1.4,
};

/** Same beats, compressed proportionally, for prefers-reduced-motion (crossfades only). */
export const REVEAL_BEATS_REDUCED: RevealBeatTimings = {
  dim: 0.3,
  suspense: 1.3,
  hint: 1.7,
  name: 2.1,
  curtainHold: 1.6,
  curtainOpen: 0.5,
};
