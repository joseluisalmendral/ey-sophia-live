import type { PollStatus } from "@/lib/types";

/**
 * Pure voter phase derivation (no React, no network).
 *
 * Shared by the production container (useVoteFlow re-exports it unchanged)
 * and the /lab phone personas, so a rehearsal phone walks exactly the same
 * state machine as a real one.
 */

export type Phase =
  | "lobby"
  | "voting"
  | "submitting"
  | "confirm"
  | "alreadyVoted"
  | "closedNoVote"
  | "reveal";

/**
 * What the voter has actually done this session. The DISPLAYED phase is derived
 * purely from (polled status + this action) during render — so status flips
 * transition the UI with no setState-in-effect and no reload.
 */
export type Action =
  | "idle"
  | "submitting"
  | "voted" // server said 'ok'
  | "already" // server said 'already_voted' OR reload marker cookie present
  | "rejected"; // server said 'not_open' | 'closed'

export function derivePhase(status: PollStatus, action: Action): Phase {
  // Only a fresh 'ok' vote in THIS session unlocks the personal reveal/confirm.
  // 'already' is a neutral signal (dedup or reload marker) with no known team.
  const hasFreshVote = action === "voted";
  if (status === "closed") {
    if (hasFreshVote) return "reveal";
    // 'already' without a fresh vote → neutral closed state (no personal rank).
    return "closedNoVote";
  }
  if (status === "draft" || status === "countdown") {
    if (hasFreshVote) return "confirm";
    if (action === "already") return "alreadyVoted";
    return "lobby";
  }
  // status === "open"
  switch (action) {
    case "submitting":
      return "submitting";
    case "voted":
      return "confirm";
    case "already":
      return "alreadyVoted";
    case "rejected":
      return "closedNoVote";
    default:
      return "voting";
  }
}
