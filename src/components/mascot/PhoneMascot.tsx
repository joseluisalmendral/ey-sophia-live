"use client";

/**
 * PhoneMascot — Broqui as the voter's pocket co-host (spec §3.1, §4.5 phone).
 *
 * A single "host row" under the phone header: mini Broqui on the left, the
 * phone speech bubble on the right. It persists across phases (mounted
 * outside the phase AnimatePresence) so the character never pops out and in.
 *
 * Driven ONLY by what the VoteShell already has: `phase`, the voted team
 * name, and the personal `rank`. Zero network, zero new polling. A tiny local
 * scheduler picks lines from the curated `phone_*` pool:
 *   - lobby: first line at 1.5 s, then U[10,18] s after each bubble ends;
 *   - voting: one `phone_voting` line on entry, then silent (the vote is the hero);
 *   - submitting: silent;
 *   - confirm: `phone_confirm`, then `phone_wait` every U[20,30] s;
 *   - alreadyVoted: `phone_already`, then `phone_wait` (anon-safe only: no team known);
 *   - closedNoVote: one `phone_closed` line;
 *   - reveal: nervous and silent while the projector reveals first
 *     (`revealHeld`), then expression by rank + one `phone_reveal_{1|2|3|n}`
 *     line once the rank arrives (never before the projector podium).
 * Poke: tapping Broqui plays surprise/laugh (haptic 8 ms); a `phone_poke`
 * line on the first tap and every 3rd, max one poke line per 4 s.
 *
 * Perf (low-end phones): no timers while the tab is hidden; the CSS life
 * layer pauses and no line is scheduled while the row is off-screen
 * (IntersectionObserver). Reduced motion: Broqui holds static poses, the
 * bubble fades with the whole text.
 */

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Broqui, type BroquiAction, type Expression } from "./Broqui";
import { PhoneSpeechBubble, dwellMs, typingMs, BUBBLE_EXIT_MS } from "./SpeechBubble";
import type { LineCategory } from "@/lib/assistant/lines.es";
import { LineMemory, pickLine, type LineContext } from "@/lib/assistant/resolveLine";
import { PHONE_LINES } from "@/lib/assistant/lines.phone.es";
import { mulberry32, uniform, type Rng } from "@/lib/assistant/rng";
import type { Phase } from "@/app/vote/[poll]/phase";
import "./phone-mascot.css";

/**
 * Reveal choreography, relative to the rank arriving (RevealView shows the
 * rank block at that moment and slams the #N in ~260 ms later).
 */
const REVEAL_POSE_MS = 300 + 300;
const REVEAL_LINE_MS = 300 + 1100;
const REVEAL_CONSOLE_MS = 1200;
/** Confirm moment → calm wait (ConfirmView's CONFIRM_MOMENT_MS). */
const CONFIRM_SETTLE_MS = 2500;
const POKE_LINE_GAP_MS = 4000;

interface PhasePlan {
  first: LineCategory | null;
  firstMs: number;
  ambient: LineCategory | null;
  range: [number, number];
}

const PLANS: Record<Phase, PhasePlan> = {
  lobby: { first: "phone_lobby", firstMs: 1500, ambient: "phone_lobby", range: [10, 18] },
  voting: { first: "phone_voting", firstMs: 900, ambient: null, range: [0, 0] },
  submitting: { first: null, firstMs: 0, ambient: null, range: [0, 0] },
  confirm: { first: "phone_confirm", firstMs: 800, ambient: "phone_wait", range: [20, 30] },
  alreadyVoted: { first: "phone_already", firstMs: 1000, ambient: "phone_wait", range: [20, 30] },
  closedNoVote: { first: "phone_closed", firstMs: 1000, ambient: null, range: [0, 0] },
  reveal: { first: null, firstMs: 0, ambient: null, range: [0, 0] },
};

interface Spoken {
  key: number;
  phase: Phase;
  text: string;
  expression: Expression;
}

interface Brain {
  rng: Rng;
  memory: LineMemory;
  phase: Phase;
  ctx: LineContext;
  reduced: boolean;
  onScreen: boolean;
  seq: number;
  pokes: number;
  lastPokeLineAt: number;
  votingSpoken: boolean;
  next: ReturnType<typeof setTimeout> | null;
  lineTimers: ReturnType<typeof setTimeout>[];
}

function revealCategory(rank: number): LineCategory {
  if (rank === 1) return "phone_reveal_1";
  if (rank === 2) return "phone_reveal_2";
  if (rank === 3) return "phone_reveal_3";
  return "phone_reveal_n";
}

