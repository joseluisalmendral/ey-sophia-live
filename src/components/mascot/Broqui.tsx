"use client";

/**
 * Broqui — thePower shield brought to life. Layered SVG rig animated with
 * motion/react (springs + keyframe sequences), zero animated SVG filters.
 *
 * PUBLIC API (stable — E3/E5/E6 depend on it)
 * ----------------------------------------------------------------------------
 *   <Broqui
 *     size={200}                       // rendered HEIGHT in px of the 320×340 stage
 *                                      // (width = size * 320/340; the glow bleeds
 *                                      // outside via overflow: visible)
 *     expression="idle"                // Expression — sustained pose (see below)
 *     talking={false}                  // mouth-flap + body nod overlay
 *     lookAt={{ x: 0.3, y: -0.2 }}     // normalised -1..1 (null = ambient glances)
 *     action={{ type: "surprise", key: 1 }}
 *                                      // one-shot beat, re-fires when `key` changes:
 *                                      // "surprise" | "celebrate" | "laugh" | "enter"
 *                                      // | "exit" | "peek" | "squeeze";
 *                                      // optional `from: "left" | "right" | "bottom"`
 *                                      // for enter / exit / peek (default "right")
 *     reduced={false}                  // static poses + 200 ms fades (pass the
 *                                      // value of useReducedMotionPref())
 *     className=""                     // extra classes on the root wrapper
 *     onActionEnd={(type) => {}}       // fires when a one-shot finishes
 *   />
 *
 *   export type Expression = "idle" | "blink" | "lookAt" | "nervous" | "smug"
 *     | "surprised" | "laughing" | "thinking" | "celebrating" | "sad" | "peek"
 *     | "talking" | "squeeze";
 *   export const EXPRESSIONS: readonly Expression[];
 *   export const EXPRESSION_LABELS: Record<Expression, string>;
 *   export type BroquiAction / BroquiActionType / BroquiEdge / BroquiProps
 *
 * Behaviour notes
 *  - Changing `expression` TO "surprised" / "laughing" / "celebrating" auto-fires
 *    its signature beat once (pop / bounce cycle / jump). Use `action` to re-fire
 *    a beat without changing the pose.
 *  - "exit" leaves the character hidden off-stage until the next "enter".
 *  - "peek" slides in from the edge, holds ~1.2 s and retreats; the consumer
 *    decides what happens next in `onActionEnd("peek")` (usually "enter").
 *  - SSR-safe: no window access at module load; timers only inside effects.
 *  - Never imports Supabase or data hooks.
 *
 * Rig (two tiers, motion spec §A)
 *   HTML tier (compositor, transform/opacity only):
 *     .broqui-root   → travel / enter / exit / hop / jitter (+ will-change)
 *       .broqui-shadow (ground shadow, follows height)
 *       .broqui-float  → idle float (CSS)
 *         .broqui-sway → idle sway (CSS)
 *           .broqui-squash → pose tilt + squash/stretch (springs × keyframes)
 *             .broqui-glow-wrap → bloom pulses (one-shots)
 *               .broqui-glow    → breathing bloom (CSS)
 *             svg.broqui-halo   → halo ring (static, gentle opacity breathe)
 *             svg.broqui-svg    → the character (breathe via CSS)
 *   SVG tier (main thread, small area): face offset, eyes/lids/arcs, mouth
 *   morph (12 control-point MotionValues → one `d` write per frame), mouth
 *   opening, blush, sweat, sparkles, ellipsis, motion lines. Every SVG update
 *   is a native attribute write driven by a MotionValue subscription.
 */

import {
  animate,
  motion,
  motionValue,
  type MotionValue,
  type Transition,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ARC_L,
  ARC_R,
  CENTER,
  DROP,
  DROP_SPAWN,
  ELLIPSIS,
  EXPRESSIONS,
  EXPRESSION_LABELS,
  EYE,
  EYE_C,
  FRAME,
  HALO_WARM_ARC,
  LID_HIDDEN,
  LINE_W,
  MOUTHS,
  PALETTE,
  POSES,
  RIM,
  SHIELD,
  SPARKLE_ANGLES,
  SPEC,
  STAR,
  VIEW_H,
  VIEW_W,
  blendMs,
  mouthPath,
  type Expression,
  type Pose,
} from "./expressions";
import "./broqui.css";

export { EXPRESSIONS, EXPRESSION_LABELS };
export type { Expression };

export type BroquiActionType =
  | "surprise"
  | "celebrate"
  | "laugh"
  | "enter"
  | "exit"
  | "peek"
  | "squeeze";

export type BroquiEdge = "left" | "right" | "bottom";

export interface BroquiAction {
  type: BroquiActionType;
  /** Change the key to re-fire the same action. */
  key: number;
  /** Edge for enter / exit / peek (default "right"). */
  from?: BroquiEdge;
}

export interface BroquiProps {
  size: number;
  expression?: Expression;
  talking?: boolean;
  lookAt?: { x: number; y: number } | null;
  action?: BroquiAction | null;
  reduced?: boolean;
  className?: string;
  onActionEnd?: (type: BroquiActionType) => void;
}

/* ============================================================================
 * Small utilities
 * ========================================================================= */

type MV = MotionValue<number>;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const hidden = () => typeof document !== "undefined" && document.hidden;
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const f3 = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** Log-normal sample (used for blink intervals). */
function logNormal(mu: number, sigma: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.exp(mu + sigma * z);
}

const spring = (stiffness: number, damping: number, mass = 1): Transition => ({
  type: "spring",
  stiffness,
  damping,
  mass,
});

const SPRING_POSE = spring(170, 20, 1);
const SPRING_LOOK = spring(220, 24, 1);
const SPRING_POP = spring(280, 12, 1);
const SPRING_TALK = spring(420, 22, 0.8);

/**
 * Value factory: every MotionValue of a rig is registered in `all` so the
 * component can stop them on unmount. `derive()` builds a hook-free derived
 * MotionValue, re-evaluated whenever one of its dependencies changes — built
 * once per rig, so there are no hooks in loops and no per-render work.
 */
function makeFactory() {
  const all: MotionValue[] = [];
  const mv = <T,>(v: T): MotionValue<T> => {
    const m = motionValue(v);
    all.push(m);
    return m;
  };
  const derive = <O,>(deps: MotionValue[], fn: () => O): MotionValue<O> => {
    const out = mv(fn());
    for (const d of deps) d.on("change", () => out.set(fn()));
    return out;
  };
  return { all, mv, derive };
}

/**
 * Subscribes SVG attributes to MotionValues (one `setAttribute` per change).
 * Keeps the SVG tier free of CSS-transform/transform-box subtleties: every
 * transform is a native SVG `transform` attribute string.
 */
