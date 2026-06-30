"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReward } from "react-rewards";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { SophiaBanner } from "@/components/brand/SophiaBanner";
import { EyBeam } from "@/components/brand/EyBeam";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { CountdownTimer } from "@/components/atoms/CountdownTimer";
import { useLiveTally } from "@/lib/realtime/useLiveTally";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import { durations, easings, springs } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import type { Poll, PollStatus, Team } from "@/lib/types";

/**
 * VoteClient — the full mobile-first voter experience.
 *
 * Drives a small state machine layered over the live poll status:
 *   lobby (draft/countdown) -> voting (open) -> confirm | alreadyVoted
 *                                            \-> closedNoVote (closed, never voted)
 *   confirm/alreadyVoted + closed -> personalReveal ("your team finished #N")
 *
 * Realtime status flips (open<->closed) transition the UI WITHOUT a reload via
 * the shared useLiveTally hook. The voted team id is held in component state so
 * the personal reveal can resolve the rank from the final tally.
 *
 * Accessibility: real <button>s with aria-pressed, focus-visible (global ring),
 * contrast via pickTextOn, full reduced-motion path (no scale/burst/haptics ->
 * crossfades). Haptics + react-rewards burst only fire when motion is allowed.
 */

type VoteResult =
  | "ok"
  | "already_voted"
  | "not_open"
  | "closed"
  | "invalid_team";

type Phase =
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
type Action =
  | "idle"
  | "submitting"
  | "voted" // server said 'ok'
  | "already" // server said 'already_voted'
  | "rejected"; // server said 'not_open' | 'closed'

