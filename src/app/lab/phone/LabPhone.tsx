"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { derivePhase, projectorRanking } from "@/app/vote/[poll]/phase";
import {
  PHONE_REVEAL_HOLD_MS,
  PHONE_REVEAL_HOLD_REDUCED_MS,
  useRevealHold,
} from "@/app/vote/[poll]/revealHold";
import { VoteShell } from "@/app/vote/[poll]/VoteShell";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import type { PollStatus } from "@/lib/types";
import type { LabMessage } from "@/lab/channel";
import type { LabSettings, LabSnapshot } from "@/lab/engine";
import { LabSettingsProvider } from "@/lab/LabContext";
import type { PersonaId, PersonaState } from "@/lab/personas";
import { useLabDriver, useLabFollower, useStructural } from "@/lab/useLab";
import { LabWaiting } from "../screen/LabScreen";

/**
 * LabPhone — one scripted voter: the PRODUCTION VoteShell + the REAL
 * derivePhase, fed by the persona's scripted action at the engine's virtual
 * time. Tapping a card or the CTA takes over the persona (manual override)
 * and submits to a FAKE local handler — this file never calls /api/vote.
 */

/** Fake submit latency (ms), like a POST on venue Wi-Fi. */
const FAKE_SUBMIT_MS = 600;

interface Override extends PersonaState {
  runId: number;
  justMissed: boolean;
}

export function LabPhone({
  persona,
  drive,
  autoplay,
}: {
  persona: PersonaId;
  drive: LabSettings | null;
  autoplay: boolean;
}) {
  const [override, setOverride] = useState<Override | null>(null);
  const onFollowerMessage = useCallback(
    (msg: LabMessage) => {
      if (msg.type === "persona-reset" && msg.id === persona) setOverride(null);
    },
    [persona],
  );
  const driver = useLabDriver(drive, { autoplay });
  const follower = useLabFollower(drive === null, onFollowerMessage);
  const snap = drive ? driver.snap : follower.snap;
  const post = useMemo(
    () =>
      drive
        ? driver.controls.post
        : (msg: LabMessage) => follower.channel?.post(msg),
    [drive, driver.controls.post, follower.channel],
  );

  if (!snap) return <LabWaiting />;
  return (
    <LabPhoneShell
      persona={persona}
      snap={snap}
      override={override}
      setOverride={setOverride}
      post={post}
    />
  );
}

function LabPhoneShell({
  persona,
  snap,
  override,
  setOverride,
  post,
}: {
  persona: PersonaId;
  snap: LabSnapshot;
  override: Override | null;
  setOverride: (o: Override | null | ((prev: Override | null) => Override | null)) => void;
  post: (msg: LabMessage) => void;
}) {
  const osReduced = useReducedMotionPref();
  const reduced = snap.settings.reduced || osReduced;
  const poll = useStructural(snap.poll);
  const teams = useStructural(snap.teams);
  const frame = useStructural({
    assistant: snap.settings.assistant,
    showKeepouts: snap.settings.showKeepouts,
    reduced,
  });

  // A manual override only lives within its run (reset/scenario/seed drop it).
  const active = override && override.runId === snap.runId ? override : null;
  const state: PersonaState = active ?? snap.personas[persona];
  const phase = derivePhase(snap.status, state.action);
  const manual = active !== null;

  // Latest status for the fake submit's resolution (read at fire time).
  const statusRef = useRef<PollStatus>(snap.status);
  useEffect(() => {
    statusRef.current = snap.status;
  }, [snap.status]);
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (submitTimer.current !== null) clearTimeout(submitTimer.current);
    },
    [],
  );

  const onSelect = (id: string) =>
    setOverride({ ...state, runId: snap.runId, justMissed: false, selectedId: id });

  // FAKE submit: resolves locally like the server would (ok while open,
  // 'closed' after the deadline). Never touches the network.
  const onSubmit = () => {
    if (!state.selectedId) return;
    setOverride({ ...state, runId: snap.runId, justMissed: false, action: "submitting" });
    if (submitTimer.current !== null) clearTimeout(submitTimer.current);
    submitTimer.current = setTimeout(() => {
      const status = statusRef.current;
      setOverride((prev) => {
        if (!prev) return prev;
        return status === "open"
          ? { ...prev, action: "voted", votedTeamId: prev.selectedId }
          : { ...prev, action: "rejected", justMissed: status === "closed" };
      });
    }, FAKE_SUBMIT_MS);
  };

  useEffect(() => {
    post({ type: "persona", id: persona, phase, manual });
  }, [post, persona, phase, manual]);

  const votedTeam = teams.find((t) => t.id === state.votedTeamId) ?? null;
  // Projector-first hold, measured from this phone's reveal entry. The lab
  // projector runs in the same browser, so its reduced-motion arc is known.
  const revealArmed = useRevealHold(
    phase === "reveal",
    reduced ? PHONE_REVEAL_HOLD_REDUCED_MS : PHONE_REVEAL_HOLD_MS,
  );
  // Personal rank + list: production fetches them once after close; the lab
  // ranks the final snapshot tally with the same projector-consistent rule.
  const placed =
    phase === "reveal" && state.votedTeamId
      ? projectorRanking(
          snap.liveTeams.map((t, i) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            count: t.count,
            position: i,
          })),
          poll.tieRule,
        )
      : null;
  const rank = placed?.ranking.find((r) => r.id === state.votedTeamId)?.rank ?? null;
  const ranking = placed && !placed.splitLead ? placed.ranking : null;

  return (
    <LabSettingsProvider value={frame}>
      <VoteShell
        poll={poll}
        teams={teams}
        phase={phase}
        selectedId={state.selectedId}
        onSelect={onSelect}
        onSubmit={onSubmit}
        submitting={state.action === "submitting"}
        error={null}
        votedTeam={votedTeam}
        rank={rank}
        ranking={ranking}
        revealArmed={revealArmed}
        totalTeams={teams.length}
        justMissed={active?.justMissed ?? false}
        opensAt={snap.opensAt}
        closesAt={snap.closesAt}
        reduced={reduced}
      />
    </LabSettingsProvider>
  );
}
