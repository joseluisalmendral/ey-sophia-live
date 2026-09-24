/**
 * Broqui — pose tables, geometry and palette (pure data, no React).
 *
 * Everything the rig animates is a continuous parameter listed in `Pose`, so a
 * switch between ANY two expressions is a spring blend of the same numbers
 * (no keyframe cut, no path re-parsing). The mouth is a fixed `M C C` command
 * template with 12 free numbers (`MouthTuple`), which guarantees a smooth
 * morph between every preset.
 *
 * Canvas: viewBox 0 0 320 340 · body centre C=(160,150) · bottom apex
 * P=(160,259). Motion spec: xp/06-motion-spec.md §A/§B.
 */

export const VIEW_W = 320;
export const VIEW_H = 340;
export const CENTER = { x: 160, y: 150 } as const;
export const APEX = { x: 160, y: 259 } as const;

/** Rendered stroke width of the mint line (viewBox units). */
export const LINE_W = 7;

/* ----------------------------------------------------------------------------
 * Palette — mirrors the `--color-broqui-*` tokens in globals.css. Hex is
 * inlined in the SVG defs so the character renders identically in any
 * embedding (lab, projector, phone, OG render).
 * ------------------------------------------------------------------------- */
export const PALETTE = {
  line: "#8ff5c8",
  eye: "#a8f7d3",
  rim: "#d8ff6b",
  eyYellow: "#ffe600",
  shellTop: "#1c6f70",
  shellMid: "#0f4a4f",
  shellDeep: "#082e33",
  edgeTop: "#a3fbdb",
  edgeMid: "#4fd6b8",
  edgeBottom: "#1b8e88",
  mouthDark: "#072a2e",
  lid: "#0d3d43",
  blush: "#ff7fa3",
  sweat: "#bff5ff",
  bloomCore: "#5ff2c4",
  bloomMid: "#3fd9b3",
  bloomOuter: "#1fa393",
} as const;

/* ----------------------------------------------------------------------------
 * Geometry
 * ------------------------------------------------------------------------- */

/** Shield silhouette (thePower isotype proportions, 176×220, ratio 0.80). */
export const SHIELD =
  "M88 40 H232 Q248 40 248 56 V160 C248 212 208 244 166 258 Q160 260 154 258 C112 244 72 212 72 160 V56 Q72 40 88 40 Z";

/** Static part of the inner mint line: top-right tick, top edge, left side. */
export const FRAME = "M224 110 V78 Q224 64 210 64 H110 Q96 64 96 78 V160";

/** Specular wedge (top-left) and the top-right rim-light arc. */
export const SPEC = "M92 52 Q160 42 176 60 Q120 66 96 96 Z";
export const RIM = "M168 44 Q244 46 246 128";

/** Happy crescents ("^ ^") — cross-faded over the capsule eyes. */
export const ARC_L = "M119 157 Q132 131 145 157";
export const ARC_R = "M175 157 Q188 131 201 157";

/** Sweat drop (22 tall, tip at the origin) + spawn points. */
export const DROP = "M0 0 C-7 10 -8 16 0 22 C8 16 7 10 0 0 Z";
export const DROP_SPAWN = { L: { x: 74, y: 96 }, R: { x: 246, y: 96 } } as const;

/** Four-point star used by the celebration burst. */
export const STAR =
  "M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10 Z";

/** Sparkle slots on a ring r=150 around C (angle in degrees, 0 = right). */
export const SPARKLE_ANGLES = [-112, -74, -36, 8, 196, 236] as const;

/** "…" thought dots (thinking), drawn outside the top-right shoulder. */
export const ELLIPSIS = [
  { x: 250, y: 96 },
  { x: 266, y: 82 },
  { x: 282, y: 66 },
] as const;

/** Eye capsules: 22×52, rx 11 (reference proportion). Centres (132,150) / (188,150). */
export const EYE = { w: 22, h: 52, rx: 11, y: 124, xL: 121, xR: 177 } as const;
export const EYE_C = { L: { x: 132, y: 150 }, R: { x: 188, y: 150 } } as const;

/** Lid fully hidden above the eye. */
export const LID_HIDDEN = -EYE.h;

/* ----------------------------------------------------------------------------
 * Mouth — fixed command template, 12 free numbers.
 *   M96 160 C p0 p1 p2 p3 p4 p5 C p6 p7 p8 p9 p10 p11
 * The first cubic ends at the apex (p4,p5); the second ends at the tick tip
 * (p10,p11). `mouthPath()` output ALWAYS starts with "M96 160 C".
 * ------------------------------------------------------------------------- */