/** Phase-driven resting pose (step = sub-beat inside the phase). */
function restingPose(
  phase: Phase,
  step: number,
  rank: number | null,
  revealHeld: boolean,
): Expression {
  switch (phase) {
    case "submitting":
      return "nervous";
    case "confirm":
      return step === 0 ? "celebrating" : "idle";
    case "alreadyVoted":
      return step === 0 ? "smug" : "idle";
    case "closedNoVote":
      return step === 0 ? "sad" : "idle";
    case "reveal":
      if (rank === null) return revealHeld ? "nervous" : "idle";
      if (step === 0) return "nervous";
      if (rank === 1) return "celebrating";
      if (rank === 2) return "smug";
      if (rank === 3) return "laughing";
      return step === 1 ? "sad" : "smug";
    default:
      return "idle";
  }
}

/** Looking up at the big screen during the calm waits. */
function looksUp(phase: Phase, step: number, rank: number | null): boolean {
  if (phase === "confirm" || phase === "alreadyVoted" || phase === "closedNoVote") return step >= 1;
  return phase === "reveal" && rank === null;
}

export interface PhoneMascotProps {
  phase: Phase;
  /** Team of a fresh vote in this session (fills {team}); null = unknown. */
  teamName: string | null;
  /**
   * Personal rank at reveal; null = neutral. The shell passes it only after
   * the projector-first hold, so no winner line can precede the podium.
   */
  rank: number | null;
  /** Reveal phase while the projector is still revealing: nervous, silent. */
  revealHeld?: boolean;
  reduced: boolean;
}

