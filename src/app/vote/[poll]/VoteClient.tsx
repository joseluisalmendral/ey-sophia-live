"use client";

import type { Poll, Team } from "@/lib/types";
import { useVoteFlow } from "./useVoteFlow";
import { useLobbyJoin } from "./useLobbyJoin";
import { VoteShell } from "./VoteShell";

/**
 * VoteClient — the voter CONTAINER.
 *
 * All state and side effects live in `useVoteFlow` (+ the lobby join
 * one-shot); this component only wires them into the presentational
 * VoteShell. Realtime status flips (open<->closed) transition the UI WITHOUT a
 * reload because `phase` is derived during render. Haptics + confetti only
 * fire on a fresh 'ok' vote when motion is allowed; the confetti bundle is
 * downloaded lazily at that moment.
 */

export function VoteClient({
  poll,
  teams,
  alreadyVotedOnReload = false,
}: {
  poll: Poll;
  teams: Team[];
  /** Seeded from a readable /vote-scoped cookie set after a successful vote. */
  alreadyVotedOnReload?: boolean;
}) {
  const {
    phase,
    reduced,
    selectedId,
    setSelectedId,
    votedTeam,
    myRank,
    ranking,
    revealArmed,
    error,
    submit,
    submitting,
    opensAt,
    closesAt,
    totalTeams,
    justMissed,
    relaunchEpoch,
  } = useVoteFlow(poll, teams, alreadyVotedOnReload);

  // Lobby-only one-shot HTTP join: lets the projector show this voter joining
  // (anonymous alias) via its polled feed. NO websocket anywhere on the voter
  // path (see useLobbyJoin for the scope rationale).
  useLobbyJoin(poll.id, phase === "lobby", relaunchEpoch);

  return (
    <VoteShell
      poll={poll}
      teams={teams}
      phase={phase}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onSubmit={submit}
      submitting={submitting}
      error={error}
      votedTeam={votedTeam}
      rank={myRank}
      ranking={ranking}
      revealArmed={revealArmed}
      totalTeams={totalTeams}
      justMissed={justMissed}
      opensAt={opensAt}
      closesAt={closesAt}
      reduced={reduced}
    />
  );
}

export default VoteClient;
