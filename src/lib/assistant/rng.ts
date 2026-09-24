/**
 * Seedable PRNG for the assistant (mulberry32). The projector seeds from the
 * clock; /lab injects a fixed seed so a rehearsal replays the same lines.
 */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform sample in [a, b). */
export function uniform(rng: Rng, a: number, b: number): number {
  return a + rng() * (b - a);
}

/** Weighted pick; returns null on an empty pool. */
export function weightedPick<T>(
  rng: Rng,
  items: readonly T[],
  weight: (item: T) => number,
): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return items.length ? items[Math.floor(rng() * items.length)] : null;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r < 0) return it;
  }
  return items[items.length - 1];
}
