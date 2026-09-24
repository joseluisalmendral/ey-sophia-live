"use client";

/**
 * MascotHost — Broqui on the projector: brain + body + bubble.
 *
 *   brain   detectEvents (edge-triggered events over the derived tally) →
 *           Scheduler (ambient U[min,max] + event arbitration) → pickLine
 *           (anonymous guard, ≤ 90 chars, no-repeat memory).
 *   body    owns Broqui (expression / talking / lookAt / one-shot actions) and
 *           its position: it stands on layout-reserved anchors
 *           (`[data-mascot-anchor]`) validated against keep-outs
 *           (`[data-mascot-keepout]`), roams between them every 1–3 bubbles or
 *           ~25–40 s idle, travelling in arcs that avoid keep-outs (or exiting
 *           and peeking back in from an edge), never while a bubble is open.
 *   bubble  one SpeechBubble at a time, self-placed so mascot + bubble never
 *           intersect a keep-out; drives `talking` while it types.
 *
 * It only READS the projector's derived data (ScreenStageContext or explicit
 * props): no data hooks, no network, no subscriptions. Hidden during the
 * curtain + camera cuts; key "M" toggles it locally (operator panic button).
 *
 * Coordinates: everything is measured in FRAME space (the 16:9 board this
 * host is mounted in) so it behaves the same on the projector, in the /lab
 * iframe and on a letterboxed laptop.
 */

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { PollStatus, RankedTeam } from "@/lib/types";
import { easings } from "@/lib/motion/tokens";
import {
  createDetectorState,
  detectEvents,
  type AssistantEvent,
  type AssistantEventType,
  type DetectorState,
} from "@/lib/assistant/detectEvents";
import type { LineCategory } from "@/lib/assistant/lines.es";
import {
  contextFromTeams,
  LineMemory,
  pickLine,
  type ResolvedLine,
} from "@/lib/assistant/resolveLine";
import { mulberry32, uniform, type Rng } from "@/lib/assistant/rng";
import { Scheduler, type SchedulerDecision } from "@/lib/assistant/scheduler";
import { REVEAL_BEATS, REVEAL_BEATS_REDUCED } from "@/components/screen/reveal/constants";
import { useScreenStageFrame, type RevealBeat } from "@/components/screen/ScreenStageContext";
import { Broqui, type BroquiAction, type BroquiActionType, type BroquiEdge, type Expression } from "./Broqui";
import {
  bodyClear,
  bodyOf,
  center,
  eyesOf,
  intersects,
  lookVector,
  nearestEdge,
  planTravel,
  poseForAnchor,
  rect,
  travelDuration,
  type AnchorSpec,
  type BubbleSide,
  type Edge,
  type Point,
  type Pose,
  type Rect,
} from "./placement";
import { BUBBLE_EXIT_MS, dwellMs, SpeechBubble, typingMs } from "./SpeechBubble";

/* ============================================================================
 * Public types
 * ========================================================================= */

export type MascotStage =
  | "lobby"
  | "countin"
  | "live"
  | "reveal-suspense"
  | "reveal-hidden"
  | "podium";

export interface MascotConfig {
  enabled?: boolean;
  min?: number;
  max?: number;
}

/** Control-room → host (lab only). */
export type MascotCommand =
  | { type: "expression"; expression: Expression | null }
  | { type: "action"; action: BroquiActionType }
  | { type: "event"; event: AssistantEventType }
  | { type: "random" }
  | { type: "move" }
  | { type: "toggle" };

export interface MascotLogEntry {
  at: number;
  kind: "ambient" | "event" | "forced";
  category: LineCategory;
  id: string;
  text: string;
  event?: AssistantEventType;
  anonymized: boolean;
}

export interface MascotStateReport {
  stage: MascotStage;
  mode: string;
  visible: boolean;
  anchor: string | null;
  expression: Expression;
  bubble: boolean;
  bubbleClear: boolean | null;
  overlap: boolean;
  keepouts: number;
  anchors: number;
  enabled: boolean;
}

/** Host → control-room (lab only). */
export type MascotReport =
  | { type: "line"; entry: MascotLogEntry }
  | { type: "state"; state: MascotStateReport };

export interface MascotLabBridge {
  subscribe?: (cb: (cmd: MascotCommand) => void) => () => void;
  report?: (msg: MascotReport) => void;
  /** /lab QA only (?mascotCrash=1): throw on render to prove MascotBoundary. */
  crash?: boolean;
}

export interface MascotHostProps {
  /** Per-poll assistant config; missing fields → defaults {enabled, 14, 28}. */
  config?: MascotConfig | null;
  reduced: boolean;
  /** Seeded RNG for rehearsals; the projector seeds from the clock. */
  rngSeed?: number;
  lab?: MascotLabBridge;
  /* Explicit overrides — default to the ScreenStage context. */
  stage?: MascotStage;
  status?: PollStatus;
  teams?: RankedTeam[];
  anonymized?: boolean;
  closesAt?: string | null;
  opensAt?: string | null;
  joined?: number | null;
}

/* ============================================================================
 * Stage tables
 * ========================================================================= */

export function deriveStage(status: PollStatus, beat: RevealBeat | null): MascotStage {
  if (status === "draft") return "lobby";
  if (status === "countdown") return "countin";
  if (status === "open") return "live";
  if (beat === "curtain" || beat === "cameras") return "reveal-hidden";
  if (beat === "podium") return "podium";
  return "reveal-suspense";
}

const STAGE_ANCHORS: Record<MascotStage, readonly string[]> = {
  lobby: ["lobby-lane", "lobby-top", "lobby-mid"],
  countin: ["lobby-lane", "lobby-top", "lobby-mid"],
  live: ["live-band-right", "live-band-left", "live-corner"],
  "reveal-suspense": ["peek"],
  "reveal-hidden": [],
  podium: ["podium-right", "podium-left"],
};