export function PhoneMascot({
  phase,
  teamName,
  rank,
  revealHeld = false,
  reduced,
}: PhoneMascotProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const brainRef = useRef<Brain | null>(null);
  const [line, setLine] = useState<Spoken | null>(null);
  const [talking, setTalking] = useState(false);
  const [action, setAction] = useState<BroquiAction | null>(null);
  const [paused, setPaused] = useState(false);
  const [beat, setBeat] = useState<{ phase: Phase; step: number }>({ phase, step: 0 });

  const step = beat.phase === phase ? beat.step : 0;
  const visibleLine = line && line.phase === phase ? line : null;
  const compact = phase === "voting" || phase === "submitting";

  const brain = useCallback((): Brain => {
    if (!brainRef.current) {
      brainRef.current = {
        rng: mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0),
        memory: new LineMemory(),
        phase,
        ctx: { anonymized: false },
        reduced,
        onScreen: true,
        seq: 0,
        pokes: 0,
        lastPokeLineAt: -Infinity,
        votingSpoken: false,
        next: null,
        lineTimers: [],
      };
    }
    return brainRef.current;
    // `phase`/`reduced` only seed the first creation; later values are
    // written by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearLineTimers = useCallback(() => {
    const b = brain();
    b.lineTimers.forEach(clearTimeout);
    b.lineTimers = [];
  }, [brain]);

  const clearNext = useCallback(() => {
    const b = brain();
    if (b.next !== null) clearTimeout(b.next);
    b.next = null;
  }, [brain]);

  // Forward-declared through a ref so speak/schedule can call each other.
  const scheduleAmbientRef = useRef<() => void>(() => {});

  /** Speak one line of `category` now (drops silently when nothing resolves). */
  const speak = useCallback(
    (category: LineCategory, force = false): boolean => {
      const b = brain();
      if (typeof document !== "undefined" && document.hidden) return false;
      if (!b.onScreen && !force) {
        scheduleAmbientRef.current();
        return false;
      }
      const picked = pickLine(category, b.ctx, b.rng, {
        pool: PHONE_LINES,
        memory: b.memory,
        preferNames: true,
      });
      if (!picked) {
        scheduleAmbientRef.current();
        return false;
      }
      clearLineTimers();
      clearNext();
      const key = ++b.seq;
      const expression: Expression =
        picked.expression === "talking" || picked.expression === "peek"
          ? "idle"
          : picked.expression;
      setLine({ key, phase: b.phase, text: picked.text, expression });
      setTalking(!b.reduced);
      const typing = typingMs(picked.text, b.reduced);
      const dwell = dwellMs(picked.text);
      b.lineTimers.push(
        setTimeout(() => setTalking(false), Math.max(typing, 250)),
        setTimeout(() => {
          setLine((cur) => (cur && cur.key === key ? null : cur));
          b.lineTimers.push(
            setTimeout(() => scheduleAmbientRef.current(), BUBBLE_EXIT_MS + 50),
          );
        }, typing + dwell),
      );
      return true;
    },
    [brain, clearLineTimers, clearNext],
  );

  const scheduleAmbient = useCallback(() => {
    const b = brain();
    clearNext();
    const plan = PLANS[b.phase];
    if (!plan.ambient) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const [lo, hi] = plan.range;
    const category = plan.ambient;
    b.next = setTimeout(() => {
      b.next = null;
      speak(category);
    }, uniform(b.rng, lo, hi) * 1000);
  }, [brain, clearNext, speak]);

  useEffect(() => {
    scheduleAmbientRef.current = scheduleAmbient;
  }, [scheduleAmbient]);

  // Keep the brain's context current (names are always visible on phones).
  useEffect(() => {
    const b = brain();
    b.ctx = { anonymized: false, team: teamName, rank };
    b.reduced = reduced;
  }, [brain, teamName, rank, reduced]);

  // Phase entry: first line, sub-beats, reveal choreography.
  useEffect(() => {
    const b = brain();
    b.phase = phase;
    clearNext();
    clearLineTimers();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    if (phase === "lobby") b.votingSpoken = false;

    if (phase === "confirm") at(CONFIRM_SETTLE_MS, () => setBeat({ phase, step: 1 }));
    if (phase === "alreadyVoted" || phase === "closedNoVote") {
      at(2600, () => setBeat({ phase, step: 1 }));
    }

    if (phase === "reveal") {
      if (rank !== null) {
        at(REVEAL_POSE_MS, () => {
          setBeat({ phase, step: 1 });
          if (rank === 1) setAction({ type: "celebrate", key: Date.now() });
        });
        at(REVEAL_LINE_MS, () => speak(revealCategory(rank), true));
        if (rank >= 4) {
          at(REVEAL_POSE_MS + REVEAL_CONSOLE_MS, () => setBeat({ phase, step: 2 }));
        }
      }
    } else {
      const plan = PLANS[phase];
      const skipVoting = phase === "voting" && b.votingSpoken;
      if (plan.first && !skipVoting) {
        const category = plan.first;
        at(plan.firstMs, () => {
          if (phase === "voting") b.votingSpoken = true;
          speak(category, true);
        });
      } else {
        scheduleAmbient();
      }
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [phase, rank, brain, clearNext, clearLineTimers, speak, scheduleAmbient]);

  // Hidden tab: stop everything; back: resume the ambient cadence.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        clearNext();
        clearLineTimers();
        setLine(null);
        setTalking(false);
      } else {
        scheduleAmbient();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [clearNext, clearLineTimers, scheduleAmbient]);

  // Off-screen: pause the CSS life layer and skip lines nobody can see.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const b = brain();
        b.onScreen = entry.isIntersecting;
        setPaused(!entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [brain]);

  // Unmount: drop every timer.
  useEffect(
    () => () => {
      clearNext();
      clearLineTimers();
    },
    [clearNext, clearLineTimers],
  );

  const onPoke = () => {
    const b = brain();
    b.pokes += 1;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
    setAction({ type: b.pokes % 2 === 1 ? "surprise" : "laugh", key: Date.now() });
    const now = Date.now();
    const wantsLine = b.pokes === 1 || b.pokes % 3 === 0;
    if (wantsLine && now - b.lastPokeLineAt >= POKE_LINE_GAP_MS) {
      if (speak("phone_poke", true)) b.lastPokeLineAt = now;
    }
  };

  const pose = visibleLine
    ? visibleLine.expression
    : restingPose(phase, step, rank, revealHeld);
  const lookAt =
    !visibleLine && looksUp(phase, step, rank) ? { x: 0.05, y: -0.95 } : null;
  const size = 96;

  return (
    <motion.div
      ref={rootRef}
      className="phone-mascot"
      data-paused={paused ? "true" : "false"}
      data-compact={compact ? "true" : "false"}
      initial={false}
      animate={{ height: compact ? 60 : 96 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
    >
      <motion.button
        type="button"
        className="phone-mascot__poke"
        onClick={onPoke}
        aria-label="Broqui, tu copresentador. Tócalo."
        initial={false}
        animate={{ scale: compact ? 0.6 : 1, marginRight: compact ? -36 : 0 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 26 }}
        style={{ width: Math.round((size * 320) / 340), height: size }}
      >
        <Broqui
          size={size}
          expression={pose}
          talking={talking && !!visibleLine}
          lookAt={lookAt}
          action={action}
          reduced={reduced}
        />
      </motion.button>
      <div className="phone-mascot__bubble">
        <AnimatePresence mode="wait">
          {visibleLine && (
            <PhoneSpeechBubble key={visibleLine.key} text={visibleLine.text} reduced={reduced} />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default PhoneMascot;
