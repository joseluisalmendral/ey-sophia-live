"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { MascotBoundary } from "@/components/mascot/MascotBoundary";
import { PhoneMascot } from "@/components/mascot/PhoneMascot";
import { durations, easings } from "@/lib/motion/tokens";
import type { Poll, Team } from "@/lib/types";
import type { Phase, RankingEntry } from "./phase";
import { PhoneHeader } from "./views/shared";
import { LobbyView } from "./views/LobbyView";
import { VotingView } from "./views/VotingView";
import { VoteButton } from "./views/VoteButton";
import { ConfirmView } from "./views/ConfirmView";
import { AlreadyVotedView } from "./views/AlreadyVotedView";
import { ClosedView } from "./views/ClosedView";
import { RevealView } from "./views/RevealView";
import "./vote.css";

/**
 * VoteShell — the PRESENTATIONAL voter experience (no data hooks, no network).
 *
 * A switch over the derived `phase` that renders the shader stage, the compact
 * brand header, the phone co-host row (Broqui, when the poll has the assistant
 * enabled), the matching view and — while voting — the sticky "Votar a
 * {team}" CTA (tap a card to pick, tap the button to vote). Fed by VoteClient in production (useVoteFlow) and by the /lab phone
 * personas (fake submit).
 *
 * Accessibility: real buttons (radio semantics on the cards, a plain button
 * for the vote), focus-visible (global ring), contrast via pickTextOn, full
 * reduced-motion path (cross-fades, no scale, no burst).
 */

export interface VoteShellProps {
  poll: Poll;
  teams: Team[];
  /** Derived displayed phase (see ./phase derivePhase). */
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Fires the vote submit (production: POST /api/vote; lab: fake handler). */
  onSubmit: () => void;
  submitting: boolean;
  /** Inline error above the CTA; null when none. */
  error: string | null;
  /** Team of a fresh 'ok' vote in this session; null otherwise. */
  votedTeam: Team | null;
  /** Personal rank of votedTeam at reveal; null = neutral reveal. */
  rank: number | null;
  /** Final ranked list for the personal result (same one-shot fetch); null = none. */
  ranking?: readonly RankingEntry[] | null;
  /**
   * Projector-first gate (see ../revealHold): false while the projector's
   * reveal arc is still running. Until true the phone shows a suspense state
   * and Broqui stays nervous — no rank, no list, no winner line.
   */
  revealArmed: boolean;
  totalTeams: number;
  /** The submit bounced with 'closed' (honest "just missed" copy). */
  justMissed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  reduced: boolean;
  /**
   * Optional extra mount point rendered after the views (outside the phase
   * AnimatePresence). The phone mascot itself is built in (PhoneMascot) and
   * follows `poll.assistantEnabled`.
   */
  mascotSlot?: ReactNode;
}

export function VoteShell({
  poll,
  teams,
  phase,
  selectedId,
  onSelect,
  onSubmit,
  submitting,
  error,
  votedTeam,
  rank,
  ranking = null,
  revealArmed,
  totalTeams,
  justMissed,
  opensAt,
  closesAt,
  reduced,
  mascotSlot = null,
}: VoteShellProps) {
  const selectedTeam = teams.find((t) => t.id === selectedId) ?? null;
  const voting = phase === "voting" || phase === "submitting";

  return (
    <ShaderBackground>
      <main
        className={`relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-x-clip px-4 pt-[max(0.25rem,env(safe-area-inset-top))] ${
          voting ? "pb-36" : "pb-10"
        }`}
      >
        <PhoneHeader />

        {poll.assistantEnabled !== false && (
          <MascotBoundary name="phone">
            <PhoneMascot
              phase={phase}
              teamName={votedTeam?.name ?? null}
              rank={phase === "reveal" && revealArmed ? rank : null}
              revealHeld={phase === "reveal" && !revealArmed}
              reduced={reduced}
            />
          </MascotBoundary>
        )}

        <AnimatePresence mode="wait">
          {phase === "lobby" && (
            <LobbyView
              key="lobby"
              poll={poll}
              teams={teams}
              opensAt={opensAt}
              reduced={reduced}
            />
          )}

          {voting && (
            <VotingView
              key="voting"
              teams={teams}
              phase={phase}
              selectedId={selectedId}
              onSelect={onSelect}
              reduced={reduced}
              closesAt={closesAt}
            />
          )}

          {phase === "confirm" && votedTeam && (
            <ConfirmView key="confirm" team={votedTeam} reduced={reduced} />
          )}

          {phase === "alreadyVoted" && (
            <AlreadyVotedView key="already" reduced={reduced} />
          )}

          {phase === "closedNoVote" && (
            <ClosedView key="closed" reduced={reduced} justMissed={justMissed} />
          )}

          {phase === "reveal" && (
            <RevealView
              key="reveal"
              team={votedTeam}
              rank={rank}
              total={totalTeams}
              ranking={ranking}
              armed={revealArmed}
              reduced={reduced}
            />
          )}
        </AnimatePresence>

        {mascotSlot}

        {/* Sticky thumb-zone CTA — only while voting. */}
        <AnimatePresence>
          {voting && (
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: durations.base, ease: easings.standard }}
              className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10"
              style={{
                background:
                  "linear-gradient(to top, var(--color-cosmic-deep) 45%, rgb(11 16 38 / 0.85) 70%, transparent)",
              }}
            >
              {error && (
                <p role="alert" className="mb-2 text-center text-small text-[#FF8A8A]">
                  {error}
                </p>
              )}
              <div className="relative mx-auto max-w-md">
                {/* Positioning anchor for the confetti burst origin (centered
                    above the button). Lazy canvas-confetti reads its rect. */}
                <span
                  id="vote-reward"
                  className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
                />
                <VoteButton
                  team={selectedTeam}
                  submitting={submitting}
                  onSubmit={onSubmit}
                  reduced={reduced}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </ShaderBackground>
  );
}

export default VoteShell;
