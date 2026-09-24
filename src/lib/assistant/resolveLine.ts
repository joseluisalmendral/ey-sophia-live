/**
 * Line resolver — placeholder fill + the two hard guards of the show:
 *
 *  1. ANONYMOUS: while identities are hidden, only `anonSafe` lines may be
 *     spoken and no NAME placeholder ({leader} {second} {last} {winner} {team})
 *     may appear, even by accident. Both checks run (flag AND regex).
 *  2. LENGTH: any expanded line longer than 90 characters is dropped (the
 *     bubble is 2 lines max, readable from 10 m).
 *
 * `pickLine` adds the no-repeat memory (last 8 ids per category) and the
 * weighted seeded pick, so the whole thing stays deterministic under /lab.
 */

import type { Line, LineCategory } from "./lines.es";
import { weightedPick, type Rng } from "./rng";

export const MAX_LINE_CHARS = 90;
export const NO_REPEAT_MEMORY = 8;

const NAME_PLACEHOLDER = /\{(leader|second|last|winner|team)\}/;

export interface LineContext {
  /** Identities hidden right now: names forbidden. */
  anonymized: boolean;
  leader?: string | null;
  second?: string | null;
  last?: string | null;
  winner?: string | null;
  team?: string | null;
  votes?: number | null;
  gap?: number | null;
  joined?: number | null;
  teamCount?: number | null;
  seconds?: number | null;
  milestone?: number | null;
  rank?: number | null;
}

export interface ResolvedLine {
  id: string;
  category: LineCategory;
  text: string;
  expression: Line["expression"];
}

/** True when the raw text carries a team-name placeholder. */
export function hasNamePlaceholder(text: string): boolean {
  return NAME_PLACEHOLDER.test(text);
}

function valueFor(key: string, ctx: LineContext): string | null {
  const v = (ctx as unknown as Record<string, unknown>)[key];
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * Expand placeholders. Returns null when the line is not speakable in this
 * context: forbidden name in anonymous mode, a placeholder with no value
 * (e.g. {second} with a single team, {gap} of 0), or > 90 chars.
 */
export function resolveLine(line: Line, ctx: LineContext): ResolvedLine | null {
  if (ctx.anonymized && (!line.anonSafe || hasNamePlaceholder(line.text))) return null;
  let missing = false;
  const text = line.text.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => {
    if (key === "gap" && (ctx.gap ?? 0) < 1) missing = true;
    const v = valueFor(key, ctx);
    if (v === null) missing = true;
    return v ?? "";
  });
  if (missing) return null;
  if ([...text].length > MAX_LINE_CHARS) return null;
  return { id: line.id, category: line.category, text, expression: line.expression };
}

/** Per-category ring of the last spoken ids (no immediate repeats). */
export class LineMemory {
  private byCategory = new Map<LineCategory, string[]>();

  recent(category: LineCategory): readonly string[] {
    return this.byCategory.get(category) ?? [];
  }

  remember(category: LineCategory, id: string): void {
    const list = this.byCategory.get(category) ?? [];
    const next = [...list.filter((x) => x !== id), id].slice(-NO_REPEAT_MEMORY);
    this.byCategory.set(category, next);
  }

  reset(): void {
    this.byCategory.clear();
  }
}

export interface PickOptions {
  /**
   * Line pool to draw from (required): PROJECTOR_LINES on the projector,
   * PHONE_LINES on the phone. No default, so this module never pulls the whole
   * pool into a bundle that only needs one side.
   */
  pool: readonly Line[];
  memory?: LineMemory;
  /** Prefer lines with names when they are allowed (post-reveal drama). */
  preferNames?: boolean;
}

/**
 * Pick one speakable line of `category`: weighted, seeded, never one of the
 * last 8 ids of that category (unless nothing else is speakable). Returns
 * null when no line of the category resolves in this context.
 */
export function pickLine(
  category: LineCategory,
  ctx: LineContext,
  rng: Rng,
  opts: PickOptions,
): ResolvedLine | null {
  const pool = opts.pool;
  const candidates: { line: Line; resolved: ResolvedLine }[] = [];
  for (const line of pool) {
    if (line.category !== category) continue;
    const resolved = resolveLine(line, ctx);
    if (resolved) candidates.push({ line, resolved });
  }
  if (!candidates.length) return null;
  const recent = new Set(opts.memory?.recent(category) ?? []);
  const fresh = candidates.filter((c) => !recent.has(c.line.id));
  const from = fresh.length ? fresh : candidates;
  const chosen = weightedPick(rng, from, (c) => {
    const w = c.line.weight ?? 1;
    const named = hasNamePlaceholder(c.line.text);
    return opts.preferNames && named ? w * 2.5 : w;
  });
  if (!chosen) return null;
  opts.memory?.remember(category, chosen.line.id);
  return chosen.resolved;
}

/** Build the resolver context from a ranked snapshot (names already masked upstream if anonymous). */
export function contextFromTeams(
  teams: readonly { name: string; count: number; rank: number }[],
  base: Omit<LineContext, "leader" | "second" | "last" | "votes" | "gap" | "teamCount">,
): LineContext {
  const sorted = [...teams].sort((a, b) => a.rank - b.rank || b.count - a.count);
  const leader = sorted[0];
  const second = sorted[1];
  const last = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  const votes = teams.reduce((s, t) => s + t.count, 0);
  return {
    ...base,
    leader: leader?.name ?? null,
    second: second?.name ?? null,
    last: last?.name ?? null,
    votes,
    gap: leader && second ? leader.count - second.count : null,
    teamCount: teams.length || null,
  };
}
