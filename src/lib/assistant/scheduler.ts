/**
 * Scheduler — decides WHEN Broqui speaks. Pure TS state machine driven by
 * `tick(now)`; the host executes the returned decision (pick a line, open the
 * bubble) and reports bubble start/end back.
 *
 * Rules (xp/05 §4.8 + product owner):
 *  - Ambient: after a bubble ends, the next ambient line lands at U[min,max] s
 *    (config, defaults 14/28; validated 6 ≤ min, max ≤ 120, max ≥ min + 2;
 *    hard floor 6 s enforced here even if the data is wrong). First line
 *    ~4 s after mount.
 *  - Events replace the pending ambient timer. If a bubble is showing, an
 *    event with prio ≥ 90 cuts it after ≥ 1.2 s on screen; otherwise the event
 *    waits (and is dropped when > 6 s stale). Per-type cooldowns; once-per-run
 *    types fire once. Min 4 s gap between any two bubbles.
 *  - `busy` (mascot travelling / hidden) postpones everything without losing
 *    the queue. `silent` (no ambient category) suspends ambient only.
 */

import {
  EVENT_COOLDOWN_MS,
  EVENT_PRIORITY,
  type AssistantEvent,
  type AssistantEventType,
} from "./detectEvents";
import { uniform, type Rng } from "./rng";

export interface IntervalConfig {
  min: number;
  max: number;
}

export const INTERVAL_DEFAULTS: IntervalConfig = { min: 14, max: 28 };
export const INTERVAL_FLOOR_S = 6;
export const INTERVAL_CEIL_S = 120;
export const INTERVAL_MIN_SPREAD_S = 2;

export const FIRST_LINE_DELAY_MS = 4000;
export const MIN_GAP_MS = 4000;
export const CUT_AFTER_MS = 1200;
export const CUT_GAP_MS = 800;
export const STALE_EVENT_MS = 6000;
export const CUT_PRIORITY = 90;

/**
 * Validate an interval pair the way the admin form does (Spanish messages).
 * Returns null when valid.
 */
export function validateInterval(cfg: Partial<IntervalConfig>): string | null {
  const { min, max } = cfg;
  if (!Number.isFinite(min) || !Number.isInteger(min) || (min as number) < INTERVAL_FLOOR_S || (min as number) > INTERVAL_CEIL_S) {
    return `El mínimo debe estar entre ${INTERVAL_FLOOR_S} y ${INTERVAL_CEIL_S} s.`;
  }
  if (!Number.isFinite(max) || !Number.isInteger(max) || (max as number) < INTERVAL_FLOOR_S + INTERVAL_MIN_SPREAD_S || (max as number) > INTERVAL_CEIL_S) {
    return `El máximo debe estar entre ${INTERVAL_FLOOR_S + INTERVAL_MIN_SPREAD_S} y ${INTERVAL_CEIL_S} s.`;
  }
  if ((max as number) < (min as number) + INTERVAL_MIN_SPREAD_S) {
    return `El máximo debe superar al mínimo en al menos ${INTERVAL_MIN_SPREAD_S} s.`;
  }
  return null;
}

/**
 * Coerce ANY input into a safe interval: floor 6 s, ceiling 120 s, max ≥ min+2.
 * Non-numbers fall back to the defaults. This is the last line of defence
 * when the DB row is wrong.
 */
export function sanitizeInterval(cfg?: Partial<IntervalConfig> | null): IntervalConfig {
  const rawMin = Number(cfg?.min);
  const rawMax = Number(cfg?.max);
  let min = Number.isFinite(rawMin) ? rawMin : INTERVAL_DEFAULTS.min;
  let max = Number.isFinite(rawMax) ? rawMax : INTERVAL_DEFAULTS.max;
  min = Math.min(INTERVAL_CEIL_S - INTERVAL_MIN_SPREAD_S, Math.max(INTERVAL_FLOOR_S, min));
  max = Math.min(INTERVAL_CEIL_S, Math.max(min + INTERVAL_MIN_SPREAD_S, max));
  return { min, max };
}

export type SchedulerDecision =
  | { kind: "ambient"; at: number }
  | { kind: "event"; event: AssistantEvent; at: number }
  /** Cut the open bubble now; the event is re-offered on the next tick. */
  | { kind: "cut"; event: AssistantEvent; at: number };

export interface TickOptions {
  /** Mascot travelling / hidden / entering: nothing may open. */
  busy?: boolean;
  /** No ambient category on this stage (reveal, count-in): ambient suspended. */
  silent?: boolean;
}

export interface SchedulerSnapshot {
  nextAmbientAt: number | null;
  queued: AssistantEventType[];
  bubbleOpen: boolean;
  lastBubbleEndAt: number | null;
}

export class Scheduler {
  private cfg: IntervalConfig;
  private rng: Rng;
  private nextAmbientAt: number | null;
  private queue: AssistantEvent[] = [];
  private lastFiredAt = new Map<AssistantEventType, number>();
  private firedOnce = new Set<AssistantEventType>();
  private bubbleOpenAt: number | null = null;
  private lastBubbleEndAt: number | null = null;
  private cutRequested = false;

  constructor(cfg: Partial<IntervalConfig> | null | undefined, rng: Rng, now: number) {
    this.cfg = sanitizeInterval(cfg);
    this.rng = rng;
    this.nextAmbientAt = now + FIRST_LINE_DELAY_MS;
  }

  get config(): IntervalConfig {
    return this.cfg;
  }

