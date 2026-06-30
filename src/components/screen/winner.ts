import type { RankedTeam, TieRule } from "@/lib/types";

/**
 * Winner resolution for the projector reveal.
 *
 * `useLiveTally` already returns teams ordered by count desc with a stable
 * tiebreak by team_position (which mirrors DB order). That ordering IS the
 * deterministic source of truth, so winner logic here is pure presentation on
 * top of it — it NEVER recomputes ranking, only decides how the top renders.
 *
 * Tie rules (poll.tie_rule):
 *  - `first_to_count`: a single deterministic winner. The hook's stable order
 *    already encodes "who got there first" via team_position, so the top team
 *    is the winner even on a count tie.
 *  - `double_crown`: if the top two teams share the leading count, BOTH are
 *    crowned (co-winners, shared center).
 *
 * Zero-vote close is surfaced explicitly so the reveal can render a designed
 * "no votes" state instead of crowning a team with 0.
 */

export interface RevealOutcome {
  /** Teams that get a crown (1 normally, 2 on a double-crown tie). */
  winners: RankedTeam[];
  /** The podium occupants in display order: [first, second, third] (some may be undefined). */
  podium: [RankedTeam | undefined, RankedTeam | undefined, RankedTeam | undefined];
  /** True when the poll closed with no votes at all. */
  zeroVotes: boolean;
  /** True when two teams share the lead AND tie_rule === double_crown. */
  doubleCrown: boolean;
  totalVotes: number;
}

export function resolveReveal(
  teams: RankedTeam[],
  tieRule: TieRule,
): RevealOutcome {
  const totalVotes = teams.reduce((sum, t) => sum + t.count, 0);
  const zeroVotes = totalVotes === 0;

  const [first, second, third] = teams;

  // Double-crown only when the rule allows it, there are >= 2 teams, the top two
  // share the exact leading count, and that count is non-zero.
  const doubleCrown =
    tieRule === "double_crown" &&
    !zeroVotes &&
    !!first &&
    !!second &&
    first.count === second.count;

  const winners = zeroVotes
    ? []
    : doubleCrown
      ? [first, second]
      : first
        ? [first]
        : [];

  return {
    winners,
    podium: [first, second, third],
    zeroVotes,
    doubleCrown,
    totalVotes,
  };
}
