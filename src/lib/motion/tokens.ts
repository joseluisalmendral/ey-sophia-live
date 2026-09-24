/**
 * Motion tokens for Framer Motion (`motion`), mirroring the CSS custom
 * properties in globals.css so JS-driven animations stay in lockstep with the
 * design system. Durations are in SECONDS here (Motion's unit), not ms.
 *
 * Reduced-motion is handled two ways:
 *  - global CSS (globals.css) collapses CSS transitions/animations, and
 *  - components read `useReducedMotionPref()` to swap motion variants for
 *    crossfades and to disable scale/burst/heavy motion.
 */

export const durations = {
  micro: 0.12,
  fast: 0.2,
  base: 0.32,
  slow: 0.6,
  suspense: 2.4,
  fireworks: 4,
  // v2 broadcast language
  stinger: 0.52,
  bubbleIn: 0.26,
  bubbleOut: 0.18,
} as const;

/** Cubic-bezier easings as Motion-compatible tuples. */
export const easings = {
  standard: [0.2, 0, 0, 1],
  decel: [0, 0, 0, 1],
  accel: [0.3, 0, 1, 1],
  // v2 broadcast language
  sweep: [0.7, 0, 0.2, 1],
  travel: [0.3, 0, 0.15, 1],
} as const;

/**
 * Spring presets matching the design tokens.
 *
 * Golden rule (motion spec §A): character = springs with overshoot; data =
 * critically damped, never overshoots. `barWidthHonest` / `reorder` are the
 * v2 data springs (zero overshoot) — the legacy `barWidth` / `podiumRise` are
 * kept untouched so nothing shipped changes until a consumer opts in.
 */
export const springs = {
  barWidth: { type: "spring", stiffness: 140, damping: 22, mass: 1 },
  podiumRise: { type: "spring", stiffness: 90, damping: 14 },
  slam: { type: "spring", stiffness: 260, damping: 18 },
  card: { type: "spring", stiffness: 320, damping: 26 },
  // v2 — data (honest, no overshoot)
  barWidthHonest: { type: "spring", stiffness: 120, damping: 26, mass: 1 },
  reorder: { type: "spring", stiffness: 170, damping: 26, mass: 1 },
  // v2 — character (overshoot allowed)
  pose: { type: "spring", stiffness: 170, damping: 20, mass: 1 },
  lookAt: { type: "spring", stiffness: 220, damping: 24, mass: 1 },
  bubble: { type: "spring", stiffness: 380, damping: 26, mass: 0.8 },
  travelLand: { type: "spring", stiffness: 300, damping: 16, mass: 1 },
  enter: { type: "spring", stiffness: 180, damping: 20, mass: 1.1 },
  pop: { type: "spring", stiffness: 280, damping: 12, mass: 1 },
  orb: { type: "spring", stiffness: 320, damping: 18, mass: 0.9 },
} as const;
