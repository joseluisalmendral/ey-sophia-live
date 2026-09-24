"use client";

import { MascotHost } from "@/components/mascot/MascotHost";
import { useLiveTally } from "@/lib/realtime/useLiveTally";
import { useLocalStatusFlip } from "@/lib/polling/useLocalStatusFlip";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import type { Poll, PollStatus, Team } from "@/lib/types";
import { ScreenStage } from "./ScreenStage";
import { useLobbyJoins } from "./useLobbyJoins";

/**
 * ScreenClient — the projector CONTAINER (/screen/[poll], /tv/[slug]).
 *
 * Owns every data hook (realtime tally, local status flip, lobby join polling,
 * reduced-motion pref) and hands plain props to the presentational
 * ScreenStage, which draws the 16:9 board. The displayed stage is derived from
 * the live poll status (via useLiveTally), so an admin opening/closing the poll
 * flips the screen in realtime with no reload:
 *
 *   draft | countdown  -> LobbyStage  (giant QR to the VOTER url + teased zeros)
 *   open               -> LiveStage   (continuous bar-race OR donut/columns)
 *   closed             -> RevealStage (3-beat suspense -> podium -> fireworks)
 *
 * A persistent connection indicator (subtle) reflects the realtime state without
 * ever blanking the board on a gap (the hook keeps last counts).
 */

export interface ScreenClientProps {
  poll: Poll;
  teams: Team[];
  /** Absolute URL the on-screen QR encodes — the VOTER url /vote/<join_code>. */
  voterUrl: string;
}

/**
 * Assistant config fields land with E4 (migration + admin form). Until then
 * the Poll row may not carry them: read structurally and fall back to the
 * defaults {enabled, 14 s, 28 s}. The host also sanitizes the interval.
 */
function assistantConfig(poll: Poll) {
  const p = poll as Poll & {
    assistantEnabled?: boolean | null;
    assistantMinSeconds?: number | null;
    assistantMaxSeconds?: number | null;
  };
  return {
    enabled: p.assistantEnabled ?? true,
    min: p.assistantMinSeconds ?? 14,
    max: p.assistantMaxSeconds ?? 28,
  };
}

export function ScreenClient({ poll, teams, voterUrl }: ScreenClientProps) {
  const reduced = useReducedMotionPref();
  const assistant = assistantConfig(poll);
  // Effective status derived from the SSR snapshot ALONE (local flip included):
  // before the first status broadcast the hook has no status, so this is the
  // only signal that the poll is already open — it keeps the open-poll resync
  // backstop running for a screen that mounts mid-vote.
  const ssrEffectiveStatus = useLocalStatusFlip(
    poll.status,
    poll.opensAt,
    poll.closesAt,
  );
  const live = useLiveTally(poll.id, {
    assumeOpen: ssrEffectiveStatus === "open",
  });

  // Live status wins once realtime is up; fall back to the server snapshot.
  const baseStatus: PollStatus = live.status ?? poll.status;
  // Once a status broadcast has arrived, its opens_at/closes_at are
  // authoritative INCLUDING null: after a relaunch the server clears both, and
  // falling back to the stale SSR snapshot would let the local flip re-derive
  // open/closed from the previous run's deadlines. The SSR snapshot is only
  // trusted before the first broadcast.
  const opensAt = live.status !== null ? live.opensAt : poll.opensAt;
  const closesAt = live.status !== null ? live.closesAt : poll.closesAt;

  // LOCAL FLIP (same as the voter's): when a count-in is configured, derive
  // `open` CLIENT-SIDE the instant opens_at passes instead of waiting for the
  // status broadcast round-trip. countdown → live then lands on the projector
  // at the exact same wall-clock moment the phones flip to the vote cards.
  // Forward-only; the realtime `status` broadcast remains the authority.
  const status = useLocalStatusFlip(baseStatus, opensAt, closesAt);

  // Lobby join feed (HTTP polling): runs only while the lobby is on screen —
  // the same lifetime it had when LobbyStage owned it (no teams = no lobby).
  const lobbyOnScreen =
    teams.length > 0 && (status === "draft" || status === "countdown");
  const { count: joined } = useLobbyJoins(poll.id, lobbyOnScreen);

  return (
    <ScreenStage
      poll={poll}
      teams={teams}
      liveTeams={live.teams}
      voterUrl={voterUrl}
      status={status}
      opensAt={opensAt}
      closesAt={closesAt}
      joined={joined}
      connectionState={live.connectionState}
      ready={live.ready}
      reduced={reduced}
      // Co-host: reads the derived stage data through ScreenStage's context.
      // No new network calls or subscriptions.
      mascotSlot={<MascotHost config={assistant} reduced={reduced} />}
    />
  );
}

export default ScreenClient;
