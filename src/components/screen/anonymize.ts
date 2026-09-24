import { mulberry32 } from "@/lib/assistant/rng";

/**
 * anonymize — presentation-layer identity masking for the projector.
 *
 * When a poll runs with `anonymous_display`, the big screen must show HOW the
 * race is going without showing WHO is who. Identities hide ONLY while the
 * vote is OPEN: the lobby shows the real finalists and the reveal names them.
 * This module rewrites only the identity fields (name + color) of the display
 * rows; counts, ranks and percentages pass through untouched, so BarRace /
 * donut / columns all render the anonymized race for free.
 *
 * LABEL: every hidden candidate reads just "?" (chips included). No letters,
 * no numbers — any per-team label invites the room to map labels to teams.
 *
 * COLORS: N colors from a curated projector palette (vivid, bright enough for
 * a legible label on the dark stage), picked greedily to MAXIMISE the minimum
 * perceptual distance (OKLab ΔE) to every real team color, to the EY yellow
 * accent and to each other. So no hidden bar can be read as "the green team".
 *
 * ASSIGNMENT: a seeded DERANGEMENT of the lobby order — the team at lobby
 * position i never gets anonymous slot i — so slot order leaks nothing. The
 * seed is hash(pollId + runSeq): stable across reloads during a run,
 * different for every relaunch, and identical on the server (RSC wall in
 * load.ts) and the client (ScreenStage + realtime tallies keyed by team id).
 */

/** The single masked label every hidden candidate shares. */
export const ANONYMOUS_NAME = "?";

/**
 * Curated anonymous palette (order = tie-break priority). Vivid mid-to-light
 * hues that stay legible on the cosmic stage and carry a readable label via
 * pickTextOn. Deliberately no greys, no white and no EY yellow.
 */
export const ANON_PALETTE: readonly string[] = [
  "#FF3D9A", // hot pink
  "#38BDF8", // sky
  "#2DD4BF", // teal
  "#FF5A5F", // coral red
  "#E879F9", // orchid
  "#A3E635", // lime
  "#22D3EE", // cyan
  "#E11D48", // crimson
  "#5EEAD4", // aqua
  "#C026D3", // magenta
  "#00E5A0", // spring
  "#FB7185", // rose
  "#60A5FA", // cornflower
];

/** Colors every anonymous color must also stay away from (EY yellow accent). */
const RESERVED_COLORS: readonly string[] = ["#FFE600"];

/* ------------------------------------------------------------------ */
/* Color math (OKLab)                                                  */

