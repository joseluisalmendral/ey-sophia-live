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
  /**
   * Presentation-only: when true the projector hides team names/colors during
   * lobby/countdown/open and reveals identities only in the final reveal.
   * Voter and admin surfaces always see the real identities.
   */
  anonymousDisplay: boolean;
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

/**
 * Realtime payloads broadcast on the private channel `poll:<id>`.
 *
 * WIRE SHAPE IS snake_case — these are emitted verbatim by the DB triggers via
 * `realtime.send(payload jsonb, ...)` (see build/supabase, engram #926). The DB
 * is the authoritative contract; the client normalizes these into camelCase
 * domain state. Do NOT rename these fields to camelCase.
 *  - `tally`  {type, poll_id, team_id, count}  — count is ABSOLUTE, latest wins.
 *  - `status` {type, poll_id, status, closes_at, opens_at} — closes_at/opens_at
 *    are stamped by set_poll_status on 'open'.
 */
export type RealtimeEvent =
  | { type: "tally"; poll_id: string; team_id: string; count: number }
  | {
      type: "status";
      poll_id: string;
      status: PollStatus;
      closes_at?: string | null;
      opens_at?: string | null;
    };

/** Connection state for the live tally hook; distinguishes "connecting" from a genuine zero. */
export type ConnectionState = "connecting" | "live" | "reconnecting" | "closed";
