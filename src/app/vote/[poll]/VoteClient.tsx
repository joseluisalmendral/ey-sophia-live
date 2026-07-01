"use client";

import { AnimatePresence, motion } from "motion/react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { durations, easings } from "@/lib/motion/tokens";
import type { Poll, Team } from "@/lib/types";
import { useVoteFlow } from "./useVoteFlow";
import { COPY } from "./views/shared";
import { VotingView } from "./views/VotingView";
import { ConfirmView } from "./views/ConfirmView";
import { AlreadyVotedView } from "./views/AlreadyVotedView";
import { ClosedView } from "./views/ClosedView";
import { RevealView } from "./views/RevealView";

/**
 * VoteClient — thin presentational shell for the voter experience.
 *
 * All state and side effects live in `useVoteFlow`; this component is a switch
 * over the derived `phase` that renders the shader stage, the sticky CTA (only
 * while voting), and the matching view. Realtime status flips (open<->closed)
 * transition the UI WITHOUT a reload because `phase` is derived during render.
 *
 * Accessibility: real <button>s with aria-pressed, focus-visible (global ring),
 * contrast via pickTextOn, full reduced-motion path (no scale/burst/haptics ->
 * crossfades). Haptics + confetti only fire on a fresh 'ok' vote when motion is
 * allowed; the confetti bundle is downloaded lazily at that moment.
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
    error,
    submit,
    submitting,
    opensAt,
    closesAt,
    totalTeams,
  } = useVoteFlow(poll, teams, alreadyVotedOnReload);

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
              onSelect={setSelectedId}
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
            <ClosedView key="closed" reduced={reduced} />
          )}

          {phase === "reveal" && (
            <RevealView
              key="reveal"
              team={votedTeam}
              rank={myRank}
              total={totalTeams}
              reduced={reduced}
            />
          )}
        </AnimatePresence>

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
                  onClick={submit}
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

export default VoteClient;