function derivePhase(status: PollStatus, action: Action): Phase {
  // Once the voter has a recorded vote, the closed state becomes their reveal.
  const hasVote = action === "voted" || action === "already";
  if (status === "closed") return hasVote ? "reveal" : "closedNoVote";
  if (status === "draft" || status === "countdown") {
    return hasVote ? (action === "voted" ? "confirm" : "alreadyVoted") : "lobby";
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

const COPY = {
  tagline: "Vota al equipo finalista que más te voló la cabeza.",
  pick: "Elige uno. Tu voto cuenta una sola vez.",
  cta: "VOTAR",
  ctaPick: "Elige un equipo",
  sending: "Enviando…",
  lobbyTitle: "La votación abre en breve",
  lobbySub: "Prepara tu favorito. En cuanto se abra, tu voto entra al instante.",
  closedTitle: "La votación ya cerró",
  closedSub: "Esta vez no llegaste a tiempo, pero mira la pantalla grande.",
  confirmKicker: "¡Voto registrado!",
  confirmYour: "Tu voto por",
  confirmIn: "está dentro",
  watch: "Mira la pantalla grande",
  alreadyTitle: "Ya votaste",
  alreadySub: "Solo se permite un voto por dispositivo. Disfruta del directo.",
  revealKicker: "Resultado final",
  revealRank: "Tu equipo quedó",
} as const;

export function VoteClient({ poll, teams }: { poll: Poll; teams: Team[] }) {
  const reduced = useReducedMotionPref();
  const live = useLiveTally(poll.id);

  // Live status wins once realtime is up; fall back to the server snapshot.
  const status: PollStatus = live.status ?? poll.status;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [votedTeamId, setVotedTeamId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>("idle");
  const [error, setError] = useState<string | null>(null);

  // Displayed phase is derived from live status + the voter's action.
  const phase = derivePhase(status, action);

  const votedTeam = useMemo(
    () => teams.find((t) => t.id === votedTeamId) ?? null,
    [teams, votedTeamId],
  );

  // react-rewards confetti burst anchored to the CTA.
  const { reward, isAnimating } = useReward("vote-reward", "confetti", {
    elementCount: 90,
    spread: 75,
    startVelocity: 28,
    colors: ["#FFE600", "#96d3b4", "#7DB8FF", "#FFFFFF"],
    lifetime: 180,
  });

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

      if (result === "ok" || result === "already_voted") {
        setVotedTeamId(selectedId);
        if (result === "ok" && !reduced) {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(10);
          }
          reward();
        }
        setAction(result === "ok" ? "voted" : "already");
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
  }, [selectedId, poll.id, reduced, reward]);

  // Resolve the personal rank from the live tally at reveal.
  const myRank = useMemo(() => {
    if (!votedTeamId) return null;
    return live.teams.find((t) => t.id === votedTeamId)?.rank ?? null;
  }, [live.teams, votedTeamId]);

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
              closesAt={live.closesAt ?? poll.closesAt}
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
              total={live.teams.length}
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
                {/* react-rewards anchor sits centered above the button */}
                <span
                  id="vote-reward"
                  className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={!selectedId || phase === "submitting" || isAnimating}
                  className="h-16 w-full rounded-xl bg-ey-yellow font-display text-h3 font-extrabold text-ey-confident shadow-[var(--shadow-glow-win)] transition-[transform,opacity] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-text-dim disabled:shadow-none"
                >
                  {phase === "submitting"
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

/* ------------------------------------------------------------------ */
/* Views                                                              */
/* ------------------------------------------------------------------ */

function ViewWrap({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: durations.base, ease: easings.standard }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

function VotingView({
  poll,
  teams,
  phase,
  selectedId,
  onSelect,
  reduced,
  closesAt,
}: {
  poll: Poll;
  teams: Team[];
  phase: Phase;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reduced: boolean;
  closesAt: string | null;
}) {
  const isLobby = phase === "lobby";
  // Staggered entrance for the cards.
  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: 0.12 },
    },
  };
  const item = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 28, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1 },
      };

  return (
    <ViewWrap reduced={reduced}>
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: durations.slow, ease: easings.decel }}
      >
        <SophiaBanner variant="hero" tagline={COPY.tagline} />
      </motion.div>

      {isLobby ? (
        <LobbyTeaser
          poll={poll}
          teams={teams}
          reduced={reduced}
        />
      ) : (
        <>
          <div className="mb-3 mt-7 flex items-center justify-between">
            <p className="text-small font-medium text-text-dim">{COPY.pick}</p>
            <CountdownTimer closesAt={closesAt} size="chip" />
          </div>

          <motion.ul
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-3"
          >
            {teams.map((team) => {
              const selected = team.id === selectedId;
              const fg = pickTextOn(team.color);
              return (
                <motion.li key={team.id} variants={item}>
                  <motion.button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(team.id)}
                    disabled={phase === "submitting"}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    transition={springs.card}
                    className="relative flex min-h-[88px] w-full items-center gap-4 overflow-hidden rounded-xl px-5 text-left transition-shadow"
                    style={{
                      backgroundColor: selected
                        ? team.color
                        : "var(--color-surface-raised)",
                      color: selected ? fg : "var(--color-text)",
                      boxShadow: selected
                        ? "var(--shadow-e2)"
                        : "var(--shadow-e1)",
                      outline: selected
                        ? `3px solid ${team.color}`
                        : "1px solid rgba(255,255,255,0.08)",
                      outlineOffset: selected ? "2px" : "0px",
                    }}
                  >
                    <TeamColorChip
                      color={team.color}
                      label={team.name.charAt(0).toUpperCase()}
                      size={40}
                    />
                    <span className="flex-1 font-display text-h3 font-bold">
                      {team.name}
                    </span>
                    {/* Selection shown by checkmark + ring, never hue alone. */}
                    <AnimatePresence>
                      {selected && (
                        <motion.span
                          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={springs.slam}
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: fg,
                            color: team.color,
                          }}
                          aria-hidden
                        >
                          <CheckIcon />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.li>
              );
            })}
          </motion.ul>
        </>
      )}
    </ViewWrap>
  );
}

