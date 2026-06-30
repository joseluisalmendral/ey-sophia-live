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
} as const;

/** Cubic-bezier easings as Motion-compatible tuples. */
export const easings = {
  standard: [0.2, 0, 0, 1],
  decel: [0, 0, 0, 1],
  accel: [0.3, 0, 1, 1],
} as const;

/** Spring presets matching the design tokens. */
export const springs = {
  barWidth: { type: "spring", stiffness: 140, damping: 22, mass: 1 },
  podiumRise: { type: "spring", stiffness: 90, damping: 14 },
  slam: { type: "spring", stiffness: 260, damping: 18 },
  card: { type: "spring", stiffness: 320, damping: 26 },
} as const;
