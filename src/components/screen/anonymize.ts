import type { RankedTeam, Team } from "@/lib/types";

/**
 * anonymize — presentation-layer identity masking for the projector.
 *
 * When a poll runs with `anonymous_display`, the big screen must show HOW the
 * race is going without showing WHO is who. This module rewrites only the
 * identity fields (name + color) of the display rows; counts, ranks and
 * percentages pass through untouched, so BarRace / donut / columns all render
 * the anonymized race for free (the mapping runs BEFORE the render).
 *
 * Identity assignment is keyed on the team's CONFIGURED position ("Equipo A" =
 * position 0), NEVER on the current ranking: a rank-based label would re-identify
 * teams the moment bars swap (the label would visibly follow the movement the
 * audience already associates with a team). Position is stable for the whole
 * run, so each bar keeps its letter and shade and can be followed as a bar —
 * without leaking which real team it is.
 *
 * Colors: N subtle variants of ONE neutral cosmic indigo — never the EY yellow
 * accent, never any real team color. The variants differ just enough in hue and
 * lightness to track each bar across FLIP reorders, while reading as "identity
 * withheld" as a set. Labels drawn on top must keep using pickTextOn.
 */

/** Letters for anonymous team labels; wraps to AA, AB… beyond 26 (unrealistic). */
function anonymousName(index: number): string {
  let label = "";
  let i = index;
  do {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return `Equipo ${label}`;
}

/** Convert HSL (h 0-360, s/l 0-100) to a #rrggbb hex string. */
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) =>
    Math.round(
      255 * (light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))),
    );
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(channel(0))}${toHex(channel(8))}${toHex(channel(4))}`;
}

/**
 * N distinguishable variants of a single neutral cosmic indigo (hue ~222-238,
 * muted saturation, mid lightness). Followable, never identifying.
 */
export function anonymousColor(index: number, total: number): string {
  const n = Math.max(1, total);
  const t = n === 1 ? 0.5 : index / (n - 1);
  const hue = 222 + t * 16; // narrow indigo band
  const sat = 26 + ((index % 3) * 6); // 26-38%, always muted
  const light = 38 + t * 22; // 38-60%: subtle lightness ramp per bar
  return hslToHex(hue, sat, light);
}

/**
 * Chip initial for a team name: first char of the LAST word, so "Equipo Rojo"
 * reads "R" and the anonymous "Equipo A/B/C" read "A"/"B"/"C" instead of every
 * chip collapsing to "E". Single-word names keep their first char.
 */
export function teamInitial(name: string): string {
  const words = name.trim().split(/\s+/);
  const source = words[words.length - 1] || name;
  return source.charAt(0).toUpperCase();
}

/** Stable id → configured-position map from the SSR team snapshot (position order). */
export function buildPositionIndex(teamsInPositionOrder: Team[]): Map<string, number> {
  return new Map(teamsInPositionOrder.map((t, i) => [t.id, i]));
}

/**
 * Rewrite name/color of display rows with stable anonymous identities.
 * Generic over the row shape so both the lobby's Team cards and the live
 * RankedTeam rows anonymize through the same pure function.
 */
export function anonymizeIdentities<T extends { id: string; name: string; color: string }>(
  rows: T[],
  positionById: Map<string, number>,
): T[] {
  const total = Math.max(positionById.size, rows.length);
  return rows.map((row, i) => {
    const position = positionById.get(row.id) ?? i;
    return {
      ...row,
      name: anonymousName(position),
      color: anonymousColor(position, total),
    };
  });
}

/** Convenience alias with the domain shape most call sites use. */
export function anonymizeRankedTeams(
  teams: RankedTeam[],
  positionById: Map<string, number>,
): RankedTeam[] {
  return anonymizeIdentities(teams, positionById);
}
