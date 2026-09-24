/**
 * Placement geometry for the projector mascot (pure, no DOM, no React).
 *
 * Everything is expressed in FRAME coordinates (the 16:9 board, origin at its
 * top-left) so the maths is the same on the real projector, in the /lab iframe
 * and on a letterboxed laptop. The host converts DOM rects once per step.
 *
 *  - Mascot pose = bottom-centre point + scale (Broqui's box is W×H; the
 *    visible shield is the inner BODY fraction of that box).
 *  - Anchors are layout-reserved rects; the mascot stands bottom-centred in
 *    them and an anchor is VALID only when the body rect clears every keep-out.
 *  - The bubble tries candidate sides in the anchor's preferred order and takes
 *    the first one that fits inside the frame and clears every keep-out.
 *  - Travel paths are quadratic arcs (or an edge route) scored by how many
 *    sampled poses would cross a keep-out — the least offending, shortest wins.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Broqui box aspect (viewBox 320×340). */
export const BOX_ASPECT = 320 / 340;
/** Shield body inside the box (x 72..248 of 320, y 40..260 of 340). */
export const BODY = { x0: 0.225, x1: 0.775, y0: 0.118, y1: 0.765 } as const;
/** Mouth point inside the box (tail target). */
export const MOUTH = { x: 0.5, y: 0.55 } as const;
/** Eye line inside the box (used to aim look-at). */
export const EYES = { x: 0.5, y: 0.4 } as const;

export const KEEPOUT_MARGIN = 6;
export const BUBBLE_GAP = 14;
export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export const SAFE_INSET: Inset = { top: 12, right: 16, bottom: 12, left: 16 };