function LobbyTeaser({
  poll,
  teams,
  reduced,
}: {
  poll: Poll;
  teams: Team[];
  reduced: boolean;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-6 text-center">
      <motion.div
        animate={reduced ? undefined : { opacity: [0.6, 1, 0.6] }}
        transition={
          reduced
            ? undefined
            : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
        className="flex flex-col items-center gap-2"
      >
        <span className="text-micro uppercase tracking-[0.3em] text-ey-yellow">
          {poll.status === "countdown" ? "Preparados…" : "En breve"}
        </span>
        <h2 className="font-display text-h1 font-extrabold text-text">
          {COPY.lobbyTitle}
        </h2>
        <p className="max-w-xs text-balance text-small leading-relaxed text-text-dim">
          {COPY.lobbySub}
        </p>
      </motion.div>

      {/* Finalists teased at zero — anticipation, never a dead "no data". */}
      <ul className="flex w-full flex-col gap-2.5">
        {teams.map((team, i) => (
          <motion.li
            key={team.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: reduced ? 0 : 0.15 + i * 0.08,
              duration: durations.base,
              ease: easings.standard,
            }}
            className="flex items-center gap-3 rounded-lg border border-white/8 bg-surface-raised/60 px-4 py-3"
          >
            <TeamColorChip
              color={team.color}
              label={team.name.charAt(0).toUpperCase()}
              size={32}
            />
            <span className="flex-1 text-left font-display text-body font-semibold text-text">
              {team.name}
            </span>
            <span className="tabular-nums text-h3 font-extrabold text-text-dim">
              0
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function ConfirmView({ team, reduced }: { team: Team; reduced: boolean }) {
  const fg = pickTextOn(team.color);
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-7 py-10 text-center">
        <motion.div
          initial={reduced ? { opacity: 0 } : { scale: 0, rotate: -20 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, rotate: 0 }}
          transition={springs.podiumRise}
          className="flex h-28 w-28 items-center justify-center rounded-full"
          style={{ backgroundColor: team.color, color: fg, boxShadow: "var(--shadow-e2)" }}
        >
          <CheckIcon size={56} />
        </motion.div>

        <div className="flex flex-col gap-2">
          <span className="text-micro uppercase tracking-[0.3em] text-power-green">
            {COPY.confirmKicker}
          </span>
          <h2 className="font-display text-h1 font-extrabold leading-tight text-text">
            {COPY.confirmYour}{" "}
            <span style={{ color: team.color }}>{team.name}</span>{" "}
            {COPY.confirmIn}
          </h2>
        </div>

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: durations.base }}
          className="flex items-center gap-3 rounded-pill border border-ey-yellow/30 bg-ey-yellow/5 px-5 py-2.5"
        >
          <EyBeam surface="dark" size={26} label="" />
          <span className="font-display text-body font-bold text-ey-yellow">
            {COPY.watch}
          </span>
        </motion.div>
      </div>
    </ViewWrap>
  );
}

function AlreadyVotedView({ reduced }: { reduced: boolean }) {
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-power-green/50 bg-power-green/10 text-power-green">
          <CheckIcon size={48} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-h1 font-extrabold text-text">
            {COPY.alreadyTitle}
          </h2>
          <p className="max-w-xs text-balance text-small leading-relaxed text-text-dim">
            {COPY.alreadySub}
          </p>
        </div>
        <span className="font-display text-body font-bold text-ey-yellow">
          {COPY.watch}
        </span>
      </div>
    </ViewWrap>
  );
}

function ClosedView({ reduced }: { reduced: boolean }) {
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <SophiaBanner variant="confirmation" />
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-h1 font-extrabold text-text">
            {COPY.closedTitle}
          </h2>
          <p className="max-w-xs text-balance text-small leading-relaxed text-text-dim">
            {COPY.closedSub}
          </p>
        </div>
        <span className="font-display text-body font-bold text-ey-yellow">
          {COPY.watch}
        </span>
      </div>
    </ViewWrap>
  );
}

function RevealView({
  team,
  rank,
  total,
  reduced,
}: {
  team: Team | null;
  rank: number | null;
  total: number;
  reduced: boolean;
}) {
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-7 py-10 text-center">
        <span className="text-micro uppercase tracking-[0.3em] text-ey-yellow">
          {COPY.revealKicker}
        </span>

        {team && rank ? (
          <>
            <p className="font-display text-h3 font-semibold text-text-dim">
              {COPY.revealRank}
            </p>
            <motion.div
              initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={springs.slam}
              className="font-display font-black leading-none"
              style={{
                fontSize: "var(--text-display-2xl)",
                color: rank === 1 ? "var(--color-ey-yellow)" : team.color,
                textShadow:
                  rank === 1 ? "0 0 48px rgba(255,230,0,0.4)" : undefined,
              }}
            >
              #{rank}
            </motion.div>
            <div className="flex items-center gap-3">
              <TeamColorChip
                color={team.color}
                label={team.name.charAt(0).toUpperCase()}
                size={28}
              />
              <span className="font-display text-h2 font-bold text-text">
                {team.name}
              </span>
            </div>
            {rank === 1 && (
              <p className="font-display text-h3 font-extrabold text-ey-yellow">
                ¡Campeones! 🏆
              </p>
            )}
          </>
        ) : (
          <h2 className="max-w-xs text-balance font-display text-h1 font-extrabold text-text">
            {COPY.watch}
          </h2>
        )}

        <p className="text-micro uppercase tracking-[0.2em] text-text-dim">
          de {total} finalistas
        </p>
      </div>
    </ViewWrap>
  );
}

function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

export default VoteClient;
