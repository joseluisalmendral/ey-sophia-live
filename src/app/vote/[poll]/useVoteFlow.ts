"use client";

import { useCallback, useMemo, useState } from "react";
import { useLiveTally } from "@/lib/realtime/useLiveTally";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import type { Poll, PollStatus, Team } from "@/lib/types";

/**
 * useVoteFlow — the container/logic side of the voter experience.
 *
 * Owns the live tally, the derived poll status, the session action state, the
 * submit→confirm flow (fetch + confetti + haptics), the reduced-motion pref, and
 * the derived DISPLAYED phase. VoteClient consumes the return value and stays a
 * thin presentational switch over `phase`.
 *
 * Realtime status flips (open<->closed) transition the UI WITHOUT a reload
 * because the phase is derived purely from (live status + action) during render.
 */

type VoteResult =
  | "ok"
  | "already_voted"
  | "not_open"
  | "closed"
  | "invalid_team";

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
 * purely from (live status + this action) during render — so realtime status
 * flips transition the UI with no setState-in-effect and no reload.
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

export interface VoteFlow {
  status: PollStatus;
  phase: Phase;
  reduced: boolean;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  votedTeam: Team | null;
  myRank: number | null;
  error: string | null;
  submit: () => void;
  submitting: boolean;
  closesAt: string | null;
  totalTeams: number;
}

/**
 * @param alreadyVotedOnReload — seeded from a readable /vote-scoped cookie so a
 * reload after voting renders the neutral "Ya votaste" state instead of the
 * cards. Treated exactly like a server 'already_voted' (neutral, no team/rank).
 */
export function useVoteFlow(
  poll: Poll,
  teams: Team[],
  alreadyVotedOnReload = false,
): VoteFlow {
  const reduced = useReducedMotionPref();
  const live = useLiveTally(poll.id);

  // Live status wins once realtime is up; fall back to the server snapshot.
  const status: PollStatus = live.status ?? poll.status;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // votedTeamId is set ONLY on a fresh 'ok' vote — never on 'already'/reload,
  // because in those cases we do not know the voter's real team.
  const [votedTeamId, setVotedTeamId] = useState<string | null>(null);
  // Seed the action from the reload marker: neutral 'already', never 'voted'.
  const [action, setAction] = useState<Action>(
    alreadyVotedOnReload ? "already" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  // Displayed phase is derived from live status + the voter's action.
  const phase = derivePhase(status, action);

  const votedTeam = useMemo(
    () => teams.find((t) => t.id === votedTeamId) ?? null,
    [teams, votedTeamId],
  );

  const submit = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    setAction("submitting");
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, teamId: selectedId }),
      });
      const data = (await res.json()) as { result?: VoteResult; error?: string };
      const result = data.result;

      if (result === "ok") {
        // Only a fresh 'ok' identifies the real team → drives the reveal/confirm.
        setVotedTeamId(selectedId);
        if (!reduced) {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(10);
          }
          // Confetti is downloaded ONLY on a successful vote — never bundled.
          try {
            const confetti = (await import("canvas-confetti")).default;
            const anchor = document.getElementById("vote-reward");
            const rect = anchor?.getBoundingClientRect();
            const origin = rect
              ? {
                  x: (rect.left + rect.width / 2) / window.innerWidth,
                  y: rect.top / window.innerHeight,
                }
              : { x: 0.5, y: 0.85 };
            confetti({
              particleCount: 90,
              spread: 75,
              startVelocity: 45,
              origin,
              colors: ["#FFE600", "#96d3b4", "#7DB8FF", "#FFFFFF"],
              disableForReducedMotion: true,
            });
          } catch {
            // Confetti is pure delight — a failed chunk load must never break
            // the confirmation flow.
          }
        }
        setAction("voted");
      } else if (result === "already_voted") {
        // Neutral: we do NOT know their real team, so no votedTeamId/rank.
        setAction("already");
      } else if (result === "not_open" || result === "closed") {
        setAction("rejected");
      } else {
        setError("No se pudo registrar el voto. Inténtalo de nuevo.");
        setAction("idle");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setAction("idle");
    }
  }, [selectedId, poll.id, reduced]);

  // Resolve the personal rank from the live tally at reveal (fresh 'ok' only).
  const myRank = useMemo(() => {
    if (!votedTeamId) return null;
    return live.teams.find((t) => t.id === votedTeamId)?.rank ?? null;
  }, [live.teams, votedTeamId]);

  return {
    status,
    phase,
    reduced,
    selectedId,
    setSelectedId,
    votedTeam,
    myRank,
    error,
    submit,
    submitting: action === "submitting",
    closesAt: live.closesAt ?? poll.closesAt,
    totalTeams: live.teams.length,
  };
}