export interface Pose {
  /** Bottom-centre x. */
  cx: number;
  /** Bottom y. */
  by: number;
  scale: number;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export function intersects(a: Rect, b: Rect, margin = 0): boolean {
  return (
    a.x < b.x + b.w + margin &&
    a.x + a.w + margin > b.x &&
    a.y < b.y + b.h + margin &&
    a.y + a.h + margin > b.y
  );
}

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function inside(inner: Rect, outer: Rect, inset: Inset = SAFE_INSET): boolean {
  return (
    inner.x >= outer.x + inset.left &&
    inner.y >= outer.y + inset.top &&
    inner.x + inner.w <= outer.x + outer.w - inset.right &&
    inner.y + inner.h <= outer.y + outer.h - inset.bottom
  );
}

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Broqui's rendered box for a pose (base size = height in px at scale 1). */
export function boxOf(pose: Pose, baseSize: number): Rect {
  const h = baseSize * pose.scale;
  const w = h * BOX_ASPECT;
  return rect(pose.cx - w / 2, pose.by - h, w, h);
}

/** Visible shield body rect (what must never cover anything). */
export function bodyOf(pose: Pose, baseSize: number): Rect {
  const b = boxOf(pose, baseSize);
  return rect(b.x + b.w * BODY.x0, b.y + b.h * BODY.y0, b.w * (BODY.x1 - BODY.x0), b.h * (BODY.y1 - BODY.y0));
}

export function mouthOf(pose: Pose, baseSize: number): Point {
  const b = boxOf(pose, baseSize);
  return { x: b.x + b.w * MOUTH.x, y: b.y + b.h * MOUTH.y };
}

export function eyesOf(pose: Pose, baseSize: number): Point {
  const b = boxOf(pose, baseSize);
  return { x: b.x + b.w * EYES.x, y: b.y + b.h * EYES.y };
}

export function bodyClear(pose: Pose, baseSize: number, keepouts: readonly Rect[], frame: Rect): boolean {
  const body = bodyOf(pose, baseSize);
  if (!inside(body, frame, { top: 0, right: 0, bottom: -2, left: 0 })) return false;
  return keepouts.every((k) => !intersects(body, k, KEEPOUT_MARGIN));
}

/* ------------------------------------------------------------------ anchors */

export type BubbleSide = "left" | "right" | "above-left" | "above-right" | "above" | "below";
export type Edge = "left" | "right" | "bottom" | "top";

export interface AnchorSpec {
  id: string;
  rect: Rect;
  /** Mascot height at 1080p (default 200). */
  size: number;
  /** Bubble side preference (first that fits wins; falls back to all). */
  bubble: readonly BubbleSide[];
  /** Bubble max width as a fraction of the frame width. */
  bubbleMax: number;
  /** Nearest screen edge (enter / exit / peek). */
  edge: Edge;
  /** Vertical placement inside the anchor. */
  align: "bottom" | "center";
}

/** Bottom-centred pose inside an anchor rect (never taller than the anchor). */
export function poseForAnchor(anchor: AnchorSpec, baseSize: number, k: number): Pose {
  const wanted = anchor.size * k;
  const fit = Math.min(wanted, anchor.rect.h * 0.96, (anchor.rect.w / BOX_ASPECT) * 0.98);
  const scale = Math.max(0.35, fit / baseSize);
  const h = baseSize * scale;
  const cx = anchor.rect.x + anchor.rect.w / 2;
  const by =
    anchor.align === "center"
      ? anchor.rect.y + anchor.rect.h / 2 + h / 2
      : anchor.rect.y + anchor.rect.h - anchor.rect.h * 0.03;
  return { cx, by, scale };
}

export function nearestEdge(p: Point, frame: Rect): Edge {
  const dl = p.x - frame.x;
  const dr = frame.x + frame.w - p.x;
  const dt = p.y - frame.y;
  const db = frame.y + frame.h - p.y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return "left";
  if (m === dr) return "right";
  if (m === db) return "bottom";
  return "top";
}

/* ------------------------------------------------------------------ bubble */

export interface BubblePlacement {
  side: BubbleSide;
  rect: Rect;
  /** Tail base position along the facing edge (px from the bubble's top-left). */
  tail: Point;
  /** Where the tail points (the mascot's mouth), frame coords. */
  target: Point;
  clear: boolean;
}

export const BUBBLE_ORDER: readonly BubbleSide[] = ["above-left", "above-right", "left", "right", "above", "below"];

/**
 * Place a bubble of `size` around the mascot `pose`. Returns the first
 * candidate (anchor preference first, then the canonical order) that is inside
 * the frame and clears every keep-out; otherwise the least-overlapping one
 * flagged `clear: false`.
 */
export function placeBubble(
  size: { w: number; h: number },
  pose: Pose,
  baseSize: number,
  keepouts: readonly Rect[],
  frame: Rect,
  prefer: readonly BubbleSide[] = [],
  tailLen = 18,
): BubblePlacement {
  const body = bodyOf(pose, baseSize);
  const mouth = mouthOf(pose, baseSize);
  const gap = BUBBLE_GAP + tailLen;
  const { w, h } = size;
  const clampX = (x: number) => Math.min(frame.x + frame.w - SAFE_INSET.right - w, Math.max(frame.x + SAFE_INSET.left, x));
  const clampY = (y: number) => Math.min(frame.y + frame.h - SAFE_INSET.bottom - h, Math.max(frame.y + SAFE_INSET.top, y));

  const candidate = (side: BubbleSide): Rect => {
    switch (side) {
      case "left":
        return rect(body.x - gap - w, clampY(mouth.y - h * 0.72), w, h);
      case "right":
        return rect(body.x + body.w + gap, clampY(mouth.y - h * 0.72), w, h);
      case "above-left":
        return rect(clampX(body.x + body.w * 0.55 - w), body.y - gap - h, w, h);
      case "above-right":
        return rect(clampX(body.x + body.w * 0.45), body.y - gap - h, w, h);
      case "above":
        return rect(clampX(body.x + body.w / 2 - w / 2), body.y - gap - h, w, h);
      case "below":
        return rect(clampX(body.x + body.w / 2 - w / 2), body.y + body.h + gap, w, h);
    }
  };

  const order = [...prefer, ...BUBBLE_ORDER.filter((s) => !prefer.includes(s))];
  const acc: { best: BubblePlacement | null; score: number } = { best: null, score: Infinity };
  const evaluate = (side: BubbleSide, r: Rect): BubblePlacement => {
    const inFrame = inside(r, frame);
    const overlap = keepouts.reduce((s, k) => s + overlapArea(r, k), 0) + overlapArea(r, body) * 4;
    const clear = inFrame && overlap === 0;
    const tail = tailFor(side, r, mouth);
    const placement: BubblePlacement = { side, rect: r, tail, target: mouth, clear };
    const score = overlap + (inFrame ? 0 : 1e6);
    if (score < acc.score) {
      acc.score = score;
      acc.best = placement;
    }
    return placement;
  };
  // Pass 1: every side at its natural position.
  for (const side of order) {
    const p = evaluate(side, candidate(side));
    if (p.clear) return p;
  }
  // Pass 2: slide the "above" / side candidates upwards (a tighter margin,
  // e.g. the podium) until they clear the keep-outs — up to ~35 % of the frame.
  const step = frame.h * 0.05;
  for (let i = 1; i <= 7; i++) {
    for (const side of order) {
      if (side === "below") continue;
      const r0 = candidate(side);
      const r = rect(r0.x, r0.y - step * i, r0.w, r0.h);
      const p = evaluate(side, r);
      if (p.clear) return p;
    }
  }
  return acc.best as BubblePlacement;
}

function tailFor(side: BubbleSide, r: Rect, mouth: Point): Point {
  const pad = 26;
  switch (side) {
    case "left":
      return { x: r.w, y: Math.min(r.h - pad, Math.max(pad, mouth.y - r.y - 6)) };
    case "right":
      return { x: 0, y: Math.min(r.h - pad, Math.max(pad, mouth.y - r.y - 6)) };
    case "below":
      return { x: Math.min(r.w - pad, Math.max(pad, mouth.x - r.x)), y: 0 };
    default:
      return { x: Math.min(r.w - pad, Math.max(pad, mouth.x - r.x)), y: r.h };
  }
}

/* ------------------------------------------------------------------ travel */

export interface TravelPath {
  kind: "arc" | "edge";
  /** Sample the path at t ∈ [0,1] (bottom-centre point). */
  at(t: number): Point;
  length: number;
  /** Number of sampled poses crossing a keep-out (0 = clean). */
  crossings: number;
}

function quad(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function polyline(points: Point[]): (t: number) => Point {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = dist(points[i - 1], points[i]);
    seg.push(d);
    total += d;
  }
  return (t: number) => {
    let d = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const f = seg[i] === 0 ? 0 : Math.min(1, d / seg[i]);
        const a = points[i];
        const b = points[i + 1];
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
      d -= seg[i];
    }
    return points[points.length - 1];
  };
}