export type MouthTuple = readonly [
  number, number, number, number, number, number,
  number, number, number, number, number, number,
];

export const MOUTH_START = "M96 160 C";

export function mouthPath(t: ArrayLike<number>): string {
  // Fixed-point formatting keeps the attribute short and stable per frame.
  const n = (i: number) => (Math.round(t[i] * 10) / 10).toString();
  return `${MOUTH_START}${n(0)} ${n(1)} ${n(2)} ${n(3)} ${n(4)} ${n(5)} C${n(6)} ${n(7)} ${n(8)} ${n(9)} ${n(10)} ${n(11)}`;
}

export const MOUTHS = {
  /* reference look */
  smile: [96, 200, 120, 228, 156, 240, 162, 242, 176, 232, 190, 220],
  /* apex right, tick lifts */
  smug: [96, 196, 118, 214, 150, 224, 168, 232, 190, 218, 204, 196],
  /* wide, + mouthOpen */
  laugh: [96, 206, 122, 238, 158, 248, 168, 250, 182, 238, 194, 222],
  /* small "o", + mouthOpen tall */
  surprised: [96, 202, 124, 228, 154, 234, 160, 236, 176, 232, 188, 226],
  /* wavy: apex up, tick down */
  worried: [96, 198, 120, 222, 150, 216, 164, 212, 176, 234, 190, 224],
  /* deadpan / thinking */
  flat: [96, 200, 124, 226, 156, 228, 168, 228, 180, 228, 192, 228],
  /* defeated: tick droops */
  frown: [96, 204, 128, 238, 154, 246, 168, 250, 182, 244, 188, 250],
} as const satisfies Record<string, MouthTuple>;

export type MouthName = keyof typeof MOUTHS;

/* ----------------------------------------------------------------------------
 * Expressions
 * ------------------------------------------------------------------------- */
export const EXPRESSIONS = [
  "idle",
  "blink",
  "lookAt",
  "nervous",
  "smug",
  "surprised",
  "laughing",
  "thinking",
  "celebrating",
  "sad",
  "peek",
  "talking",
  "squeeze",
] as const;

export type Expression = (typeof EXPRESSIONS)[number];

/** Human labels for galleries / admin (Spanish, Spain). */
export const EXPRESSION_LABELS: Record<Expression, string> = {
  idle: "Idle",
  blink: "Parpadeo",
  lookAt: "Mirada",
  nervous: "Nervioso",
  smug: "Cara dura",
  surprised: "Sorpresa",
  laughing: "Risa",
  thinking: "Pensando",
  celebrating: "Celebrando",
  sad: "Derrotado",
  peek: "Asomándose",
  talking: "Hablando",
  squeeze: "No puedo mirar",
};

export interface Pose {
  mouth: MouthName;
  /** 0..1 — how far the dark mouth ellipse opens above the line. */
  open: number;
  openRx: number;
  openRy: number;
  /** Eye capsule scale + tilt (deg, + = clockwise) per side. */
  eyeL: { sx: number; sy: number; rot: number };
  eyeR: { sx: number; sy: number; rot: number };
  /** Both eyes shift (viewBox units) — e.g. "up 4" for surprised. */
  eyeY: number;
  /** Lid translateY: -52 hidden … -24 almost closed (fraction of eye height). */
  lidL: number;
  lidR: number;
  /** Lid slant in degrees (smug). */
  lidRot: number;
  /** 0..1 cross-fade from capsules to "^ ^" crescents. */
  arc: number;
  /** Whole face offset (viewBox units), additive to look-at. */
  face: { x: number; y: number };
  /** Body (squash tier): tilt deg, scale, vertical sink (px @ size 200). */
  body: { rot: number; sx: number; sy: number; y: number };
  blush: number;
  /** Glow opacity multiplier. */
  bloom: number;
  /** Float amplitude multiplier (life layer). */
  floatAmp: number;
  sweat: "off" | "once" | "loop";
  ellipsis: boolean;
  /** 0 none · 1 nervous micro-jitter · 2 tremble. */
  jitter: 0 | 1 | 2;
  /** Eye darts (nervous). */
  darts: boolean;
  /** Blink interval multiplier (0 disables). */
  blinkRate: number;
  /** Blink duration multiplier (sad = slow). */
  blinkSlow: number;
  /** Ambient glance behaviour when no lookAt is driven. */
  glance: "normal" | "active" | "none";
  /** Force the talk cycle (talking expression). */
  talk: boolean;
}

const EYE_OPEN = { sx: 1, sy: 1, rot: 0 } as const;