  setConfig(cfg: Partial<IntervalConfig> | null | undefined, now: number): void {
    const next = sanitizeInterval(cfg);
    if (next.min === this.cfg.min && next.max === this.cfg.max) return;
    this.cfg = next;
    // Re-plan the pending ambient with the new window, keeping it in the future.
    if (this.nextAmbientAt !== null && this.bubbleOpenAt === null) {
      this.nextAmbientAt = Math.max(now + 500, this.planAmbient(this.lastBubbleEndAt ?? now));
    }
  }

  /** Sample the ambient delay (ms) in [min, max] s. */
  private planAmbient(from: number): number {
    return from + uniform(this.rng, this.cfg.min, this.cfg.max) * 1000;
  }

  /** Offer detector events; cooldowns/once flags decide admission. */
  push(events: readonly AssistantEvent[]): void {
    for (const ev of events) {
      const cooldown = EVENT_COOLDOWN_MS[ev.type];
      if (cooldown === null && this.firedOnce.has(ev.type)) continue;
      const last = this.lastFiredAt.get(ev.type);
      if (cooldown !== null && last !== undefined && ev.at - last < cooldown) continue;
      // One pending per type: the newest wins.
      this.queue = this.queue.filter((q) => q.type !== ev.type);
      this.queue.push(ev);
    }
    if (this.queue.length) {
      // An event replaces the pending ambient timer.
      this.nextAmbientAt = null;
    }
  }

  /** Forget a queued event type (e.g. the stage changed and it no longer applies). */
  drop(type: AssistantEventType): void {
    this.queue = this.queue.filter((q) => q.type !== type);
  }

  onBubbleStart(now: number, decision: SchedulerDecision): void {
    this.bubbleOpenAt = now;
    this.cutRequested = false;
    this.nextAmbientAt = null;
    if (decision.kind === "event") {
      const { type } = decision.event;
      this.lastFiredAt.set(type, now);
      if (EVENT_COOLDOWN_MS[type] === null) this.firedOnce.add(type);
      this.queue = this.queue.filter((q) => q.type !== type);
    }
  }

  /**
   * The open bubble was cut for a high-priority event: no ambient re-plan and
   * only a short beat (~450 ms) before the event opens, instead of the 4 s gap.
   */
  onBubbleCut(now: number): void {
    this.bubbleOpenAt = null;
    this.cutRequested = false;
    this.lastBubbleEndAt = now - MIN_GAP_MS + 450;
    this.nextAmbientAt = null;
  }

  onBubbleEnd(now: number): void {
    this.bubbleOpenAt = null;
    this.lastBubbleEndAt = now;
    this.cutRequested = false;
    this.nextAmbientAt = this.planAmbient(now);
  }

  /** A decision could not produce a line: settle it so it does not loop. */
  skip(now: number, decision: SchedulerDecision): void {
    if (decision.kind === "event") {
      const { type } = decision.event;
      this.lastFiredAt.set(type, now);
      if (EVENT_COOLDOWN_MS[type] === null) this.firedOnce.add(type);
      this.queue = this.queue.filter((q) => q.type !== type);
    }
    if (this.bubbleOpenAt === null && this.nextAmbientAt !== null && now >= this.nextAmbientAt) {
      this.nextAmbientAt = this.planAmbient(now);
    }
  }

  /** Force the next ambient line as soon as the gap allows (lab "random line"). */
  requestAmbient(now: number): void {
    this.nextAmbientAt = now;
  }

  /** Restart the ambient clock (stage change: first line a few seconds in). */
  resetAmbient(now: number, delayMs = FIRST_LINE_DELAY_MS): void {
    if (this.bubbleOpenAt === null) this.nextAmbientAt = now + delayMs;
  }

  snapshot(): SchedulerSnapshot {
    return {
      nextAmbientAt: this.nextAmbientAt,
      queued: this.queue.map((q) => q.type),
      bubbleOpen: this.bubbleOpenAt !== null,
      lastBubbleEndAt: this.lastBubbleEndAt,
    };
  }

  /** Ms until the next planned bubble (ambient or queued event), or null. */
  timeToNext(now: number): number | null {
    if (this.queue.length) return 0;
    if (this.nextAmbientAt === null) return null;
    return Math.max(0, this.nextAmbientAt - now);
  }

  tick(now: number, opts: TickOptions = {}): SchedulerDecision | null {
    // Drop stale events (waited too long behind a bubble / travel).
    this.queue = this.queue.filter((q) => now - q.at <= STALE_EVENT_MS || EVENT_PRIORITY[q.type] >= CUT_PRIORITY);
    this.queue.sort((a, b) => EVENT_PRIORITY[b.type] - EVENT_PRIORITY[a.type] || a.at - b.at);
    const top = this.queue[0];

    if (this.bubbleOpenAt !== null) {
      if (
        top &&
        EVENT_PRIORITY[top.type] >= CUT_PRIORITY &&
        now - this.bubbleOpenAt >= CUT_AFTER_MS &&
        !this.cutRequested
      ) {
        this.cutRequested = true;
        return { kind: "cut", event: top, at: now };
      }
      return null;
    }

    if (opts.busy) return null;
    // Cut-class events (prio ≥ 90) may cut an open bubble, so they only need a
    // short beat after the previous one instead of the full 4 s gap.
    const gapMs = top && EVENT_PRIORITY[top.type] >= CUT_PRIORITY ? CUT_GAP_MS : MIN_GAP_MS;
    const gapOk = this.lastBubbleEndAt === null || now - this.lastBubbleEndAt >= gapMs;
    if (!gapOk) return null;

    if (top) return { kind: "event", event: top, at: now };
    if (opts.silent) return null;
    if (this.nextAmbientAt !== null && now >= this.nextAmbientAt) {
      return { kind: "ambient", at: now };
    }
    return null;
  }
}