/**
 * Choose a travel path from → to that avoids keep-outs when possible: arcs
 * bulging up/down at two amplitudes, plus an edge route hugging the frame's
 * top or bottom margin. Least crossings wins, then shortest.
 */
export function planTravel(
  from: Pose,
  to: Pose,
  baseSize: number,
  keepouts: readonly Rect[],
  frame: Rect,
): TravelPath {
  const p0 = { x: from.cx, y: from.by };
  const p2 = { x: to.cx, y: to.by };
  const d = dist(p0, p2);
  const mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  const candidates: { kind: "arc" | "edge"; at: (t: number) => Point }[] = [];
  for (const amp of [0.18, 0.36, -0.18, -0.36]) {
    const p1 = { x: mid.x, y: mid.y - amp * d };
    candidates.push({ kind: "arc", at: (t) => quad(p0, p1, p2, t) });
  }
  // Edge routes: climb to the margin band, cross, descend.
  const hTop = baseSize * to.scale;
  const topY = frame.y + hTop * 0.95 + 8;
  const bottomY = frame.y + frame.h - 6;
  candidates.push({ kind: "edge", at: polyline([p0, { x: p0.x, y: topY }, { x: p2.x, y: topY }, p2]) });
  candidates.push({ kind: "edge", at: polyline([p0, { x: p0.x, y: bottomY }, { x: p2.x, y: bottomY }, p2]) });

  let best: TravelPath | null = null;
  for (const c of candidates) {
    let crossings = 0;
    let length = 0;
    let prev = c.at(0);
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = c.at(t);
      length += dist(prev, p);
      prev = p;
      const scale = from.scale + (to.scale - from.scale) * t;
      const body = bodyOf({ cx: p.x, by: p.y, scale }, baseSize);
      if (keepouts.some((k) => intersects(body, k, 0))) crossings++;
      if (!inside(body, frame, { top: -8, right: -8, bottom: -8, left: -8 })) crossings += 2;
    }
    const path: TravelPath = { kind: c.kind, at: c.at, length, crossings };
    if (
      !best ||
      crossings < best.crossings ||
      (crossings === best.crossings && length < best.length)
    ) {
      best = path;
    }
  }
  return best as TravelPath;
}

/** Travel duration (ms) for a path length in px at 1080p scale k. */
export function travelDuration(lengthPx: number, k: number): number {
  const d = lengthPx / Math.max(0.3, k);
  return Math.min(1100, Math.max(500, 420 + 0.55 * d));
}

/** Normalised look-at vector (−1..1) from the mascot eyes toward a frame point. */
export function lookVector(eyes: Point, target: Point, frame: Rect): Point {
  const dx = (target.x - eyes.x) / (frame.w * 0.45);
  const dy = (target.y - eyes.y) / (frame.h * 0.45);
  return { x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) };
}