const AMBIENT_CATEGORY: Record<MascotStage, LineCategory | null> = {
  lobby: "lobby_ambient",
  countin: "lobby_ambient",
  live: "open_ambient",
  "reveal-suspense": null,
  "reveal-hidden": null,
  podium: null,
};

/** Events that make sense on each stage (others are dropped on arrival). */
const STAGE_EVENTS: Record<MascotStage, readonly AssistantEventType[]> = {
  lobby: ["lobby_joins", "count_in"],
  countin: ["lobby_joins", "count_in"],
  live: ["first_vote", "lead_change", "tie_top", "milestone", "surge", "landslide", "quiet", "last10"],
  "reveal-suspense": ["close"],
  "reveal-hidden": [],
  podium: ["reveal_winner"],
};

const BASE_SIZE_1080 = 200;
const STEP_MS = 120;
const ROAM_IDLE_MS: [number, number] = [25_000, 40_000];
const PODIUM_SETTLE_MS = 1200;
/** Length of Broqui's "dance" beat (jump + spin + 4 hops + settle). */
const PODIUM_DANCE_MS = 2400;
const EMPTY_TEAMS: RankedTeam[] = [];

type Mode = "hidden" | "entering" | "idle" | "travelling" | "exiting" | "peeking" | "speaking";

interface BubbleState {
  id: string;
  text: string;
  pose: Pose;
  prefer: readonly BubbleSide[];
  maxWidthPx: number;
  keepouts: Rect[];
  frame: Rect;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pool expressions → Broqui poses ("talking"/"peek" are overlays, not poses). */
function lineExpression(e: ResolvedLine["expression"]): Expression {
  if (e === "talking" || e === "peek") return "idle";
  return e;
}

/**
 * Real rendered bounds of a keep-out: its box UNION the bounds of every text
 * node inside it (Range rects), so text that overflows its container — e.g.
 * a long winner name wider than its plinth column — is protected too.
 */
function keepoutBounds(el: Element): DOMRect | null {
  const box = el.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return null;
  let x0 = box.left;
  let y0 = box.top;
  let x1 = box.right;
  let y1 = box.bottom;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent || !n.textContent.trim()) continue;
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    x0 = Math.min(x0, r.left);
    y0 = Math.min(y0, r.top);
    x1 = Math.max(x1, r.right);
    y1 = Math.max(y1, r.bottom);
  }
  return new DOMRect(x0, y0, x1 - x0, y1 - y0);
}

function parseAnchor(el: Element, origin: Point): AnchorSpec | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  const id = el.getAttribute("data-mascot-anchor") ?? "";
  const size = Number(el.getAttribute("data-mascot-size")) || BASE_SIZE_1080;
  const bubble = (el.getAttribute("data-mascot-bubble") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as BubbleSide[];
  const bubbleMax = Number(el.getAttribute("data-mascot-bubble-max")) || 0.34;
  const edge = (el.getAttribute("data-mascot-edge") as Edge | null) ?? "right";
  const align = el.getAttribute("data-mascot-align") === "center" ? "center" : "bottom";
  return {
    id,
    rect: rect(r.left - origin.x, r.top - origin.y, r.width, r.height),
    size,
    bubble,
    bubbleMax,
    edge,
    align,
  };
}

/* ============================================================================
 * Component
 * ========================================================================= */

