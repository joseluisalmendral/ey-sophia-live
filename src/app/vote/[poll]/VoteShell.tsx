"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { durations, easings } from "@/lib/motion/tokens";
import type { Poll, Team } from "@/lib/types";
import type { Phase } from "./phase";
import { COPY } from "./views/shared";
import { VotingView } from "./views/VotingView";
import { ConfirmView } from "./views/ConfirmView";
import { AlreadyVotedView } from "./views/AlreadyVotedView";
import { ClosedView } from "./views/ClosedView";
import { RevealView } from "./views/RevealView";

/**
 * VoteShell — the PRESENTATIONAL voter experience (no data hooks, no network).
 *
 * A switch over the derived `phase` that renders the shader stage, the sticky
 * CTA (only while voting), and the matching view. Fed by VoteClient in
 * production (useVoteFlow) and by the /lab phone personas (fake submit).
 *
 * Accessibility: real <button>s with aria-pressed, focus-visible (global ring),
 * contrast via pickTextOn, full reduced-motion path (no scale/burst/haptics ->
 * crossfades).
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
  /** Personal dense rank of votedTeam at reveal; null = neutral reveal. */
  rank: number | null;
  totalTeams: number;
  /** The submit bounced with 'closed' (honest "just missed" copy). */
  justMissed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  reduced: boolean;
  /**
   * Phone mascot mount point: rendered inside <main>, OUTSIDE the phase
   * AnimatePresence and above the views. Default: nothing.
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
  totalTeams,
  justMissed,
  opensAt,
  closesAt,
  reduced,
  mascotSlot = null,
}: VoteShellProps) {
  return (
    <ShaderBackground>
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-32 pt-6">
        <AnimatePresence mode="wait">
          {(phase === "lobby" || phase === "voting" || phase === "submitting") && (
            <VotingView
              key="voting"
              poll={poll}
              teams={teams}
              phase={phase}
              selectedId={selectedId}
              onSelect={onSelect}
              reduced={reduced}
              opensAt={opensAt}
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
              reduced={reduced}
            />
          )}
        </AnimatePresence>

        {/* Phone mascot host (E5). Outside the phase AnimatePresence. */}
        {mascotSlot}

        {/* Sticky thumb-zone CTA — only while voting. */}
        <AnimatePresence>
          {(phase === "voting" || phase === "submitting") && (
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: durations.base, ease: easings.standard }}
              className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
              style={{
                background:
                  "linear-gradient(to top, var(--color-cosmic-deep) 30%, transparent)",
              }}
            >
              {error && (
                <p className="mb-2 text-center text-small text-[#FF8A8A]">
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
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!selectedId || submitting}
                  className="h-16 w-full rounded-xl bg-ey-yellow font-display text-h3 font-extrabold text-ey-confident shadow-[var(--shadow-glow-win)] transition-[transform,opacity] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-text-dim disabled:shadow-none"
                >
                  {submitting
                    ? COPY.sending
                    : selectedId
                      ? COPY.cta
                      : COPY.ctaPick}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </ShaderBackground>
  );
}

export default VoteShell;
