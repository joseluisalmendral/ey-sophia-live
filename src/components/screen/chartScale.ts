/**
 * chartScale — adaptive, "epic" bar scaling for the live projector charts.
 *
 * PROBLEM with naive `width = count / leader`:
 *  - A tight race (48 vs 50) renders as 96% vs 100% → the real, dramatic
 *    closeness is invisible; everything looks flat.
 *  - With very few votes (2 vs 1) it renders as 50% vs 100% → an exaggerated
 *    blowout that misrepresents an almost-meaningless lead.
 *
 * FIX — gamma (power) contrast on the HONEST proportion, tuned by confidence:
 *  1. The leader always pins at 100. Every bar starts from its REAL proportion
 *     of the leader (count / leader) — we never invent a spread that isn't there,
 *     so a genuinely close race stays close and a blowout stays a blowout.
 *  2. We apply a gamma exponent to that ratio to add perceptual contrast:
 *       width = ratio^gamma
 *     - gamma = 1 → linear (raw proportional).
 *     - gamma > 1 → pushes trailing bars down, so MODERATE gaps become clearly
 *       legible without lying: 0.96^1.4 = 0.945 (48 vs 50 still reads neck-and-neck
 *       but with a perceptible edge), while 0.11^1.4 = 0.05 (a real blowout looks
 *       like one). This is honest: monotonic and anchored on the true ratio.
 *  3. `gamma` rises with a `confidence` factor from the total votes: a near-empty
 *     room stays ~linear (don't over-dramatize noise — 2 vs 1 shouldn't look like
 *     a rout); as the room fills we lean into the contrast so a tense, real race
 *     LOOKS designed and dramatic on the projector.
 *
 * Pure function of (count, leader, trailer, total): trivially testable, cannot
 * desync from realtime state, never collapses a bar below MIN_VISUAL_PCT, and is
 * strictly monotonic (more votes ⇒ never a shorter bar).
 */

/** Absolute minimum width (%) so a zero/last team never fully disappears. */
export const MIN_VISUAL_PCT = 8;

/** Gamma at zero confidence (linear — honest proportional). */
const GAMMA_MIN = 1;
/** Gamma at full confidence (contrast-boosted, still anchored on the true ratio). */
const GAMMA_MAX = 1.6;

/**
 * Vote total at which we fully trust the contrast boost. Below this we ease the
 * gamma toward linear so a near-empty room isn't over-dramatized.
 */
const CONFIDENCE_FULL_AT = 40;

/** Clamp helper. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Confidence in [0,1] from the total votes: 0 at an empty room, ramping to 1 by
 * CONFIDENCE_FULL_AT. Uses sqrt so it climbs fast early (a room feels "real"
 * well before it's huge) then eases.
 */
export function scaleConfidence(total: number): number {
  if (total <= 0) return 0;
  return clamp(Math.sqrt(total / CONFIDENCE_FULL_AT), 0, 1);
}

export interface BarWidthInput {
  count: number;
  /** Highest count in the field (the leader). */
  leader: number;
  /** Lowest count in the field (the trailer). Reserved for future tuning. */
  trailer?: number;
  /** Sum of all counts (drives the confidence-tuned gamma). */
  total: number;
}

/**
 * Adaptive bar width as a percentage in [MIN_VISUAL_PCT, 100].
 *
 * - leader === 0 (no votes yet): everyone sits at the floor (teased, equal).
 * - otherwise: (count / leader)^gamma, with gamma eased from linear (empty room)
 *   to contrast-boosted (full room) so closeness and dominance both read true.
 */
export function adaptiveBarWidthPct({
  count,
  leader,
  total,
}: BarWidthInput): number {
  if (leader <= 0) return MIN_VISUAL_PCT;

  const ratio = clamp(count / leader, 0, 1);
  const c = scaleConfidence(total);
  const gamma = GAMMA_MIN + (GAMMA_MAX - GAMMA_MIN) * c;

  const pct = Math.pow(ratio, gamma) * 100;
  return clamp(pct, MIN_VISUAL_PCT, 100);
}

/**
 * A y-axis max for the columns chart that leaves headroom so the tallest bar
 * never touches the top edge and equal-ish bars still show a readable gap.
 * Returns null when there are no votes (let the chart auto-scale its empty grid).
 */
export function columnsYAxisMax(leader: number): number | null {
  if (leader <= 0) return null;
  // ~15% headroom, rounded up to a "nice" step so the axis labels stay clean.
  const withHeadroom = leader * 1.15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(withHeadroom)));
  const step = magnitude / 2 || 1;
  return Math.ceil(withHeadroom / step) * step;
}