export function MascotHost(props: MascotHostProps) {
  const ctx = useScreenStageFrame();
  const status = props.status ?? ctx?.status ?? "draft";
  const teams = props.teams ?? ctx?.teams ?? EMPTY_TEAMS;
  const anonymized = props.anonymized ?? ctx?.anonymized ?? false;
  const closesAt = props.closesAt !== undefined ? props.closesAt : (ctx?.closesAt ?? null);
  const opensAt = props.opensAt !== undefined ? props.opensAt : (ctx?.opensAt ?? null);
  const joined = props.joined !== undefined ? props.joined : (ctx?.joined ?? null);
  const chartType = ctx?.chartType ?? "bar_race";
  const revealBeat = ctx?.revealBeat ?? null;
  const stage = props.stage ?? deriveStage(status, revealBeat);
  const enabled = props.config?.enabled !== false;
  const [localOn, setLocalOn] = useState(true);
  const on = enabled && localOn;

  /* ---- presentational state ---- */
  const [size, setSize] = useState(BASE_SIZE_1080);
  const [expression, setExpression] = useState<Expression>("idle");
  const [talking, setTalking] = useState(false);
  const [lookAt, setLookAt] = useState<Point | null>(null);
  const [action, setAction] = useState<BroquiAction | null>(null);
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const [bubbleClear, setBubbleClear] = useState<boolean | null>(null);
  const [overlap, setOverlap] = useState(false);
  const [visible, setVisible] = useState(false);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [modeAttr, setModeAttr] = useState<Mode>("hidden");
  const [k, setK] = useState(1);

  /* ---- motion values (frame coordinates) ---- */
  const cx = useMotionValue(0);
  const by = useMotionValue(0);
  const sc = useMotionValue(1);
  const ax = useMotionValue(0); // anticipation / landing offsets
  const ay = useMotionValue(0);
  const rot = useMotionValue(0);
  const sx = useMotionValue(1);
  const sy = useMotionValue(1);
  const wrapOpacity = useMotionValue(0);
  const wMv = useMotionValue(BASE_SIZE_1080 * (320 / 340));
  const hMv = useMotionValue(BASE_SIZE_1080);
  const px = useTransform(() => cx.get() + ax.get() - wMv.get() / 2);
  const py = useTransform(() => by.get() + ay.get() - hMv.get());

  const rootRef = useRef<HTMLDivElement>(null);
  const exprRef = useRef<Expression>(expression);

  // Latest props for the imperative loop (refreshed in an effect, never in render).
  const snapshot = { status, teams, anonymized, closesAt, opensAt, joined, chartType, revealBeat, stage, on, reduced: props.reduced, config: props.config, lab: props.lab };
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
    exprRef.current = expression;
  });

  const seed = props.rngSeed;

  /* ---- the controller: one effect, one loop ---- */
  useEffect(() => {
    const root = rootRef.current;
    const frameEl = root?.parentElement;
    if (!root || !frameEl) return;

    const rng: Rng = mulberry32(seed ?? (Date.now() & 0xffffffff));
    const scheduler = new Scheduler(latest.current.config ? { min: latest.current.config.min ?? 14, max: latest.current.config.max ?? 28 } : null, rng, Date.now());
    const memory = new LineMemory();
    let detector: DetectorState = createDetectorState();

    const S = {
      mode: "hidden" as Mode,
      stage: latest.current.stage,
      on: latest.current.on,
      anchor: null as AnchorSpec | null,
      pose: { cx: 0, by: 0, scale: 1 } as Pose,
      k: 1,
      baseSize: BASE_SIZE_1080,
      frame: rect(0, 0, 1920, 1080),
      origin: { x: 0, y: 0 } as Point,
      anchors: [] as AnchorSpec[],
      keepouts: [] as Rect[],
      gen: 0,
      speakGen: 0,
      actionKey: 0,
      bubblesSinceMove: 0,
      moveTarget: 2,
      roamAfterMs: 30_000,
      lastMoveAt: Date.now(),
      arrivedAt: 0,
      nextGlanceAt: Date.now() + 5000,
      glanceUntil: 0,
      lastReportAt: 0,
      stageEnteredAt: Date.now(),
      squeezeFired: false,
      podiumSettled: false,
      forcedExpression: null as Expression | null,
      speaking: false,
      bubbleTimer: 0 as ReturnType<typeof setTimeout> | 0,
      talkTimer: 0 as ReturnType<typeof setTimeout> | 0,
      disposed: false,
    };

    const now = () => Date.now();
    const live = (g: number) => !S.disposed && g === S.gen;
    const liveSpeech = (g: number, sg: number) => live(g) && sg === S.speakGen;
    const red = () => latest.current.reduced;
    const fire = (type: BroquiActionType, from: BroquiEdge = "right") => {
      S.actionKey += 1;
      setAction({ type, key: S.actionKey, from });
    };
    const toEdge = (e: Edge): BroquiEdge => (e === "top" ? "bottom" : e);
    const setPose = (p: Pose) => {
      S.pose = p;
      cx.set(p.cx);
      by.set(p.by);
      sc.set(p.scale);
    };
    const report = (msg: MascotReport) => latest.current.lab?.report?.(msg);

    /* ------------------------------------------------------------ measure */
    const measure = () => {
      const fr = frameEl.getBoundingClientRect();
      if (fr.width <= 0 || fr.height <= 0) return false;
      S.origin = { x: fr.left, y: fr.top };
      S.frame = rect(0, 0, fr.width, fr.height);
      const kk = fr.height / 1080;
      if (Math.abs(kk - S.k) > 0.002) {
        S.k = kk;
        S.baseSize = Math.round(BASE_SIZE_1080 * kk);
        wMv.set(S.baseSize * (320 / 340));
        hMv.set(S.baseSize);
        setK(kk);
        setSize(S.baseSize);
      }
      const anchors: AnchorSpec[] = [];
      frameEl.querySelectorAll("[data-mascot-anchor]").forEach((el) => {
        const a = parseAnchor(el, S.origin);
        if (a) anchors.push(a);
      });
      S.anchors = anchors;
      const keepouts: Rect[] = [];
      frameEl.querySelectorAll("[data-mascot-keepout]").forEach((el) => {
        if (root.contains(el)) return;
        const r = keepoutBounds(el);
        if (!r) return;
        keepouts.push(rect(r.left - S.origin.x, r.top - S.origin.y, r.width, r.height));
      });
      S.keepouts = keepouts;
      return true;
    };

    /** An anchor is usable at full size or, in a tight margin, a bit smaller. */
    const fitAnchor = (a: AnchorSpec): AnchorSpec | null => {
      for (const f of [1, 0.85, 0.72]) {
        const spec = f === 1 ? a : { ...a, size: a.size * f };
        if (bodyClear(poseForAnchor(spec, S.baseSize, S.k), S.baseSize, S.keepouts, S.frame)) return spec;
      }
      return null;
    };
    const anchorsFor = (stage: MascotStage): AnchorSpec[] => {
      const ids = STAGE_ANCHORS[stage];
      const found = ids
        .map((id) => S.anchors.find((a) => a.id === id))
        .filter((a): a is AnchorSpec => !!a);
      if (stage === "reveal-suspense") return found; // the peek anchor sits on the edge
      return found.map(fitAnchor).filter((a): a is AnchorSpec => !!a);
    };

    const keepoutAt = (name: string): Rect | null => {
      const el = frameEl.querySelector(`[data-mascot-keepout="${name}"]`);
      const r = el ? keepoutBounds(el) : null;
      return r ? rect(r.left - S.origin.x, r.top - S.origin.y, r.width, r.height) : null;
    };
    const rowRect = (rank: number): Rect | null => {
      const el = frameEl.querySelector(`[data-rank="${rank}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? rect(r.left - S.origin.x, r.top - S.origin.y, r.width, r.height) : null;
    };

    const look = (target: Point | null) => {
      if (!target) {
        setLookAt(null);
        return;
      }
      setLookAt(lookVector(eyesOf(S.pose, S.baseSize), target, S.frame));
    };
    const audience = (): Point => ({ x: S.frame.w / 2, y: S.frame.h * 1.15 });

    /* ------------------------------------------------------------ bubble */
    const clearBubbleTimers = () => {
      if (S.bubbleTimer) clearTimeout(S.bubbleTimer);
      if (S.talkTimer) clearTimeout(S.talkTimer);
      S.bubbleTimer = 0;
      S.talkTimer = 0;
    };

    const closeBubble = (cut: boolean) => {
      clearBubbleTimers();
      setBubble(null);
      setTalking(false);
      setBubbleClear(null);
      S.speaking = false;
      if (S.mode === "speaking") S.mode = "idle";
      const t = now() + BUBBLE_EXIT_MS;
      if (cut) scheduler.onBubbleCut(t);
      else scheduler.onBubbleEnd(t);
      S.bubblesSinceMove += 1;
      // Back to the stage's base mood shortly after.
      const g = S.gen;
      setTimeout(() => {
        if (live(g) && !S.speaking) setExpression(S.forcedExpression ?? baseExpression());
      }, 450);
    };

    const openBubble = (line: ResolvedLine, decision: SchedulerDecision, kind: MascotLogEntry["kind"]) => {
      measure();
      const anchor = S.anchor;
      const prefer = anchor?.bubble ?? [];
      const maxWidthPx = Math.round(S.frame.w * (anchor?.bubbleMax ?? 0.34));
      setExpression(S.forcedExpression ?? lineExpression(line.expression));
      const id = `${line.id}-${now()}`;
      setBubble({ id, text: line.text, pose: { ...S.pose }, prefer, maxWidthPx, keepouts: [...S.keepouts], frame: { ...S.frame } });
      setBubbleClear(null);
      S.speaking = true;
      if (S.mode === "idle") S.mode = "speaking";
      const t0 = now();
      scheduler.onBubbleStart(t0, decision);
      memory.remember(line.category, line.id);
      const typing = typingMs(line.text, red());
      let dwell = dwellMs(line.text);
      if (S.stage === "reveal-suspense") {
        // The peek line must finish before the curtain slams (dim + suspense).
        const beats = red() ? REVEAL_BEATS_REDUCED : REVEAL_BEATS;
        const deadline = S.stageEnteredAt + (beats.dim + beats.suspense) * 1000 - 380;
        dwell = Math.max(1100, Math.min(dwell, deadline - t0 - typing));
      }
      setTalking(true);
      S.talkTimer = setTimeout(() => setTalking(false), typing + 120);
      S.bubbleTimer = setTimeout(() => closeBubble(false), typing + dwell);
      look(audience());
      report({
        type: "line",
        entry: {
          at: t0,
          kind,
          category: line.category,
          id: line.id,
          text: line.text,
          event: decision.kind === "event" ? decision.event.type : undefined,
          anonymized: latest.current.anonymized,
        },
      });
    };

    const lineContext = () => {
      const L = latest.current;
      const secondsLeft = L.closesAt ? Math.max(0, Math.round((new Date(L.closesAt).getTime() - now()) / 1000)) : null;
      const ranked = [...L.teams].sort((a, b) => a.rank - b.rank || b.count - a.count);
      // A tie at the top (shared rank 1) has no single winner: withhold
      // {winner} so tie-neutral reveal lines are picked instead.
      const tiedTop = ranked.length > 1 && ranked[0].rank === ranked[1].rank && ranked[0].count === ranked[1].count;
      const winner = L.status === "closed" && ranked[0] && ranked[0].count > 0 && !tiedTop ? ranked[0].name : null;
      return contextFromTeams(L.teams, {
        anonymized: L.anonymized,
        winner,
        joined: L.joined,
        seconds: secondsLeft,
      });
    };

    const categoryFor = (decision: SchedulerDecision): LineCategory | null => {
      if (decision.kind === "ambient") return AMBIENT_CATEGORY[S.stage];
      if (decision.kind === "cut") return null;
      const t = decision.event.type;
      return t as LineCategory;
    };

    /* ------------------------------------------------------- acting beats */
    const baseExpression = (): Expression => {
      const L = latest.current;
      const total = L.teams.reduce((s, t) => s + t.count, 0);
      const sorted = [...L.teams].sort((a, b) => b.count - a.count);
      const gap = sorted.length > 1 ? sorted[0].count - sorted[1].count : 99;
      const share = total > 0 && sorted[0] ? sorted[0].count / total : 0;
      switch (S.stage) {
        case "countin":
          return "nervous";
        case "live": {
          const left = L.closesAt ? new Date(L.closesAt).getTime() - now() : Infinity;
          if (left <= 10_000) return "nervous";
          if (total >= 10 && gap <= 2) return "nervous";
          if (total >= 20 && share >= 0.6) return "smug";
          return "idle";
        }
        case "podium":
          // Celebrating until the dance lands, then the smug co-host idle.
          return S.podiumSettled ? "smug" : "celebrating";
        case "reveal-suspense":
          return "nervous";
        default:
          return "idle";
      }
    };

    const preBeat = async (g: number, event: AssistantEvent | null, line: ResolvedLine) => {
      if (!event) {
        // Ambient: a small tell before the line (thinking → glance at the audience).
        if (line.expression === "thinking") {
          setExpression("thinking");
          await wait(red() ? 150 : 500);
        } else if (line.expression === "smug") {
          setExpression("smug");
          await wait(red() ? 150 : 350);
        }
        return;
      }
      switch (event.type) {
        case "lead_change": {
          // Glance at the chart, eyes pop, then deliver.
          const r = rowRect(1) ?? keepoutAt("chart");
          if (r) look(center(r));
          await wait(red() ? 120 : 380);
          if (!live(g)) return;
          fire("surprise");
          await wait(red() ? 120 : 420);
          break;
        }
        case "tie_top": {
          setExpression("nervous");
          const a = rowRect(1) ?? keepoutAt("chart");
          const b = rowRect(2) ?? a;
          for (let i = 0; i < 4 && live(g); i++) {
            const r = i % 2 === 0 ? a : b;
            if (r) look(center(r));
            await wait(red() ? 100 : 330);
          }
          break;
        }
        case "surge": {
          const r = keepoutAt("chart");
          if (r) look(center(r));
          await wait(red() ? 100 : 220);
          if (!live(g)) return;
          fire("surprise");
          await wait(red() ? 120 : 380);
          break;
        }
        case "landslide": {
          setExpression("smug");
          const r = rowRect(1) ?? keepoutAt("chart");
          if (r) look(center(r));
          await wait(red() ? 150 : 700);
          break;
        }
        case "quiet": {
          setExpression("thinking");
          look(audience());
          await wait(red() ? 150 : 800);
          break;
        }
        case "last10": {
          setExpression("nervous");
          const r = keepoutAt("countdown");
          if (r) look(center(r));
          await wait(red() ? 120 : 420);
          break;
        }
        case "lobby_joins": {
          const r = keepoutAt("counter") ?? keepoutAt("qr");
          if (r) look(center(r));
          await wait(red() ? 100 : 320);
          break;
        }
        case "count_in": {
          setExpression("nervous");
          const r = keepoutAt("countdown");
          if (r) look(center(r));
          await wait(red() ? 100 : 380);
          break;
        }
        case "first_vote":
        case "milestone": {
          const r = keepoutAt("chart");
          if (r) look(center(r));
          await wait(red() ? 100 : 260);
          break;
        }
        case "reveal_winner": {
          setExpression("celebrating");
          await wait(red() ? 150 : 700);
          break;
        }
        default:
          break;
      }
    };

    const speak = async (decision: SchedulerDecision, kind: MascotLogEntry["kind"] = decision.kind === "ambient" ? "ambient" : "event") => {
      const category = categoryFor(decision);
      if (!category) return;
      const line = pickLine(category, lineContext(), rng, {
        memory,
        preferNames: S.stage === "podium" || S.stage === "reveal-suspense",
      });
      if (!line) {
        scheduler.skip(now(), decision);
        return;
      }
      const g = S.gen;
      const sg = S.speakGen;
      S.speaking = true;
      if (S.mode === "idle") S.mode = "speaking";
      await preBeat(g, decision.kind === "event" ? decision.event : null, line);
      if (!liveSpeech(g, sg) || !S.speaking) return;
      openBubble(line, decision, kind);
    };

    /* ------------------------------------------------------------ travel */
    const travelTo = async (anchor: AnchorSpec, g: number) => {
      const from = { ...S.pose };
      const to = poseForAnchor(anchor, S.baseSize, S.k);
      const path = planTravel(from, to, S.baseSize, S.keepouts, S.frame);
      const dir = Math.sign(to.cx - from.cx) || 1;
      S.mode = "travelling";
      S.anchor = anchor;
      setAnchorId(anchor.id);
      if (red()) {
        // Crossfade at the destination, no arc.
        await animate(wrapOpacity, 0, { duration: 0.24 });
        if (!live(g)) return;
        setPose(to);
        await animate(wrapOpacity, 1, { duration: 0.24 });
        S.mode = "idle";
        S.arrivedAt = now();
        return;
      }
      // Anticipation: lean away from the travel.
      look({ x: to.cx, y: to.by - S.baseSize * 0.6 });
      const ant = { duration: 0.13, ease: [0.3, 0, 0.6, 1] as [number, number, number, number] };
      animate(rot, -5 * dir, ant);
      animate(sx, 1.06, ant);
      animate(sy, 0.95, ant);
      await animate(ax, -10 * S.k * dir, ant);
      if (!live(g)) return;
      // Flight.
      const duration = travelDuration(path.length, S.k) / 1000;
      animate(ax, 0, { duration: 0.2 });
      animate(rot, 6 * dir, { duration: 0.25 });
      animate(sx, 0.98, { duration: 0.25 });
      animate(sy, 1.05, { duration: 0.25 });
      const progress = { t: 0 };
      await animate(progress, { t: 1 }, {
        duration,
        ease: easings.travel as unknown as [number, number, number, number],
        onUpdate: () => {
          const p = path.at(progress.t);
          cx.set(p.x);
          by.set(p.y);
          sc.set(from.scale + (to.scale - from.scale) * progress.t);
        },
      });
      if (!live(g)) return;
      setPose(to);
      // Follow-through: overshoot on landing.
      ay.set(-8 * S.k);
      animate(ay, 0, { type: "spring", stiffness: 300, damping: 16, mass: 1 });
      animate(rot, 0, { type: "spring", stiffness: 200, damping: 14 });
      animate(sx, 1, { type: "spring", stiffness: 260, damping: 14 });
      animate(sy, 1, { type: "spring", stiffness: 260, damping: 14 });
      look(null);
      S.mode = "idle";
      S.arrivedAt = now();
    };

    const exitAndPeekIn = async (anchor: AnchorSpec, g: number) => {
      S.mode = "travelling";
      const fromEdge = toEdge(nearestEdge({ x: S.pose.cx, y: S.pose.by - S.baseSize * 0.4 }, S.frame));
      fire("exit", fromEdge);
      await wait(red() ? 280 : 520);
      if (!live(g)) return;
      S.anchor = anchor;
      setAnchorId(anchor.id);
      setPose(poseForAnchor(anchor, S.baseSize, S.k));
      await wait(uniform(rng, 450, 900));
      if (!live(g)) return;
      fire("enter", toEdge(anchor.edge));
      await wait(red() ? 300 : 720);
      if (!live(g)) return;
      S.mode = "idle";
      S.arrivedAt = now();
    };

    const enterAt = async (anchor: AnchorSpec, g: number) => {
      S.mode = "entering";
      S.anchor = anchor;
      setAnchorId(anchor.id);
      setPose(poseForAnchor(anchor, S.baseSize, S.k));
      wrapOpacity.set(1);
      setVisible(true);
      fire("enter", toEdge(anchor.edge));
      await wait(red() ? 300 : 780);
      if (!live(g)) return;
      S.mode = "idle";
      S.arrivedAt = now();
      S.lastMoveAt = now();
      S.bubblesSinceMove = 0;
    };

    const exitNow = async (g: number, fast = false) => {
      if (S.mode === "hidden") return;
      S.mode = "exiting";
      const edge = S.anchor ? toEdge(S.anchor.edge) : "right";
      fire("exit", edge);
      // Curtain / camera cuts own the stage: vanish in 150 ms on top of the exit.
      if (fast) animate(wrapOpacity, 0, { duration: 0.15 });
      await wait(fast ? 170 : red() ? 280 : 480);
      if (!live(g)) return;
      S.mode = "hidden";
      setVisible(false);
      setAnchorId(null);
      S.anchor = null;
    };

    /** Reveal suspense: only the top ~45 % shows over the bottom edge. */
    const peekIn = async (anchor: AnchorSpec, g: number) => {
      S.mode = "entering";
      S.anchor = anchor;
      setAnchorId(anchor.id);
      const scale = (anchor.size * S.k) / S.baseSize;
      const h = S.baseSize * scale;
      const peekCx = anchor.rect.x + anchor.rect.w / 2;
      // Final pose: only the top ~45 % of the shield above the bottom edge.
      // Broqui's own "enter from bottom" slides it up into this pose.
      setPose({ cx: peekCx, by: S.frame.h + h * 0.55, scale });
      wrapOpacity.set(1);
      setVisible(true);
      setExpression("nervous");
      look({ x: S.frame.w / 2, y: S.frame.h * 0.4 });
      fire("enter", "bottom");
      if (!red()) animate(rot, -6, { type: "spring", stiffness: 160, damping: 18 });
      await wait(red() ? 260 : 620);
      if (!live(g)) return;
      S.mode = "peeking";
      S.arrivedAt = now();
    };

    const peekOut = async (g: number, fast = false) => {
      S.mode = "exiting";
      animate(rot, 0, { duration: 0.2 });
      fire("exit", "bottom");
      if (fast) animate(wrapOpacity, 0, { duration: 0.15 });
      await wait(fast ? 170 : red() ? 260 : 460);
      if (!live(g)) return;
      S.mode = "hidden";
      setVisible(false);
      S.anchor = null;
      setAnchorId(null);
    };

    /* ------------------------------------------------------------ cancel */
    /** Stop the line in flight (pre-beat or open bubble); movement continues. */
    const cancelSpeech = (cut: boolean) => {
      const had = S.speaking;
      S.speakGen += 1;
      clearBubbleTimers();
      S.speaking = false;
      setBubble(null);
      setTalking(false);
      setBubbleClear(null);
      if (S.mode === "speaking") S.mode = "idle";
      if (had) {
        if (cut) scheduler.onBubbleCut(now());
        else scheduler.onBubbleEnd(now());
      }
    };
    /** Stop everything: the line AND any movement chain. */
    const cancelAll = () => {
      cancelSpeech(true);
      S.gen += 1;
    };

    /* ------------------------------------------------------------ stages */

    const onStageChange = async (next: MascotStage, prev: MascotStage) => {
      cancelAll();
      const g = S.gen;
      // Drop queued events that no longer apply.
      for (const t of scheduler.snapshot().queued) if (!STAGE_EVENTS[next].includes(t)) scheduler.drop(t);
      S.stage = next;
      S.stageEnteredAt = now();
      S.squeezeFired = false;
      S.podiumSettled = false;
      measure();

      if (prev === "countin" && next === "live") fire("surprise");

      if (next === "reveal-hidden" || !S.on) {
        const fast = next === "reveal-hidden";
        if (S.mode === "peeking") await peekOut(g, fast);
        else await exitNow(g, fast);
        return;
      }
      if (next === "reveal-suspense") {
        if (S.mode !== "hidden") await exitNow(g);
        if (!live(g)) return;
        const peek = anchorsFor("reveal-suspense")[0];
        if (peek) await peekIn(peek, g);
        return;
      }
      if (next === "podium") {
        if (S.mode !== "hidden") await exitNow(g);
        await wait(PODIUM_SETTLE_MS);
        if (!live(g)) return;
        measure();
        const home = anchorsFor("podium")[0];
        if (!home) return;
        setExpression("celebrating");
        await enterAt(home, g);
        if (!live(g)) return;
        // WP11: mini-dance on the winner-sting pulse (jump + spin + sparkles,
        // four hops), holding the line until it lands; then the smug idle and
        // the reveal_winner punchline (detectEvents waits for podiumSettled).
        S.mode = "entering";
        fire("dance");
        await wait(red() ? 1200 : PODIUM_DANCE_MS);
        if (!live(g)) return;
        S.mode = "idle";
        S.arrivedAt = now();
        S.podiumSettled = true;
        setExpression("smug");
        return;
      }
      // lobby / countin / live: keep the anchor when it still applies, else travel.
      const valid = anchorsFor(next);
      const keep = S.anchor && valid.find((a) => a.id === S.anchor?.id);
      if (S.mode === "hidden") {
        if (valid[0]) {
          setExpression(baseExpression());
          await enterAt(valid[0], g);
        }
        return;
      }
      if (keep) {
        S.anchor = keep;
        return;
      }
      if (valid[0]) {
        // Cross-stage move: exit toward the nearest edge, re-enter at the new home.
        await exitAndPeekIn(valid[0], g);
      } else {
        await exitNow(g);
      }
      scheduler.resetAmbient(now(), 2500);
    };

    const roam = async () => {
      const valid = anchorsFor(S.stage).filter((a) => a.id !== S.anchor?.id);
      if (!valid.length) {
        S.lastMoveAt = now();
        return;
      }
      const target = valid[Math.floor(rng() * valid.length)];
      const g = S.gen;
      S.bubblesSinceMove = 0;
      S.moveTarget = 1 + Math.floor(rng() * 3);
      S.roamAfterMs = uniform(rng, ROAM_IDLE_MS[0], ROAM_IDLE_MS[1]);
      S.lastMoveAt = now();
      if (rng() < 0.28) await exitAndPeekIn(target, g);
      else await travelTo(target, g);
    };

    /**
     * The layout moved under the mascot (e.g. the count-in timer pushed the
     * finalists down): cut the bubble, vanish in 120 ms and re-enter at the
     * first anchor that is still clear (or hide until one frees up).
     */
    const relocate = async () => {
      cancelAll();
      const g = S.gen;
      S.mode = "travelling";
      await animate(wrapOpacity, 0, { duration: 0.12 });
      if (!live(g)) return;
      S.mode = "hidden";
      setVisible(false);
      const target = anchorsFor(S.stage).find((a) => a.id !== S.anchor?.id) ?? anchorsFor(S.stage)[0];
      S.anchor = null;
      setAnchorId(null);
      if (!target) return;
      await wait(180);
      if (!live(g)) return;
      await enterAt(target, g);
    };

    /* ------------------------------------------------------------ overlap */
    const checkOverlap = (): { overlap: boolean; bubbleClear: boolean | null } => {
      const body = S.mode === "hidden" ? null : bodyOf(S.pose, S.baseSize);
      let hit = false;
      // Settle grace: stage crossfades keep the previous stage's keep-outs in
      // the DOM for ~320 ms; the layout is judged once it has settled.
      const settled = now() - S.stageEnteredAt > 450;
      if (body && settled && S.mode !== "travelling" && S.mode !== "exiting" && S.mode !== "entering") {
        hit = S.keepouts.some((kr) => intersects(body, kr, 0));
      }
      let bc: boolean | null = null;
      const bEl = S.speaking ? root.querySelector("[data-mascot-bubble]") : null;
      if (bEl) {
        const r = bEl.getBoundingClientRect();
        if (r.width > 0) {
          const br = rect(r.left - S.origin.x, r.top - S.origin.y, r.width, r.height);
          bc = !S.keepouts.some((kr) => intersects(br, kr, 0));
          if (!bc) hit = true;
        }
      }
      return { overlap: hit, bubbleClear: bc };
    };

    /* ------------------------------------------------------------ step */
    const step = () => {
      if (S.disposed) return;
      const t = now();
      const L = latest.current;
      if (!measure()) return;

      // Enabled / panic toggle.
      if (L.on !== S.on) {
        S.on = L.on;
        cancelAll();
        if (!S.on) {
          void exitNow(S.gen);
        } else {
          S.stage = "reveal-hidden"; // force a re-entry through the stage logic
        }
      }
      if (!S.on) return;

      // Stage transitions.
      if (L.stage !== S.stage) {
        void onStageChange(L.stage, S.stage);
        return;
      }

      // Brain: detector → scheduler.
      const det = detectEvents(detector, {
        now: t,
        status: L.status,
        teams: L.teams,
        closesAt: L.closesAt,
        joined: L.joined,
        podiumSettled: S.podiumSettled,
      });
      detector = det.state;
      const admissible = det.events.filter((e) => STAGE_EVENTS[S.stage].includes(e.type));
      if (admissible.length) scheduler.push(admissible);
      scheduler.setConfig(L.config ? { min: L.config.min ?? 14, max: L.config.max ?? 28 } : null, t);

      const canSpeak = S.mode === "idle" || S.mode === "peeking";
      const busy = !canSpeak || S.speaking || t - S.arrivedAt < 200;
      const decision = scheduler.tick(t, { busy, silent: AMBIENT_CATEGORY[S.stage] === null });
      if (decision) {
        if (decision.kind === "cut") {
          cancelSpeech(true);
        } else {
          void speak(decision);
        }
      }

      // Count-in acting: squeeze in the last 3 s.
      if (S.stage === "countin" && L.opensAt && !S.squeezeFired) {
        const left = new Date(L.opensAt).getTime() - t;
        if (left <= 3000 && left > 300) {
          S.squeezeFired = true;
          if (!S.speaking) fire("squeeze");
        }
      }
      // Live: squeeze in the last 3 s before the close, once.
      if (S.stage === "live" && L.closesAt && !S.squeezeFired) {
        const left = new Date(L.closesAt).getTime() - t;
        if (left <= 3200 && left > 300) {
          S.squeezeFired = true;
          if (!S.speaking) fire("squeeze");
        }
      }

      // Standing on an anchor that a layout shift just invalidated: move now.
      if (
        (S.mode === "idle" || S.mode === "speaking") &&
        S.anchor &&
        S.stage !== "reveal-suspense" &&
        t - S.arrivedAt > 150 &&
        !bodyClear(S.pose, S.baseSize, S.keepouts, S.frame)
      ) {
        void relocate();
        return;
      }

      // Hidden on a stage with anchors (all were blocked at entry): retry.
      if (
        S.mode === "hidden" &&
        (S.stage === "lobby" || S.stage === "countin" || S.stage === "live") &&
        t - S.stageEnteredAt > 1500
      ) {
        const v = anchorsFor(S.stage);
        if (v[0]) {
          setExpression(baseExpression());
          void enterAt(v[0], S.gen);
        }
      }

      // Idle life: base mood + occasional look-at targets.
      if (S.mode === "idle" && !S.speaking) {
        const base = S.forcedExpression ?? baseExpression();
        setExpression((cur) => (cur === base ? cur : base));
        if (t >= S.nextGlanceAt) {
          let target: Rect | null = null;
          if (S.stage === "lobby" || S.stage === "countin") target = keepoutAt(S.stage === "countin" ? "countdown" : "qr");
          else if (S.stage === "live") target = rowRect(1) ?? keepoutAt("chart");
          else if (S.stage === "podium") target = keepoutAt("podium-crown") ?? keepoutAt("podium-name");
          if (target) look(center(target));
          S.glanceUntil = t + 1400;
          S.nextGlanceAt = t + uniform(rng, 7000, 12_000);
        } else if (S.glanceUntil && t >= S.glanceUntil) {
          S.glanceUntil = 0;
          look(null);
        }

        // Roaming: every 1–3 bubbles or 25–40 s idle, when nothing is about to open.
        const idleFor = t - S.lastMoveAt;
        const due = S.bubblesSinceMove >= S.moveTarget || idleFor >= S.roamAfterMs;
        const roamAllowed = S.stage === "lobby" || S.stage === "countin" || S.stage === "live";
        const countinLast = S.stage === "countin" && L.opensAt && new Date(L.opensAt).getTime() - t < 10_000;
        const liveLast = S.stage === "live" && L.closesAt && new Date(L.closesAt).getTime() - t < 12_000;
        const next = scheduler.timeToNext(t);
        if (due && roamAllowed && !countinLast && !liveLast && idleFor > 6000 && (next === null || next > 2600)) {
          void roam();
        }
      }

      setModeAttr((m) => (m === S.mode ? m : S.mode));

      // Lab report (throttled).
      if (L.lab?.report && t - S.lastReportAt >= 250) {
        S.lastReportAt = t;
        const { overlap: ov, bubbleClear: bc } = checkOverlap();
        setOverlap(ov);
        setBubbleClear(bc);
        report({
          type: "state",
          state: {
            stage: S.stage,
            mode: S.mode,
            visible: S.mode !== "hidden",
            anchor: S.anchor?.id ?? null,
            expression: exprRef.current,
            bubble: S.speaking,
            bubbleClear: bc,
            overlap: ov,
            keepouts: S.keepouts.length,
            anchors: S.anchors.length,
            enabled: S.on,
          },
        });
      } else if (!L.lab?.report && t - S.lastReportAt >= 500) {
        S.lastReportAt = t;
        setOverlap(checkOverlap().overlap);
      }
    };

    /* ------------------------------------------------------------ lab commands */
    const unsubscribe = latest.current.lab?.subscribe?.((cmd) => {
      const t = now();
      switch (cmd.type) {
        case "expression":
          S.forcedExpression = cmd.expression;
          setExpression(cmd.expression ?? baseExpression());
          break;
        case "action":
          fire(cmd.action, S.anchor ? toEdge(S.anchor.edge) : "right");
          break;
        case "event": {
          const ev: AssistantEvent = { type: cmd.event, at: t, milestone: 100, votes: 12 };
          // Forced: bypass cooldown/once by speaking directly when free.
          if (S.speaking) cancelSpeech(true);
          void speak({ kind: "event", event: ev, at: t }, "forced");
          break;
        }
        case "random":
          if (S.speaking) cancelSpeech(true);
          void speak({ kind: "ambient", at: t }, "forced");
          break;
        case "move":
          if (!S.speaking && S.mode === "idle") void roam();
          break;
        case "toggle":
          setLocalOn((v) => !v);
          break;
      }
    });

    // Boot: first entrance a beat after mount.
    const boot = setTimeout(() => {
      if (S.disposed) return;
      measure();
      const stage = latest.current.stage;
      S.stage = "reveal-hidden";
      void onStageChange(stage, "reveal-hidden");
    }, 600);
    const interval = setInterval(step, STEP_MS);

    return () => {
      S.disposed = true;
      S.gen += 1;
      clearTimeout(boot);
      clearInterval(interval);
      clearBubbleTimers();
      unsubscribe?.();
    };
    // Mount-once controller; everything live is read through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  /* ---- "M" panic toggle (projector-local, no network) ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "m" && e.key !== "M") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setLocalOn((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // /lab QA hook: prove a mascot render error never takes the stage down.
  if (props.lab?.crash) throw new Error("MascotHost: lab crash requested (?mascotCrash=1)");

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[25] overflow-hidden"
      data-mascot-host=""
      data-mascot-stage={stage}
      data-mascot-visible={visible ? "true" : "false"}
      data-mascot-anchor-id={anchorId ?? ""}
      data-mascot-mode={modeAttr}
      data-mascot-bubble-open={bubble ? "true" : "false"}
      data-mascot-bubble-clear={bubbleClear === null ? "" : String(bubbleClear)}
      data-mascot-overlap={overlap ? "true" : "false"}
      data-mascot-on={on ? "true" : "false"}
      aria-hidden
    >
      <motion.div
        className="absolute left-0 top-0"
        style={{
          x: px,
          y: py,
          scale: sc,
          rotate: rot,
          scaleX: sx,
          scaleY: sy,
          opacity: wrapOpacity,
          transformOrigin: "50% 100%",
          willChange: "transform",
        }}
      >
        <Broqui
          size={size}
          expression={expression}
          talking={talking}
          lookAt={lookAt}
          action={action}
          reduced={props.reduced}
        />
      </motion.div>
      <AnimatePresence>
        {bubble && (
          <SpeechBubble
            key={bubble.id}
            text={bubble.text}
            pose={bubble.pose}
            baseSize={size}
            keepouts={bubble.keepouts}
            frame={bubble.frame}
            prefer={bubble.prefer}
            maxWidthPx={bubble.maxWidthPx}
            k={k}
            reduced={props.reduced}
            onPlaced={(p) => setBubbleClear(p.clear)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default MascotHost;
