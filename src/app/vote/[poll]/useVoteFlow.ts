"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePollStatus } from "@/lib/polling/usePollStatus";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import type { Poll, PollStatus, Team } from "@/lib/types";

/**
 * useVoteFlow — the container/logic side of the voter experience.
 *
 * Owns the derived poll status (via HTTP polling, NOT realtime), the session
 * action state, the submit→confirm flow (fetch + confetti + haptics), the
 * reduced-motion pref, and the derived DISPLAYED phase. VoteClient consumes the
 * return value and stays a thin presentational switch over `phase`.
 *
 * NO WEBSOCKET on the voter path. Voters never open a Supabase realtime channel
 * — that would count against the 200 concurrent-connection cap and not scale to
 * a large room. Instead `usePollStatus` polls a CDN-cached status endpoint on a
 * slow, jittered, visibility-aware cadence, so the whole room collapses to a few
 * origin hits/sec. The projector (/screen) keeps realtime unchanged.
 *
 * Status flips (draft/countdown → open → closed) transition the UI WITHOUT a
 * reload because the phase is derived purely from (polled status + action)
 * during render.
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

/** Row shape returned by /api/poll/[id]/results (mirrors the get_results RPC). */
interface ResultsRow {
  team_id: string;
  name: string;
  color: string;
  team_position: number;
  count: number;
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

  // Seed the action from the reload marker: neutral 'already', never 'voted'.
  const [action, setAction] = useState<Action>(
    alreadyVotedOnReload ? "already" : "idle",
  );

  // A voter who has acted (voted or already/reload marker) no longer needs the
  // fast "open flip" cadence — they only await close. usePollStatus slows to the
  // AFTER-vote cadence and keeps polling until the poll is closed.
  const hasActed = action === "voted" || action === "already";
  const poller = usePollStatus(poll.id, { hasActed });

  // Polled status wins once it resolves; fall back to the server snapshot before
  // the first successful poll.
  const status: PollStatus = poller.status ?? poll.status;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // votedTeamId is set ONLY on a fresh 'ok' vote — never on 'already'/reload,
  // because in those cases we do not know the voter's real team.
  const [votedTeamId, setVotedTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Final ranked results, fetched EXACTLY ONCE when the poll closes and the
  // voter has a known team (fresh 'ok' vote). Drives the personal "#N" reveal.
  const [rankedResults, setRankedResults] = useState<ResultsRow[]>([]);
  const resultsFetched = useRef(false);

  // Displayed phase is derived from polled status + the voter's action.
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

  // Personal reveal: when the poll closes AND the voter cast a known vote, fetch
  // the ranked results ONCE from the cached endpoint. Any failure degrades to
  // the neutral "watch the big screen" reveal (rank stays null) — never an error.
  useEffect(() => {
    if (status !== "closed" || !votedTeamId || resultsFetched.current) return;
    resultsFetched.current = true;
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/poll/${encodeURIComponent(poll.id)}/results`,
          { cache: "no-store" },
        );
        if (!active || !res.ok) return;
        const data = (await res.json()) as { teams?: ResultsRow[] };
        if (active && Array.isArray(data.teams)) {
          setRankedResults(data.teams);
        }
      } catch {
        // Silent: reveal falls back to the neutral state.
      }
    })();
    return () => {
      active = false;
    };
  }, [status, votedTeamId, poll.id]);

  // Personal rank from the one-shot results fetch (dense 1-based ranking, ties
  // share a rank — matches the projector's ranking). Only a fresh vote reaches
  // the reveal phase, so votedTeamId is always known when this matters.
  const myRank = useMemo(() => {
    if (!votedTeamId || rankedResults.length === 0) return null;
    const sorted = [...rankedResults].sort(
      (a, b) => b.count - a.count || a.team_position - b.team_position,
    );
    let lastCount = Number.POSITIVE_INFINITY;
    let lastRank = 0;
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      const rank = row.count === lastCount ? lastRank : i + 1;
      lastCount = row.count;
      lastRank = rank;
      if (row.team_id === votedTeamId) return rank;
    }
    return null;
  }, [rankedResults, votedTeamId]);

  // Total finalists is stable from the server props; fall back to the fetched
  // results length (keeps the "de N finalistas" copy correct).
  const totalTeams = teams.length || rankedResults.length;

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
    closesAt: poller.closesAt ?? poll.closesAt,
    totalTeams,
  };
}
