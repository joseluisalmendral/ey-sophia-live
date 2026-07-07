/**
 * Reveal choreography timings (seconds).
 *
 * The cinematic arc is: dim -> suspense -> curtain (closed hold) -> curtain
 * opens onto the camera sequence -> podium. Total time from close to podium is
 * the sum of the beats (~16s full motion, ~4s reduced) — tune here.
 *
 * v4 pacing note: the pre-curtain teasers (color hint / name tease) were cut —
 * they leaked drama before the curtain and stretched the arc. The suspense hold
 * now breathes a little longer since it is the ONLY anteroom before the telón;
 * every extended beat still carries a running loop (title pulse, curtain sheen)
 * so nothing reads as frozen. The dramatic weight lives AFTER the curtain (the
 * camera sequence carries the wow).
 */

export interface RevealBeatTimings {
  /** Initial dim of the frozen stage. */
  dim: number;
  /** "Resultado final / Y el equipo ganador es…" hold — the only anteroom. */
  suspense: number;
  /** Curtain closed hold: EY SophIA | thePower branding + sheen. */
  curtainHold: number;
  /** Curtain panels swinging open onto the camera sequence (or podium). */
  curtainOpen: number;
  /** Camera cut 1 — dramatic low-angle shot of the winner monolith rising. */
  camLow: number;
  /** Camera cut 2 — lateral dolly: giant name travelling with parallax layers. */
  camDolly: number;
  /** Camera cut 3 — frontal hero shot (sting fires on this cut). */
  camHero: number;
}

export const REVEAL_BEATS: RevealBeatTimings = {
  dim: 0.6,
  suspense: 3.4,
  curtainHold: 3.0,
  curtainOpen: 1.4,
  camLow: 2.6,
  camDolly: 2.4,
  camHero: 2.7,
};

/**
 * Same beats, compressed proportionally, for prefers-reduced-motion
 * (crossfades only). Camera cuts are skipped entirely in reduced mode,
 * so their timings are zero.
 */
export const REVEAL_BEATS_REDUCED: RevealBeatTimings = {
  dim: 0.3,
  suspense: 1.6,
  curtainHold: 1.6,
  curtainOpen: 0.5,
  camLow: 0,
  camDolly: 0,
  camHero: 0,
};