type Lab = readonly [number, number, number];

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** sRGB hex → OKLab (Björn Ottosson). Unparseable input → mid grey. */
export function hexToOklab(hex: string): Lab {
  const rgb = parseHex(hex) ?? [128, 128, 128];
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Perceptual distance ΔE_OK (Euclidean in OKLab; ~0.02 = just noticeable). */
export function colorDistance(a: string, b: string): number {
  const A = hexToOklab(a);
  const B = hexToOklab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/**
 * Greedy max-min pick of `n` palette colors: each step takes the candidate
 * whose nearest neighbour among (real team colors ∪ reserved ∪ already
 * chosen) is the farthest. Deterministic (ties → palette order). Beyond the
 * palette size the picks cycle (never expected at an event).
 */
export function pickAnonColors(realColors: readonly string[], n: number): string[] {
  const avoid = [...realColors, ...RESERVED_COLORS];
  const chosen: string[] = [];
  const pool = [...ANON_PALETTE];
  for (let i = 0; i < n; i++) {
    if (pool.length === 0) {
      chosen.push(chosen[i % ANON_PALETTE.length]);
      continue;
    }
    let best = 0;
    let bestScore = -1;
    pool.forEach((candidate, idx) => {
      let nearest = Infinity;
      for (const c of avoid) nearest = Math.min(nearest, colorDistance(candidate, c));
      for (const c of chosen) nearest = Math.min(nearest, colorDistance(candidate, c));
      if (nearest > bestScore + 1e-9) {
        bestScore = nearest;
        best = idx;
      }
    });
    chosen.push(pool[best]);
    pool.splice(best, 1);
  }
  return chosen;
}

/* ------------------------------------------------------------------ */
/* Seed + derangement                                                  */

/** 32-bit FNV-1a hash of a string. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Run-scoped seed: stable for a run, different after every relaunch. */
export function anonSeed(pollId: string, runSeq: number): number {
  return fnv1a(`${pollId}:${runSeq}`);
}

/**
 * Seeded derangement of [0..n): perm[i] !== i for every i (n ≥ 2). Seeded
 * Fisher–Yates with rejection (expected ~e tries). n = 1 → [0].
 */
export function seededDerangement(n: number, seed: number): number[] {
  const identity = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return identity;
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 64; attempt++) {
    const perm = [...identity];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    if (perm.every((p, i) => p !== i)) return perm;
  }
  // Practically unreachable: fall back to a rotation (always a derangement).
  return identity.map((i) => (i + 1) % n);
}

/* ------------------------------------------------------------------ */
/* Identity map                                                        */

export interface AnonIdentity {
  name: string;
  color: string;
  /** Anonymous slot (index into the picked colors). */
  slot: number;
}

/**
 * Anonymous identity per team id. `teamsInPositionOrder` is the configured
 * (lobby) order with the REAL colors — the distance targets.
 */
export function anonymousIdentity(
  teamsInPositionOrder: ReadonlyArray<{ id: string; color: string }>,
  seed: number,
): Map<string, AnonIdentity> {
  const n = teamsInPositionOrder.length;
  const colors = pickAnonColors(
    teamsInPositionOrder.map((t) => t.color),
    n,
  );
  const perm = seededDerangement(n, seed);
  return new Map(
    teamsInPositionOrder.map((t, i) => [
      t.id,
      { name: ANONYMOUS_NAME, color: colors[perm[i]], slot: perm[i] },
    ]),
  );
}

/**
 * Identity map from rows that are ALREADY masked (server wall): reuse their
 * own name/color so the client matches the server byte for byte.
 */
export function identityFromMasked(
  rows: ReadonlyArray<{ id: string; name: string; color: string }>,
): Map<string, AnonIdentity> {
  return new Map(rows.map((r, i) => [r.id, { name: r.name, color: r.color, slot: i }]));
}

/** Fallback for a row missing from the map (never a real identity). */
const UNKNOWN_IDENTITY: AnonIdentity = { name: ANONYMOUS_NAME, color: "#94A3B8", slot: -1 };

/**
 * Rewrite name/color of display rows with their anonymous identity. Generic
 * over the row shape so the lobby's Team cards and the live RankedTeam rows
 * mask through the same pure function.
 */
export function applyAnonIdentity<T extends { id: string; name: string; color: string }>(
  rows: T[],
  identity: ReadonlyMap<string, AnonIdentity>,
): T[] {
  return rows.map((row) => {
    const id = identity.get(row.id) ?? UNKNOWN_IDENTITY;
    return { ...row, name: id.name, color: id.color };
  });
}

/* ------------------------------------------------------------------ */
/* Chip initials                                                       */

/** "<WORD> <number>" team names, e.g. "AMARILLO 3" / "Equipo 12". */
const NUMBERED_TEAM = /^(\p{L}+)\s+(\d{1,3})$/u;

/** One-letter key (or letter + number for numbered teams). */
function shortInitials(name: string): string {
  const n = name.trim();
  if (!n) return "";
  const m = NUMBERED_TEAM.exec(n);
  if (m) return `${m[1].charAt(0)}${m[2]}`.toUpperCase();
  return n.charAt(0).toUpperCase();
}

/** Two-letter key: first letters of the first two words, or of a single word. */
function longInitials(name: string): string {
  const n = name.trim();
  if (NUMBERED_TEAM.test(n)) return shortInitials(n);
  const words = n.split(/\s+/);
  const second = words[1] ? words[1].charAt(0) : n.charAt(1);
  return `${n.charAt(0)}${second}`.toUpperCase();
}

/**
 * Chip initials for a team, shared by the lobby, the live race and the
 * podium so a team reads the same everywhere:
 *  - "<WORD> <number>" ("AMARILLO 3") → first letter + number ("A3"), never
 *    the bare digit;
 *  - otherwise the first letter of the first word; when that letter collides
 *    with another team of the poll, two letters (first word + second word, or
 *    the first two letters of a single word) keep the chips apart.
 * The anonymous name yields "?" (every hidden chip reads the same).
 */
export function teamInitials(name: string, names: readonly string[]): string {
  if (name === ANONYMOUS_NAME) return ANONYMOUS_NAME;
  const key = shortInitials(name);
  if (!key) return "";
  const collides = names.some((other) => other !== name && shortInitials(other) === key);
  return collides ? longInitials(name) : key;
}
