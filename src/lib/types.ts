/**
 * Shared domain types for EY SophIA Live Voting.
 *
 * These mirror the data contract in the spec (sdd/ey-sophia-voting/spec, section 4).
 * The DB (Supabase/Postgres) is the source of truth; these types describe the
 * shapes the client and server exchange.
 */

/**
 * Poll lifecycle state machine:
 *   draft --(count-in)--> countdown --(open)--> open --(close / auto-close)--> closed
 *   draft --(open directly)----------------------------------------------> open
 * `closed` is terminal for a poll's voting in this delta.
 */
export type PollStatus = "draft" | "countdown" | "open" | "closed";

/** How the display renders the live tally. */
export type ChartType = "bar_race" | "donut" | "columns";

/**
 * Tie resolution rule applied at reveal:
 * - `first_to_count`: the team that reached the winning count first wins (single crown).
 * - `double_crown`: tied leaders are shown as co-winners (two crowns).
 */
export type TieRule = "first_to_count" | "double_crown";

/** A configured poll. Maps to the `polls` table. */
export interface Poll {
  id: string;
  title: string;
  status: PollStatus;
  /** Set when the poll enters `open`. */
  opensAt: string | null;
  /** Set only when a duration was configured at open time (server-authoritative close). */
  closesAt: string | null;
  /** Optional open-poll duration in seconds; null = stays open until manual close. */
  durationSeconds: number | null;
  chartType: ChartType;
  showLegend: boolean;
  tieRule: TieRule;
  /** Short, memorable join code shown on the projector. */
  joinCode: string;
  createdAt: string;
}

/** A team competing in a poll. Maps to the `teams` table. */
export interface Team {
  id: string;
  pollId: string;
  name: string;
  /** Arbitrary brand hex; text drawn on top must use `pickTextOn`. */
  color: string;
}

/**
 * A team's current vote count. Maps to the `team_tallies` counter row.
 * Realtime broadcasts the ABSOLUTE `count` (never a delta) so a lost frame
 * cannot desync the client.
 */
export interface Tally {
  teamId: string;
  pollId: string;
  count: number;
}

/** A team with its tally and derived ranking, ready for display. */
export interface RankedTeam extends Team {
  count: number;
  /** 1-based rank by count (ties share a rank, resolved by `tieRule` at reveal). */
  rank: number;
  /** Whole-number share of total, or null until results are meaningful. */
  percentage: number | null;
}

/** Realtime payloads broadcast on the private channel `poll:<id>`. */
export type RealtimeEvent =
  | { type: "tally"; pollId: string; teamId: string; count: number }
  | { type: "status"; pollId: string; status: PollStatus; closesAt?: string | null };

/** Connection state for the live tally hook; distinguishes "connecting" from a genuine zero. */
export type ConnectionState = "connecting" | "live" | "reconnecting" | "closed";