function useMVAttrs(
  ref: RefObject<SVGElement | null>,
  attrs: Record<string, MotionValue<string> | MotionValue<number> | undefined>,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const unsubs = Object.entries(attrs).map(([name, mv]) => {
      if (!mv) return () => {};
      el.setAttribute(name, String(mv.get()));
      return (mv as MotionValue<string | number>).on("change", (v) =>
        el.setAttribute(name, String(v)),
      );
    });
    return () => unsubs.forEach((u) => u());
  });
}

interface MGProps {
  t?: MotionValue<string>;
  o?: MotionValue<number>;
  children?: ReactNode;
}

/** `<g>` whose transform / opacity follow MotionValues. */
function MG({ t, o, children }: MGProps) {
  const ref = useRef<SVGGElement>(null);
  useMVAttrs(ref, { transform: t, opacity: o });
  return (
    <g ref={ref} transform={t?.get()} opacity={o?.get()}>
      {children}
    </g>
  );
}

interface MPathProps {
  d: MotionValue<string>;
  stroke: string;
  strokeWidth: number;
  opacity?: number;
}

/** Morphing path (`d` MotionValue) — the mouth and its glow under-stroke. */
function MPath({ d, stroke, strokeWidth, opacity }: MPathProps) {
  const ref = useRef<SVGPathElement>(null);
  useMVAttrs(ref, { d });
  return (
    <path
      ref={ref}
      d={d.get()}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

interface MEllipseProps {
  cx: MotionValue<number>;
  cy: MotionValue<number>;
  rx: MotionValue<number>;
  ry: MotionValue<number>;
  fill: string;
}

function MEllipse({ cx, cy, rx, ry, fill }: MEllipseProps) {
  const ref = useRef<SVGEllipseElement>(null);
  useMVAttrs(ref, { cx, cy, rx, ry });
  return (
    <ellipse
      ref={ref}
      cx={cx.get()}
      cy={cy.get()}
      rx={rx.get()}
      ry={ry.get()}
      fill={fill}
    />
  );
}

/* ============================================================================
 * Rig state — every animatable parameter is a MotionValue, created once.
 * ========================================================================= */

interface Drop {
  s: MV;
  ty: MV;
  o: MV;
  t: MotionValue<string>;
}
interface Sparkle {
  s: MV;
  r: MV;
  o: MV;
  t: MotionValue<string>;
}

function createRig(size0: number) {
  const { all, mv: motionValue, derive } = makeFactory();
  const idle = POSES.idle;
  const size = motionValue(size0);
  const mouth = Array.from({ length: 12 }, (_, i) =>
    motionValue<number>(MOUTHS.smile[i]),
  );
  const base = {
    size,
    mouth,
    open: motionValue(idle.open),
    openRx: motionValue(idle.openRx),
    openRy: motionValue(idle.openRy),
    talkOpen: motionValue(0),
    // eyes
    eyeLsx: motionValue(1),
    eyeLsy: motionValue(1),
    eyeLrot: motionValue(0),
    eyeRsx: motionValue(1),
    eyeRsy: motionValue(1),
    eyeRrot: motionValue(0),
    eyeY: motionValue(0),
    eyeActSx: motionValue(1),
    eyeActSy: motionValue(1),
    blink: motionValue(1),
    lidL: motionValue(LID_HIDDEN),
    lidR: motionValue(LID_HIDDEN),
    lidRot: motionValue(0),
    arc: motionValue(0),
    // face
    faceX: motionValue(0),
    faceY: motionValue(0),
    lookNx: motionValue(0),
    lookNy: motionValue(0),
    dartX: motionValue(0),
    dartY: motionValue(0),
    browY: motionValue(0),
    blush: motionValue(0),
    bloom: motionValue(1),
    bloomPulse: motionValue(1),
    // body (squash tier)
    bodyRot: motionValue(0),
    bodySx: motionValue(1),
    bodySy: motionValue(1),
    bodyY: motionValue(0),
    actRot: motionValue(0),
    actSx: motionValue(1),
    actSy: motionValue(1),
    nodY: motionValue(0),
    talkY: motionValue(0),
    talkRot: motionValue(0),
    // root tier
    rootX: motionValue(0),
    rootY: motionValue(0),
    rootRot: motionValue(0),
    rootScale: motionValue(1),
    rootOpacity: motionValue(1),
    jitterX: motionValue(0),
    jitterY: motionValue(0),
    shadowLand: motionValue(1),
    lines: motionValue(0),
    dots: ELLIPSIS.map(() => motionValue(0)),
  };
  const b = base;

  const drop = (side: "L" | "R"): Drop => {
    const s = motionValue(0);
    const ty = motionValue(0);
    const o = motionValue(1);
    const t = derive(
      [s, ty],
      () =>
        `translate(${DROP_SPAWN[side].x} ${f1(DROP_SPAWN[side].y + ty.get())}) scale(${f3(s.get())})`,
    );
    return { s, ty, o, t };
  };
  const sparkle = (angle: number): Sparkle => {
    const a = (angle * Math.PI) / 180;
    const x = f1(CENTER.x + 150 * Math.cos(a));
    const y = f1(CENTER.y + 150 * Math.sin(a));
    const s = motionValue(0);
    const r = motionValue(0);
    const o = motionValue(0);
    const t = derive(
      [s, r],
      () => `translate(${x} ${y}) rotate(${f1(r.get())}) scale(${f3(s.get())})`,
    );
    return { s, r, o, t };
  };

  const eyeT = (side: "L" | "R") => {
    const c = EYE_C[side];
    const sx = side === "L" ? b.eyeLsx : b.eyeRsx;
    const sy = side === "L" ? b.eyeLsy : b.eyeRsy;
    const rot = side === "L" ? b.eyeLrot : b.eyeRrot;
    return derive(
      [sx, sy, rot, b.eyeY, b.eyeActSx, b.eyeActSy, b.blink],
      () =>
        `translate(${c.x} ${f1(c.y + b.eyeY.get())}) rotate(${f1(rot.get())}) scale(${f3(sx.get() * b.eyeActSx.get())} ${f3(sy.get() * b.eyeActSy.get() * b.blink.get())}) translate(${-c.x} ${-c.y})`,
    );
  };
  const lidT = (side: "L" | "R") => {
    const c = EYE_C[side];
    const y = side === "L" ? b.lidL : b.lidR;
    return derive(
      [y, b.lidRot],
      () =>
        `translate(${c.x} ${c.y}) rotate(${f1(b.lidRot.get())}) translate(${-c.x} ${-c.y}) translate(0 ${f1(y.get())})`,
    );
  };

  const openAmt = derive([b.open, b.talkOpen], () =>
    Math.max(b.open.get(), b.talkOpen.get()),
  );
  const ellRy = derive(
    [b.openRy, openAmt],
    () => b.openRy.get() * openAmt.get() + 0.01,
  );

  const derived = {
    mouthD: derive(mouth, () => mouthPath(mouth.map((m) => m.get()))),
    // mouth opening ellipse (ell*) — distinct names from the pose inputs open*
    ellCx: mouth[4],
    ellCy: derive([mouth[5], ellRy], () => mouth[5].get() - 4 - ellRy.get()),
    ellRx: derive(
      [b.openRx, openAmt],
      () => b.openRx.get() * (0.55 + 0.45 * openAmt.get()),
    ),
    ellRy,
    faceT: derive(
      [b.faceX, b.faceY, b.lookNx, b.lookNy, b.dartX, b.dartY],
      () =>
        `translate(${f1(b.faceX.get() + 9 * b.lookNx.get() + b.dartX.get())} ${f1(b.faceY.get() + 6 * b.lookNy.get() + b.dartY.get())})`,
    ),
    specT: derive(
      [b.lookNx, b.lookNy],
      () => `translate(${f1(-3 * b.lookNx.get())} ${f1(-2 * b.lookNy.get())})`,
    ),
    frameT: derive([b.browY], () => `translate(0 ${f1(b.browY.get())})`),
    eyeLT: eyeT("L"),
    eyeRT: eyeT("R"),
    lidLT: lidT("L"),
    lidRT: lidT("R"),
    capsuleO: derive([b.arc], () => 1 - b.arc.get()),
    linesT: derive([b.lines], () => `translate(${f1(-10 * b.lines.get())} 0)`),
    dotT: b.dots.map((d, i) =>
      derive(
        [d],
        () => `translate(${ELLIPSIS[i].x} ${ELLIPSIS[i].y}) scale(${f3(d.get())})`,
      ),
    ),
    dropL: drop("L"),
    dropR: drop("R"),
    sparkles: SPARKLE_ANGLES.map(sparkle),
    // HTML tier
    squashSx: derive([b.bodySx, b.actSx], () => b.bodySx.get() * b.actSx.get()),
    squashSy: derive([b.bodySy, b.actSy], () => b.bodySy.get() * b.actSy.get()),
    squashRot: derive(
      [b.bodyRot, b.actRot, b.lookNx, b.talkRot],
      () =>
        b.bodyRot.get() + b.actRot.get() + 2.5 * b.lookNx.get() + b.talkRot.get(),
    ),
    squashY: derive(
      [b.bodyY, b.nodY, b.talkY],
      () => b.bodyY.get() + b.nodY.get() + b.talkY.get(),
    ),
    rootXT: derive([b.rootX, b.jitterX], () => b.rootX.get() + b.jitterX.get()),
    rootYT: derive([b.rootY, b.jitterY], () => b.rootY.get() + b.jitterY.get()),
    shadowSx: derive(
      [b.rootY, b.shadowLand, size],
      () =>
        clamp(1 - -b.rootY.get() / (size.get() * 0.9), 0.45, 1.3) *
        b.shadowLand.get(),
    ),
    shadowO: derive(
      [b.rootY, b.rootOpacity, size],
      () =>
        clamp(1 - -b.rootY.get() / (size.get() * 0.55), 0.15, 1) *
        b.rootOpacity.get(),
    ),
    glowO: derive([b.bloom, b.bloomPulse], () =>
      clamp(b.bloom.get() * b.bloomPulse.get(), 0, 1.2),
    ),
  };

  return { ...b, ...derived, all };
}

type Rig = ReturnType<typeof createRig>;

/* ============================================================================
 * Component
 * ========================================================================= */

export function Broqui({
  size,
  expression = "idle",
  talking = false,
  lookAt = null,
  action = null,
  reduced = false,
  className,
  onActionEnd,
}: BroquiProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${uid}-${n}`;
  const [rig] = useState<Rig>(() => createRig(size));
  const k = size / 200; // px scale: spec values are for a 200 px mascot
  const width = (size * VIEW_W) / VIEW_H;

  const exprRef = useRef<Expression>(expression);
  const prevExprRef = useRef<Expression>(expression);
  const reducedRef = useRef(reduced);
  const poseChangedAt = useRef(0);
  const onActionEndRef = useRef(onActionEnd);
  const talkingActive = talking || POSES[expression].talk;

  useEffect(() => {
    rig.size.set(size);
  }, [rig, size]);

  /* ---------------------------------------------------------------- go() */
  // `animate(mv, target, transition)` — springs by default, 200 ms tween when
  // reduced. Motion stops any running animation on that value first, so the
  // blend always starts from the current value + velocity.
  const go = useCallback(
    (mv: MV, target: number, t: Transition = SPRING_POSE) =>
      animate(
        mv,
        target,
        reducedRef.current ? { duration: 0.2, ease: "easeOut" } : t,
      ),
    [],
  );

  /* ------------------------------------------------------ pose application */
  function applyPose(p: Pose, ms = 320) {
    // stiffer spring for faster blends (320 ms ≈ the default {170,20})
    const st = clamp((170 * 320) / ms, 120, 620);
    const s = spring(st, 20 + (st - 170) / 40, 1);
    const target = MOUTHS[p.mouth];
    rig.mouth.forEach((mv, i) => go(mv, target[i], s));
    go(rig.open, p.open, s);
    go(rig.openRx, p.openRx, s);
    go(rig.openRy, p.openRy, s);
    go(rig.eyeLsx, p.eyeL.sx, s);
    go(rig.eyeLsy, p.eyeL.sy, s);
    go(rig.eyeLrot, p.eyeL.rot, s);
    go(rig.eyeRsx, p.eyeR.sx, s);
    go(rig.eyeRsy, p.eyeR.sy, s);
    go(rig.eyeRrot, p.eyeR.rot, s);
    go(rig.eyeY, p.eyeY, s);
    go(rig.lidL, p.lidL, s);
    go(rig.lidR, p.lidR, s);
    go(rig.lidRot, p.lidRot, s);
    go(rig.arc, p.arc, s);
    go(rig.faceX, p.face.x, s);
    go(rig.faceY, p.face.y, s);
    go(rig.blush, p.blush, s);
    go(rig.bloom, p.bloom, s);
    go(rig.bodyRot, p.body.rot, s);
    go(rig.bodySx, p.body.sx, s);
    go(rig.bodySy, p.body.sy, s);
    go(rig.bodyY, p.body.y * k, spring(120, 16, 1));
  }
  const applyPoseRef = useRef(applyPose);

  /* ------------------------------------------------------------- blink */
  const blinkingRef = useRef(false);
  async function doBlink() {
    if (blinkingRef.current) return;
    const p = POSES[exprRef.current];
    if (p.arc > 0.5 || p.eyeL.sy < 0.3) return; // crescents / squeezed shut
    blinkingRef.current = true;
    await animate(rig.blink, [1, 0.06, 0.06, 1], {
      duration: 0.21 * p.blinkSlow,
      times: [0, 0.333, 0.524, 1],
      ease: [[0.4, 0, 1, 1], "linear", [0, 0, 0.2, 1]],
    });
    blinkingRef.current = false;
  }
  const doBlinkRef = useRef(doBlink);

  /* ----------------------------------------------------------- actions */
  const actionRun = useRef(0);

  async function runAction(type: BroquiActionType, from: BroquiEdge = "right") {
    const run = ++actionRun.current;
    const live = () => actionRun.current === run;
    const red = reducedRef.current;
    const off = (edge: BroquiEdge) =>
      edge === "left"
        ? -(width + 120 * k)
        : edge === "bottom"
          ? size + 120 * k
          : width + 120 * k;

    switch (type) {
      case "surprise": {
        if (red) {
          await animate(rig.bloomPulse, [1, 1.12, 1], { duration: 0.6 });
          break;
        }
        // anticipation squat
        const ant = { duration: 0.09, ease: [0.3, 0, 0.6, 1] } as Transition;
        animate(rig.eyeActSy, 0.7, ant);
        animate(rig.actSx, 1.12, ant);
        await animate(rig.actSy, 0.88, ant);
        if (!live()) break;
        // pop
        animate(rig.actSx, [0.9, 1], SPRING_POP);
        animate(rig.actSy, [1.16, 1], SPRING_POP);
        animate(rig.eyeActSx, 1.12, spring(500, 18, 1));
        animate(rig.eyeActSy, 1.22, spring(500, 18, 1));
        animate(rig.rootY, [-10 * k, 0], spring(240, 14, 1));
        animate(rig.bloomPulse, [1.1, 1], { duration: 0.3 });
        await wait(900);
        if (!live()) break;
        animate(rig.eyeActSx, 1, spring(200, 22, 1));
        await animate(rig.eyeActSy, 1, spring(200, 22, 1));
        break;
      }
      case "laugh": {
        if (red) {
          await animate(rig.bloomPulse, [1, 1.08, 1], { duration: 0.6 });
          break;
        }
        const cycles = 5;
        const c = 0.28;
        animate(rig.rootY, [0, -9 * k, 0], {
          duration: c,
          repeat: cycles - 1,
          ease: ["easeOut", "easeIn"],
        });
        animate(rig.actSy, [1, 1.04, 0.97, 1], {
          duration: c,
          repeat: cycles - 1,
        });
        animate(rig.actRot, [0, 2, 0, -2, 0], {
          duration: c * 2,
          repeat: Math.ceil(cycles / 2) - 1,
        });
        animate(rig.talkOpen, [0.6, 1, 0.6], {
          duration: c,
          repeat: cycles - 1,
        });
        animate(rig.lines, [0, 1, 0], {
          duration: c * cycles,
          times: [0, 0.3, 1],
        });
        await wait(c * cycles * 1000);
        if (!live()) break;
        animate(rig.talkOpen, 0, { duration: 0.3 });
        animate(rig.actRot, 0, spring(200, 18, 1));
        // sigh (follow-through)
        await animate(rig.actSy, [1.03, 1], {
          duration: 0.5,
          ease: "easeInOut",
        });
        break;
      }
      case "celebrate": {
        if (red) {
          animate(rig.bloomPulse, [1, 1.15, 1], { duration: 0.9 });
          rig.sparkles.forEach((sp, i) => {
            setTimeout(() => {
              sp.s.set(1);
              animate(sp.o, [0, 1, 0], { duration: 0.6 });
            }, i * 70);
          });
          await wait(1100);
          break;
        }
        animate(rig.arc, 0, { duration: 0.1 });
        animate(rig.eyeActSx, 1.1, { duration: 0.12 });
        animate(rig.eyeActSy, 1.15, { duration: 0.12 });
        // squat
        const squat = { duration: 0.12, ease: [0.3, 0, 0.6, 1] } as Transition;
        animate(rig.actSx, 1.1, squat);
        await animate(rig.actSy, 0.86, squat);
        if (!live()) break;
        // ascent + spin
        const up = { duration: 0.26, ease: [0.2, 0, 0.1, 1] } as Transition;
        animate(rig.actSx, 0.92, up);
        animate(rig.actSy, 1.14, up);
        animate(rig.rootRot, [0, 360], {
          duration: 0.5,
          ease: [0.3, 0, 0.2, 1],
        });
        animate(rig.lines, [0, 1, 0], { duration: 0.5, times: [0, 0.4, 1] });
        rig.sparkles.forEach((sp, i) => {
          setTimeout(() => {
            if (!live()) return;
            sp.o.set(1);
            animate(sp.s, [0, 1, 0], { duration: 0.52, ease: "easeOut" });
            animate(sp.r, [0, 90], { duration: 0.52 });
          }, 180 + i * 70);
        });
        await animate(rig.rootY, -90 * k, up);
        if (!live()) break;
        animate(rig.actSx, 1, { duration: 0.06 });
        animate(rig.actSy, 1, { duration: 0.06 });
        await wait(60); // hang
        if (!live()) break;
        const down = { duration: 0.22, ease: [0.6, 0, 1, 1] } as Transition;
        animate(rig.actSx, 0.94, down);
        animate(rig.actSy, 1.08, down);
        await animate(rig.rootY, 0, down);
        if (!live()) break;
        // landing squash + follow-through
        rig.rootRot.set(0);
        animate(rig.actSx, [1.14, 1], spring(300, 14, 1));
        animate(rig.actSy, [0.84, 1], spring(300, 14, 1));
        animate(rig.shadowLand, [1.3, 1], spring(300, 16, 1));
        animate(rig.bloomPulse, [1.15, 1], { duration: 0.6 });
        animate(rig.eyeActSx, 1, spring(300, 20, 1));
        animate(rig.eyeActSy, 1, spring(300, 20, 1));
        await animate(rig.arc, POSES[exprRef.current].arc, { duration: 0.2 });
        break;
      }
      case "enter": {
        const start = off(from);
        const axis = from === "bottom" ? rig.rootY : rig.rootX;
        // A previous exit may have left the OTHER axis off-stage: reset it so
        // an exit-right → enter-bottom sequence lands exactly on the wrapper.
        (from === "bottom" ? rig.rootX : rig.rootY).set(0);
        rig.rootOpacity.set(0);
        axis.set(start);
        rig.rootRot.set(from === "left" ? -8 : from === "bottom" ? 0 : 8);
        rig.rootScale.set(0.9);
        animate(rig.rootOpacity, 1, { duration: red ? 0.24 : 0.15 });
        if (red) {
          axis.set(0);
          rig.rootRot.set(0);
          rig.rootScale.set(1);
          await wait(240);
          break;
        }
        animate(rig.rootRot, 0, spring(220, 18, 1));
        animate(rig.rootScale, 1, spring(220, 18, 1));
        animate(rig.shadowLand, [0.9, 1.1, 1], { duration: 0.6 });
        await animate(axis, 0, spring(180, 20, 1.1));
        break;
      }
      case "exit": {
        const end = off(from);
        const axis = from === "bottom" ? rig.rootY : rig.rootX;
        if (red) {
          await animate(rig.rootOpacity, 0, { duration: 0.24 });
          axis.set(end);
          break;
        }
        // anticipation: a step INTO the screen
        const ant = { duration: 0.11, ease: [0.3, 0, 0.6, 1] } as Transition;
        animate(rig.actSx, 1.06, ant);
        animate(rig.actSy, 0.94, ant);
        await animate(axis, from === "left" ? 10 * k : -10 * k, ant);
        if (!live()) break;
        animate(rig.actSx, 1, { duration: 0.2 });
        animate(rig.actSy, 1, { duration: 0.2 });
        const out = { duration: 0.32, ease: [0.5, 0, 1, 1] } as Transition;
        animate(rig.rootRot, from === "left" ? -6 : 6, out);
        animate(rig.rootOpacity, 0, { duration: 0.12, delay: 0.2 });
        await animate(axis, end, out);
        rig.rootRot.set(0);
        break;
      }
      case "peek": {
        const axis = from === "bottom" ? rig.rootY : rig.rootX;
        const dir = from === "left" ? -1 : 1;
        const full = from === "bottom" ? size * 1.05 : width * 1.05 * dir;
        const half = from === "bottom" ? size * 0.55 : width * 0.55 * dir;
        axis.set(full);
        rig.rootOpacity.set(1);
        if (red) {
          axis.set(half);
          await wait(1400);
          axis.set(full);
          break;
        }
        animate(rig.rootRot, from === "bottom" ? 0 : -12 * dir, spring(160, 18, 1));
        await animate(axis, half, spring(160, 18, 1));
        if (!live()) break;
        void doBlinkRef.current();
        go(rig.lookNx, -0.5 * dir, SPRING_LOOK);
        await wait(1200);
        if (!live()) break;
        animate(rig.rootRot, 0, { duration: 0.26 });
        go(rig.lookNx, 0, SPRING_LOOK);
        await animate(axis, full, { duration: 0.26, ease: [0.4, 0, 1, 1] });
        break;
      }
      case "squeeze": {
        applyPoseRef.current(POSES.squeeze, 220);
        if (!red) {
          const t0 = Date.now();
          while (live() && Date.now() - t0 < 1400) {
            animate(rig.jitterX, rand(-1, 1) * k, { duration: 0.045, ease: "linear" });
            animate(rig.jitterY, rand(-0.6, 0.6) * k, { duration: 0.045, ease: "linear" });
            await wait(45);
          }
          animate(rig.jitterX, 0, { duration: 0.1 });
          animate(rig.jitterY, 0, { duration: 0.1 });
        } else await wait(1400);
        if (live()) applyPoseRef.current(POSES[exprRef.current], 320);
        break;
      }
    }
    if (live()) onActionEndRef.current?.(type);
  }
  const runActionRef = useRef(runAction);

  /* ----------------------------------------------------------- effects */

  // Latest-closure refs (updated in an effect, never during render). Declared
  // before every other effect so they are fresh when those run.
  useEffect(() => {
    reducedRef.current = reduced;
    onActionEndRef.current = onActionEnd;
    applyPoseRef.current = applyPose;
    doBlinkRef.current = doBlink;
    runActionRef.current = runAction;
  });

  // Stop every running animation on unmount (MotionValue animations outlive
  // the DOM otherwise). Values are not destroyed: StrictMode re-mounts.
  useEffect(() => {
    return () => rig.all.forEach((v) => v.stop());
  }, [rig]);

  // Pose blend + pose-specific loops (sweat, darts, jitter, ellipsis, nods).
  useEffect(() => {
    const prev = prevExprRef.current;
    exprRef.current = expression;
    prevExprRef.current = expression;
    poseChangedAt.current = Date.now();
    const p = POSES[expression];
    applyPoseRef.current(p, blendMs(prev, expression));

    const timers: number[] = [];
    let alive = true;
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => alive && fn(), ms);
      timers.push(t);
      return t;
    };
    const isReduced = () => reducedRef.current;

    // Signature beat when arriving at a "big" expression.
    if (prev !== expression) {
      if (expression === "surprised") void runActionRef.current("surprise");
      else if (expression === "laughing") void runActionRef.current("laugh");
      else if (expression === "celebrating") void runActionRef.current("celebrate");
    }

    // Micro-jitter (nervous) / tremble (squeeze) on the root.
    if (p.jitter && !isReduced()) {
      const amp = p.jitter === 1 ? { x: 1.5, y: 1, ms: 90 } : { x: 1, y: 0.6, ms: 45 };
      const tick = () => {
        if (!hidden()) {
          animate(rig.jitterX, rand(-amp.x, amp.x) * k, { duration: amp.ms / 1000, ease: "linear" });
          animate(rig.jitterY, rand(-amp.y, amp.y) * k, { duration: amp.ms / 1000, ease: "linear" });
        }
        later(tick, amp.ms);
      };
      tick();
    }

    // Eye darts (nervous).
    if (p.darts && !isReduced()) {
      let sign = 1;
      const dart = () => {
        sign = -sign;
        animate(rig.dartX, sign * rand(5, 7), { duration: 0.09, ease: [0.3, 0, 0.2, 1] });
        animate(rig.dartY, rand(-2, 3), { duration: 0.09, ease: [0.3, 0, 0.2, 1] });
        later(dart, rand(600, 1400));
      };
      later(dart, rand(200, 500));
    }

    // Sweat: beads, slides down the shell edge, sticks, then falls.
    const spawnDrop = async (d: Drop) => {
      if (isReduced()) {
        d.ty.set(20);
        d.s.set(1);
        await animate(d.o, 0.9, { duration: 0.25 });
        await wait(900);
        await animate(d.o, 0, { duration: 0.25 });
        d.s.set(0);
        return;
      }
      d.ty.set(0);
      d.o.set(1);
      await animate(d.s, 1.15, spring(400, 14, 1));
      if (!alive) return;
      await animate(d.ty, 38, { duration: 0.7, ease: [0.4, 0, 1, 1] });
      if (!alive) return;
      animate(d.o, 0, { duration: 0.35, ease: [0.5, 0, 1, 1] });
      await animate(d.ty, 92, { duration: 0.35, ease: [0.5, 0, 1, 1] });
      d.s.set(0);
      d.ty.set(0);
    };
    if (p.sweat === "loop") {
      let side: "L" | "R" = "R";
      const loop = () => {
        if (!hidden()) void spawnDrop(side === "R" ? rig.dropR : rig.dropL);
        side = side === "R" ? "L" : "R";
        later(loop, rand(1400, 2200));
      };
      later(loop, 350);
    } else if (p.sweat === "once") {
      later(() => void spawnDrop(rig.dropR), 500);
    }

    // Thinking: "…" loop + a small "hm" nod every 2 s.
    if (p.ellipsis) {
      const cycle = () => {
        rig.dots.forEach((d, i) =>
          later(() => animate(d, 1, isReduced() ? { duration: 0.2 } : spring(400, 18, 1)), i * 220),
        );
        later(() => rig.dots.forEach((d) => animate(d, 0, { duration: 0.2 })), 1400);
        later(cycle, 2000);
      };
      cycle();
      if (!isReduced()) {
        const hm = () => {
          animate(rig.nodY, [0, 2 * k, 0], { duration: 0.4, ease: "easeInOut" });
          later(hm, 2000);
        };
        later(hm, 900);
      }
    }

    // Smug: slow nod once + raised-brow beat (the frame line lifts 3 units).
    if (expression === "smug" && !isReduced()) {
      animate(rig.actRot, [0, 2, -1, 1.5, 0], {
        duration: 1.8,
        times: [0, 0.267, 0.5, 0.722, 1],
        ease: "easeInOut",
      });
      animate(rig.browY, [0, -3, -3, 0], { duration: 0.5, times: [0, 0.3, 0.7, 1] });
    }

    // Blink expression: an immediate blink sells it.
    if (expression === "blink") later(() => void doBlinkRef.current(), 120);

    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
      // Retire the pose-owned overlays so the next pose starts clean.
      animate(rig.jitterX, 0, { duration: 0.12 });
      animate(rig.jitterY, 0, { duration: 0.12 });
      animate(rig.dartX, 0, { duration: 0.15 });
      animate(rig.dartY, 0, { duration: 0.15 });
      rig.dots.forEach((d) => animate(d, 0, { duration: 0.15 }));
      for (const d of [rig.dropL, rig.dropR]) {
        animate(d.o, 0, { duration: 0.2 }).then(() => {
          d.s.set(0);
          d.ty.set(0);
          d.o.set(1);
        });
      }
    };
  }, [expression, rig, k]);

  // Reduced-motion flips re-apply the pose with tweens (no spring tails).
  useEffect(() => {
    applyPoseRef.current(POSES[exprRef.current], 200);
  }, [reduced]);

  // Look-at (driven) → face offset, body tilt, specular parallax.
  const lookX = lookAt?.x;
  const lookY = lookAt?.y;
  const driven = lookAt !== null && lookAt !== undefined;
  useEffect(() => {
    if (lookX === undefined || lookY === undefined) return;
    go(rig.lookNx, clamp(lookX, -1, 1), SPRING_LOOK);
    go(rig.lookNy, clamp(lookY, -1, 1), SPRING_LOOK);
  }, [lookX, lookY, rig, go]);

  // Ambient glances when nobody drives the eyes.
  useEffect(() => {
    if (driven) return;
    const mode = POSES[expression].glance;
    const back = spring(140, 18, 1);
    go(rig.lookNx, 0, back);
    go(rig.lookNy, 0, back);
    if (mode === "none") return;
    let alive = true;
    let t = 0;
    const amp = mode === "active" ? 0.8 : 0.4;
    const next = () => {
      const delay = mode === "active" ? rand(1600, 3000) : rand(6000, 11000);
      t = window.setTimeout(() => {
        if (!alive) return;
        if (hidden()) return next();
        go(rig.lookNx, rand(-amp, amp), back);
        go(rig.lookNy, rand(-amp * 0.6, amp * 0.6), back);
        t = window.setTimeout(
          () => {
            if (!alive) return;
            go(rig.lookNx, 0, back);
            go(rig.lookNy, 0, back);
            next();
          },
          mode === "active" ? 900 : 700,
        );
      }, delay);
    };
    next();
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [driven, expression, rig, go]);

  // Blink scheduler: log-normal intervals, 14% doubles, never within 300 ms
  // of a pose change, paused while the tab is hidden.
  useEffect(() => {
    const rate = POSES[expression].blinkRate;
    if (rate === 0) return;
    let alive = true;
    let t = 0;
    const schedule = () => {
      const ms = clamp(logNormal(Math.log(3.4), 0.45), 1.8, 7.5) * 1000 * rate;
      t = window.setTimeout(async () => {
        if (!alive) return;
        if (Date.now() - poseChangedAt.current < 300 || hidden()) {
          t = window.setTimeout(schedule, 300);
          return;
        }
        await doBlinkRef.current();
        if (alive && Math.random() < 0.14) {
          t = window.setTimeout(() => alive && doBlinkRef.current(), 220);
        }
        if (alive) schedule();
      }, ms);
    };
    schedule();
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [expression]);

  // Talk cycle: mouth flap + body nod; mouth shape leans 30% toward "laugh".
  useEffect(() => {
    if (!talkingActive) return;
    let t = 0;
    const base = MOUTHS[POSES[exprRef.current].mouth];
    const laugh = MOUTHS.laugh;
    rig.mouth.forEach((mv, i) =>
      go(mv, base[i] + (laugh[i] - base[i]) * 0.3, spring(200, 22, 1)),
    );
    const tick = () => {
      const r = Math.random();
      const target = r < 0.68 ? rand(0.45, 0.9) : r < 0.92 ? rand(0.15, 0.35) : 0;
      go(rig.talkOpen, target, SPRING_TALK);
      t = window.setTimeout(tick, rand(95, 150));
    };
    tick();
    if (!reducedRef.current) {
      animate(rig.talkY, [0, -1.5 * k, 0, 1.5 * k, 0], {
        duration: 1 / 3.3,
        repeat: Infinity,
        ease: "easeInOut",
      });
      animate(rig.talkRot, [0, 0.8, 0, -0.8, 0], {
        duration: 1 / 2.1,
        repeat: Infinity,
        ease: "easeInOut",
      });
    }
    return () => {
      window.clearTimeout(t);
      go(rig.talkOpen, 0, spring(300, 24, 1));
      animate(rig.talkY, 0, { duration: 0.24 });
      animate(rig.talkRot, 0, { duration: 0.24 });
      // Back to the pose's mouth (≈240 ms per spec).
      const cur = MOUTHS[POSES[exprRef.current].mouth];
      rig.mouth.forEach((mv, i) => go(mv, cur[i], spring(260, 24, 1)));
    };
  }, [talkingActive, rig, go, k]);

  // One-shot actions.
  const actionKey = action?.key;
  const actionType = action?.type;
  const actionFrom = action?.from;
  useEffect(() => {
    if (actionKey === undefined || !actionType) return;
    void runActionRef.current(actionType, actionFrom ?? "right");
  }, [actionKey, actionType, actionFrom]);

  /* ----------------------------------------------------------- render */
  const floatAmp = 6 * k * POSES[expression].floatAmp;
  const rootVars = { "--broqui-float": `${floatAmp.toFixed(2)}px` } as CSSProperties;

  return (
    <motion.div
      className={["broqui-root", className ?? ""].join(" ").trim()}
      data-broqui=""
      data-reduced={reduced ? "true" : "false"}
      aria-hidden
      style={{
        ...rootVars,
        width,
        height: size,
        x: rig.rootXT,
        y: rig.rootYT,
        rotate: rig.rootRot,
        scale: rig.rootScale,
        opacity: rig.rootOpacity,
      }}
    >
      <motion.div
        className="broqui-shadow"
        style={{ scaleX: rig.shadowSx, opacity: rig.shadowO }}
      />
      <div className="broqui-tier broqui-float">
        <div className="broqui-tier broqui-sway">
          <motion.div
            className="broqui-tier broqui-squash"
            style={{
              scaleX: rig.squashSx,
              scaleY: rig.squashSy,
              rotate: rig.squashRot,
              y: rig.squashY,
            }}
          >
            <motion.div
              className="broqui-glow-wrap"
              style={{ scale: rig.bloomPulse, opacity: rig.glowO }}
            >
              <div className="broqui-glow" />
            </motion.div>

            {/* Halo — its own svg (HTML-level CSS breathe). Teal ring fading
                from the top-left, plus a short warm arc where the rim light hits. */}
            <svg className="broqui-svg broqui-halo" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
              <defs>
                <linearGradient id={id("ring")} x1="0" y1="0.15" x2="1" y2="0.85">
                  <stop offset="0" stopColor="#5fe9d0" stopOpacity="0.8" />
                  <stop offset="0.4" stopColor="#3fbfae" stopOpacity="0.38" />
                  <stop offset="0.72" stopColor="#3fbfae" stopOpacity="0" />
                  <stop offset="1" stopColor="#3fbfae" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={id("warm")} gradientUnits="userSpaceOnUse" x1="183" y1="20" x2="291" y2="139">
                  <stop offset="0" stopColor="#d7f542" stopOpacity="0" />
                  <stop offset="0.35" stopColor="#d7f542" stopOpacity="0.95" />
                  <stop offset="0.7" stopColor="#9be15d" stopOpacity="0.8" />
                  <stop offset="1" stopColor="#9be15d" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx={CENTER.x} cy={CENTER.y} r="132" fill="none" stroke={`url(#${id("ring")})`} strokeWidth="12" opacity="0.16" />
              <circle cx={CENTER.x} cy={CENTER.y} r="132" fill="none" stroke={`url(#${id("ring")})`} strokeWidth="2.2" />
              <path d={HALO_WARM_ARC} fill="none" stroke={`url(#${id("warm")})`} strokeWidth="10" strokeLinecap="round" opacity="0.28" />
              <path d={HALO_WARM_ARC} fill="none" stroke={`url(#${id("warm")})`} strokeWidth="2.6" strokeLinecap="round" />
            </svg>

            <svg className="broqui-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
              <defs>
                <linearGradient id={id("shell")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={PALETTE.shellTop} />
                  <stop offset="0.45" stopColor={PALETTE.shellMid} />
                  <stop offset="1" stopColor={PALETTE.shellDeep} />
                </linearGradient>
                <linearGradient id={id("band")} x1="0.1" y1="0" x2="0.9" y2="1">
                  <stop offset="0" stopColor="#1f8f8c" stopOpacity="0.95" />
                  <stop offset="0.5" stopColor="#115d62" stopOpacity="0.95" />
                  <stop offset="1" stopColor="#0a3d45" stopOpacity="0.97" />
                </linearGradient>
                <linearGradient id={id("edge")} x1="0.15" y1="0" x2="0.85" y2="1">
                  <stop offset="0" stopColor="#8dfff0" stopOpacity="1" />
                  <stop offset="0.45" stopColor={PALETTE.edgeMid} stopOpacity="0.95" />
                  <stop offset="1" stopColor={PALETTE.edgeBottom} stopOpacity="0.85" />
                </linearGradient>
                <radialGradient id={id("glass")} gradientUnits="userSpaceOnUse" cx="140" cy="100" r="170">
                  <stop offset="0" stopColor="#2aa79c" stopOpacity="0.2" />
                  <stop offset="0.55" stopColor="#145f60" stopOpacity="0.06" />
                  <stop offset="1" stopColor="#145f60" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={id("floor")} gradientUnits="userSpaceOnUse" cx="160" cy="252" r="90">
                  <stop offset="0" stopColor={PALETTE.edgeMid} stopOpacity="0.14" />
                  <stop offset="1" stopColor={PALETTE.edgeMid} stopOpacity="0" />
                </radialGradient>
                <linearGradient id={id("spec")} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={id("rim")} gradientUnits="userSpaceOnUse" x1="168" y1="44" x2="246" y2="128">
                  <stop offset="0" stopColor="#96d3b4" stopOpacity="0" />
                  <stop offset="0.4" stopColor="#c8f26a" stopOpacity="0.9" />
                  <stop offset="0.75" stopColor={PALETTE.eyYellow} stopOpacity="0.85" />
                  <stop offset="1" stopColor={PALETTE.eyYellow} stopOpacity="0" />
                </linearGradient>
                <radialGradient id={id("eyeglow")}>
                  <stop offset="0" stopColor={PALETTE.line} stopOpacity="0.45" />
                  <stop offset="0.6" stopColor={PALETTE.line} stopOpacity="0.12" />
                  <stop offset="1" stopColor={PALETTE.line} stopOpacity="0" />
                </radialGradient>
                <clipPath id={id("eyeLClip")}>
                  <rect x={EYE.xL} y={EYE.y} width={EYE.w} height={EYE.h} rx={EYE.rx} />
                </clipPath>
                <clipPath id={id("eyeRClip")}>
                  <rect x={EYE.xR} y={EYE.y} width={EYE.w} height={EYE.h} rx={EYE.rx} />
                </clipPath>
                <clipPath id={id("shellClip")}>
                  <path d={SHIELD} />
                </clipPath>
              </defs>

              {/* ---------------- body ---------------- */}
              <g>
                {/* outer cyan bloom spill (stacked wide strokes = pre-blurred, no filter) */}
                <path d={SHIELD} fill="none" stroke={PALETTE.edgeMid} strokeWidth="64" opacity="0.04" />
                <path d={SHIELD} fill="none" stroke={PALETTE.edgeMid} strokeWidth="42" opacity="0.06" />
                <path d={SHIELD} fill="none" stroke={PALETTE.edgeMid} strokeWidth="26" opacity="0.1" />
                <path d={SHIELD} fill="none" stroke={PALETTE.edgeMid} strokeWidth="13" opacity="0.17" />
                <path d={SHIELD} fill="none" stroke="#7dfbe6" strokeWidth="6" opacity="0.34" />
                {/* rim band + glowing cyan edge */}
                <path d={SHIELD} fill={`url(#${id("band")})`} stroke={`url(#${id("edge")})`} strokeWidth="3.5" />
                {/* inner dark glass, inset from the rim, with a subtle inner border */}
                <g transform={`translate(${CENTER.x} ${CENTER.y}) scale(0.918 0.926) translate(${-CENTER.x} ${-CENTER.y})`}>
                  <path d={SHIELD} fill={`url(#${id("shell")})`} stroke="#041418" strokeWidth="1.5" strokeOpacity="0.8" />
                  <path d={SHIELD} fill={`url(#${id("glass")})`} />
                  <path d={SHIELD} fill={`url(#${id("floor")})`} />
                  <path d={SHIELD} fill="none" stroke={PALETTE.edgeMid} strokeWidth="1.2" strokeOpacity="0.3" />
                </g>
                <g clipPath={`url(#${id("shellClip")})`}>
                  <path d={SHIELD} fill="none" stroke="#bafde8" strokeWidth="2.5" opacity="0.18" transform="translate(0 1.5)" />
                </g>
                <MG t={rig.specT}>
                  <path d={SPEC} fill={`url(#${id("spec")})`} />
                </MG>
                <path d={RIM} fill="none" stroke={`url(#${id("rim")})`} strokeWidth="9" strokeLinecap="round" opacity="0.25" />
                <path d={RIM} fill="none" stroke={`url(#${id("rim")})`} strokeWidth="2.6" strokeLinecap="round" />

                {/* ---------------- face ---------------- */}
                <MG t={rig.faceT}>
                  {/* frame line: glow under-stroke + crisp line */}
                  <MG t={rig.frameT}>
                    <path d={FRAME} fill="none" stroke={PALETTE.line} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity="0.16" />
                    <path d={FRAME} fill="none" stroke={PALETTE.line} strokeWidth={LINE_W} strokeLinecap="round" strokeLinejoin="round" />
                  </MG>
                  {/* mouth opening (under the stroke so the line stays the outline) */}
                  <MEllipse cx={rig.ellCx} cy={rig.ellCy} rx={rig.ellRx} ry={rig.ellRy} fill={PALETTE.mouthDark} />
                  <MPath d={rig.mouthD} stroke={PALETTE.line} strokeWidth={18} opacity={0.16} />
                  <MPath d={rig.mouthD} stroke={PALETTE.line} strokeWidth={LINE_W} />

                  {/* eyes */}
                  {(["L", "R"] as const).map((side) => {
                    const c = EYE_C[side];
                    const x = side === "L" ? EYE.xL : EYE.xR;
                    const t = side === "L" ? rig.eyeLT : rig.eyeRT;
                    const lt = side === "L" ? rig.lidLT : rig.lidRT;
                    const clip = side === "L" ? id("eyeLClip") : id("eyeRClip");
                    return (
                      <g key={side}>
                        <MG t={t}>
                          <MG o={rig.capsuleO}>
                            <ellipse cx={c.x} cy={c.y} rx="30" ry="48" fill={`url(#${id("eyeglow")})`} />
                            <rect x={x} y={EYE.y} width={EYE.w} height={EYE.h} rx={EYE.rx} fill={PALETTE.eye} />
                            <rect x={x + 5} y={EYE.y + 6} width="6" height="18" rx="3" fill="#ffffff" opacity="0.35" />
                            <g clipPath={`url(#${clip})`}>
                              <MG t={lt}>
                                <rect x={x - 12} y={EYE.y} width={EYE.w + 24} height={EYE.h} fill={PALETTE.lid} />
                                <rect x={x - 12} y={EYE.y + EYE.h - 2.5} width={EYE.w + 24} height="2.5" fill={PALETTE.line} opacity="0.55" />
                              </MG>
                            </g>
                          </MG>
                        </MG>
                        <MG o={rig.arc}>
                          <path d={side === "L" ? ARC_L : ARC_R} fill="none" stroke={PALETTE.line} strokeWidth="16" strokeLinecap="round" opacity="0.18" />
                          <path d={side === "L" ? ARC_L : ARC_R} fill="none" stroke={PALETTE.eye} strokeWidth="8" strokeLinecap="round" />
                        </MG>
                      </g>
                    );
                  })}

                  {/* blush */}
                  <MG o={rig.blush}>
                    <ellipse cx="116" cy="196" rx="16" ry="8" fill={PALETTE.blush} opacity="0.5" />
                    <ellipse cx="204" cy="196" rx="16" ry="8" fill={PALETTE.blush} opacity="0.5" />
                  </MG>
                </MG>
              </g>

              {/* ---------------- fx ---------------- */}
              <g>
                {/* sweat */}
                {([rig.dropL, rig.dropR] as const).map((d, i) => (
                  <MG key={i} t={d.t} o={d.o}>
                    <path d={DROP} fill={PALETTE.sweat} opacity="0.9" />
                    <ellipse cx="-2" cy="12" rx="1.6" ry="3.2" fill="#ffffff" opacity="0.7" />
                  </MG>
                ))}
                {/* thought dots */}
                {rig.dotT.map((t, i) => (
                  <MG key={i} t={t}>
                    <circle r="9" fill={PALETTE.line} opacity="0.18" />
                    <circle r="5" fill={PALETTE.line} />
                  </MG>
                ))}
                {/* speed lines (laugh bounce / celebrate ascent) */}
                <MG t={rig.linesT} o={rig.lines}>
                  {[0, 1, 2].map((i) => (
                    <path
                      key={i}
                      d={`M${54 - i * 6} ${118 + i * 30} q-6 14 0 28`}
                      fill="none"
                      stroke={PALETTE.line}
                      strokeWidth="4"
                      strokeLinecap="round"
                      opacity={0.7 - i * 0.15}
                    />
                  ))}
                </MG>
                {/* sparkles */}
                {rig.sparkles.map((sp, i) => (
                  <MG key={i} t={sp.t} o={sp.o}>
                    <path
                      d={STAR}
                      fill={i % 3 === 0 ? PALETTE.eyYellow : i % 3 === 1 ? PALETTE.eye : "#ffffff"}
                    />
                  </MG>
                ))}
              </g>
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default Broqui;
