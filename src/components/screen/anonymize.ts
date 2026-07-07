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
 * Labels: every masked team has an EMPTY name — no label at all (not even a
 * placeholder), so nothing on screen invites the room to map labels to teams.
 * Visual tracking of each bar is carried by the grey variants + the bar's
 * position, never by the label.
 *
 * Color assignment is keyed on the team's CONFIGURED position, NEVER on the
 * current ranking: a rank-based shade would re-identify teams the moment bars
 * swap (the shade would visibly follow the movement the audience already
 * associates with a team). Position is stable for the whole run, so each bar
 * keeps its shade and can be followed as a bar — without leaking which real
 * team it is.
 *
 * Colors: N NEUTRAL GREYS — never the EY yellow accent, never anything close to
 * a real team color (the event teams are green, purple, orange, blue and
 * yellow; even a muted indigo reads as "the blue team"). Saturation stays at
 * ~5% (no perceivable tint) and the variants differ by a lightness ramp, so
 * each bar is followable across FLIP reorders while the whole set reads as
 * "identity withheld". Labels drawn on top must keep using pickTextOn.
 */

/**
 * The single masked label: the EMPTY string. All hidden teams share it on
 * purpose — any per-team label (letters, numbers, even "???") invites the room
 * to map labels to teams. teamInitial("") yields "" so the chips collapse to a
 * plain grey dot too.
 */
export const ANONYMOUS_NAME = "";

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
 * N distinguishable NEUTRAL GREYS. Identity lives in the lightness ramp
 * (L 32% → 68% by configured position); a barely-there ±4 warm/cool hue nudge
 * at ~5% saturation separates neighbouring bars without ever suggesting a team
 * color. At this saturation no grey can read as green/purple/orange/blue/
 * yellow/red. pickTextOn stays AA on the whole ramp (white on the dark end,
 * black on the light end).
 */
export function anonymousColor(index: number, total: number): string {
  const n = Math.max(1, total);
  const t = n === 1 ? 0.5 : index / (n - 1);
  // Alternate a faintly warm (30°) / faintly cool (222°) cast between
  // neighbours — imperceptible as color at 5% saturation, just enough to
  // keep adjacent greys from merging.
  const hue = index % 2 === 0 ? 222 : 30;
  const sat = 5; // ~neutral: no appreciable tint
  const light = 32 + t * 36; // 32-68%: the ramp that makes each bar followable
  return hslToHex(hue, sat, light);
}

/**
 * Chip initial for a team name: first char of the LAST word, so "Equipo Rojo"
 * reads "R" instead of every chip collapsing to "E". Single-word names keep
 * their first char; the anonymous empty name yields "" (chip renders as a
 * plain color dot).
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
      name: ANONYMOUS_NAME,
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