const BASE: Pose = {
  mouth: "smile",
  open: 0,
  openRx: 14,
  openRy: 10,
  eyeL: EYE_OPEN,
  eyeR: EYE_OPEN,
  eyeY: 0,
  lidL: LID_HIDDEN,
  lidR: LID_HIDDEN,
  lidRot: 0,
  arc: 0,
  face: { x: 0, y: 0 },
  body: { rot: 0, sx: 1, sy: 1, y: 0 },
  blush: 0,
  bloom: 1,
  floatAmp: 1,
  sweat: "off",
  ellipsis: false,
  jitter: 0,
  darts: false,
  blinkRate: 1,
  blinkSlow: 1,
  glance: "normal",
  talk: false,
};

function pose(p: Partial<Pose>): Pose {
  return { ...BASE, ...p };
}

export const POSES: Record<Expression, Pose> = {
  idle: pose({}),

  blink: pose({ blinkRate: 0.35 }),

  lookAt: pose({ glance: "active" }),

  nervous: pose({
    mouth: "worried",
    eyeL: { sx: 1, sy: 0.9, rot: 0 },
    eyeR: { sx: 1, sy: 0.9, rot: 0 },
    lidL: -44,
    lidR: -44,
    body: { rot: -1.5, sx: 0.98, sy: 1, y: 0 },
    sweat: "loop",
    jitter: 1,
    darts: true,
    blinkRate: 0.5,
    glance: "none",
  }),

  smug: pose({
    mouth: "smug",
    eyeL: { sx: 1, sy: 1, rot: 0 },
    eyeR: { sx: 1, sy: 0.85, rot: 0 },
    lidL: -28,
    lidR: -36,
    lidRot: -8,
    face: { x: -3, y: -1 },
    body: { rot: 0, sx: 1, sy: 1.01, y: 0 },
    blush: 0.35,
    glance: "none",
  }),

  surprised: pose({
    mouth: "surprised",
    open: 1,
    openRx: 10,
    openRy: 16,
    eyeL: { sx: 1.12, sy: 1.22, rot: 0 },
    eyeR: { sx: 1.12, sy: 1.22, rot: 0 },
    eyeY: -4,
    bloom: 1.1,
    blinkRate: 1.6,
    glance: "none",
  }),

  laughing: pose({
    mouth: "laugh",
    open: 0.75,
    openRx: 14,
    openRy: 14,
    arc: 1,
    blush: 0.5,
    blinkRate: 0,
    glance: "none",
  }),

  thinking: pose({
    mouth: "flat",
    eyeL: { sx: 1, sy: 1, rot: 0 },
    eyeR: { sx: 1, sy: 0.85, rot: 0 },
    lidL: -32,
    lidR: -32,
    face: { x: 6, y: -6 },
    body: { rot: -3, sx: 1, sy: 1, y: 0 },
    ellipsis: true,
    glance: "none",
  }),

  celebrating: pose({
    mouth: "laugh",
    open: 0.7,
    openRx: 14,
    openRy: 14,
    arc: 1,
    blush: 0.45,
    bloom: 1.15,
    blinkRate: 0,
    glance: "none",
  }),

  sad: pose({
    mouth: "frown",
    eyeL: { sx: 1, sy: 0.8, rot: 7 },
    eyeR: { sx: 1, sy: 0.8, rot: -7 },
    eyeY: 4,
    lidL: -24,
    lidR: -24,
    face: { x: 0, y: 6 },
    body: { rot: 4, sx: 1, sy: 0.985, y: 6 },
    bloom: 0.6,
    floatAmp: 0.5,
    sweat: "once",
    blinkSlow: 1.7,
    glance: "none",
  }),

  peek: pose({
    eyeL: { sx: 1.05, sy: 1.08, rot: 0 },
    eyeR: { sx: 1.05, sy: 1.08, rot: 0 },
    blush: 0.2,
    glance: "none",
  }),

  talking: pose({ talk: true, glance: "none" }),

  squeeze: pose({
    mouth: "worried",
    eyeL: { sx: 1.1, sy: 0.12, rot: 8 },
    eyeR: { sx: 1.1, sy: 0.12, rot: -8 },
    body: { rot: 0, sx: 1.04, sy: 0.96, y: 2 },
    jitter: 2,
    blinkRate: 0,
    glance: "none",
  }),
};

/** Blend durations between poses (ms) — motion spec §B "transition matrix". */
export function blendMs(from: Expression, to: Expression): number {
  if (from === "nervous" && to === "surprised") return 90;
  if (to === "celebrating") return 120;
  if (from === "laughing" && to === "smug") return 500;
  if (to === "idle") return 450;
  if (to === "nervous") return 260;
  if (to === "sad") return 600;
  return 320;
}
