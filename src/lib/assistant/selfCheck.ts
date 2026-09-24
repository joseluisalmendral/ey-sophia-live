/**
 * selfCheck — the /lab acceptance gate for the assistant brain. Pure and
 * synchronous (a few ms): pool integrity, the 90-char rule, the anonymous
 * leak test with fixture names + colour words, the interval validation cases
 * and a seeded scheduler simulation that proves U[min,max] + the 6 s floor.
 */

import { LINES, type Line, type LineCategory } from "./lines.es";
import { ANON_LABEL_WORDS, hasNamePlaceholder, MAX_LINE_CHARS, pickLine, resolveLine, type LineContext } from "./resolveLine";
import { mulberry32 } from "./rng";
import { INTERVAL_FLOOR_S, MIN_GAP_MS, sanitizeInterval, Scheduler, validateInterval } from "./scheduler";

export interface SelfCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface SelfCheckReport {
  ok: boolean;
  total: number;
  items: SelfCheckItem[];
}

const FIXTURE_NAMES = [
  "Neuronas Nómadas",
  "Prompt y Circunstancia",
  "Los Tokenizados",
  "Equipo Rojo Pasión",
  "Los Verdes del Excel",
  "Azul Consultoría",
  "Los Auditores del Prompt Perdido",
];

/** Colour words a hidden-identity line must never carry (they re-identify bars). */
export const COLOR_WORDS =
  /\b(verde|amarill[oa]|morad[oa]|azul|naranja|blanc[oa]|gris|roj[oa]|negr[oa]|rosa|dorad[oa]|lila|violeta|turquesa|cian)\b/i;

const ALLOWED_PLACEHOLDERS = new Set([
  "leader",
  "second",
  "last",
  "winner",
  "team",
  "votes",
  "gap",
  "joined",
  "teamCount",
  "seconds",
  "milestone",
  "rank",
]);

const PROJECTOR_CATEGORIES: LineCategory[] = [
  "lobby_ambient",
  "lobby_joins",
  "count_in",
  "open_ambient",
  "first_vote",
  "lead_change",
  "tie_top",
  "milestone",
  "surge",
  "landslide",
  "quiet",
  "last10",
  "close",
  "reveal_suspense",
  "reveal_winner",
];

/** Worst-case expansion used by the length rule (18-char names, 3-digit numbers). */
export function expandWorstCase(text: string): string {
  return text
    .replace(/\{(leader|second|last|winner|team)\}/g, "X".repeat(18))
    .replace(/\{(votes|gap|joined|milestone)\}/g, "999")
    .replace(/\{(teamCount|seconds|rank)\}/g, "99");
}

function fixtureContext(anonymized: boolean): LineContext {
  return {
    anonymized,
    leader: FIXTURE_NAMES[0],
    second: FIXTURE_NAMES[1],
    last: FIXTURE_NAMES[2],
    winner: FIXTURE_NAMES[0],
    team: FIXTURE_NAMES[3],
    votes: 123,
    gap: 4,
    joined: 150,
    teamCount: 5,
    seconds: 10,
    milestone: 100,
    rank: 2,
  };
}

function containsFixture(text: string): string | null {
  const lower = text.toLowerCase();
  for (const n of FIXTURE_NAMES) if (lower.includes(n.toLowerCase())) return n;
  // Also the 18-char worst-case token and any surviving placeholder.
  if (/XXXXXXXX/.test(text)) return "XXXXXXXX";
  if (/\{[a-zA-Z]+\}/.test(text)) return "{placeholder}";
  return null;
}

export function runSelfCheck(pool: readonly Line[] = LINES): SelfCheckReport {
  const items: SelfCheckItem[] = [];
  const push = (id: string, label: string, errors: string[], okDetail: string) =>
    items.push({
      id,
      label,
      ok: errors.length === 0,
      detail: errors.length ? errors.slice(0, 6).join(" · ") + (errors.length > 6 ? ` · +${errors.length - 6}` : "") : okDetail,
    });

  /* 1. Pool integrity */
  {
    const errors: string[] = [];
    const ids = new Set<string>();
    for (const l of pool) {
      if (ids.has(l.id)) errors.push(`id duplicado ${l.id}`);
      ids.add(l.id);
      for (const m of l.text.matchAll(/\{([^}]*)\}/g)) {
        if (!ALLOWED_PLACEHOLDERS.has(m[1])) errors.push(`${l.id}: placeholder {${m[1]}}`);
      }
      if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(l.text) || /#\w/.test(l.text)) errors.push(`${l.id}: emoji/hashtag`);
      if (/  |\s$|^\s/.test(l.text)) errors.push(`${l.id}: espacios`);
      if (l.anonSafe && hasNamePlaceholder(l.text)) errors.push(`${l.id}: anonSafe con nombre`);
      if (l.anonSafe && COLOR_WORDS.test(l.text)) errors.push(`${l.id}: anonSafe con color`);
    }
    const byCat = new Map<LineCategory, number>();
    for (const l of pool) byCat.set(l.category, (byCat.get(l.category) ?? 0) + 1);
    for (const c of PROJECTOR_CATEGORIES) if (!byCat.get(c)) errors.push(`categoría vacía ${c}`);
    push("pool", "Integridad del pool", errors, `${pool.length} líneas · ${byCat.size} categorías · ids únicos`);
  }

  /* 2. 90-char rule (worst case) */
  {
    const errors: string[] = [];
    let max = 0;
    for (const l of pool) {
      const len = [...expandWorstCase(l.text)].length;
      max = Math.max(max, len);
      if (len > MAX_LINE_CHARS) errors.push(`${l.id}: ${len}`);
    }
    push("len", `Máximo ${MAX_LINE_CHARS} caracteres expandidos`, errors, `máximo ${max} caracteres (peor caso)`);
  }

  /* 3. Anonymous leak test */
  {
    const errors: string[] = [];
    const anonCtx = fixtureContext(true);
    let safeCount = 0;
    for (const l of pool) {
      const r = resolveLine(l, anonCtx);
      if (!l.anonSafe) {
        if (r) errors.push(`${l.id}: no-anonSafe hablada en anónimo`);
        continue;
      }
      safeCount++;
      if (!r) continue; // e.g. {gap}-dependent; fine
      const leak = containsFixture(r.text);
      if (leak) errors.push(`${l.id}: filtra "${leak}"`);
      if (COLOR_WORDS.test(r.text)) errors.push(`${l.id}: color`);
      if (ANON_LABEL_WORDS.test(r.text)) errors.push(`${l.id}: etiqueta anónima`);
    }
    // Random draws through the real picker, every projector category.
    const rng = mulberry32(2027);
    let draws = 0;
    for (const c of PROJECTOR_CATEGORIES) {
      for (let i = 0; i < 40; i++) {
        const r = pickLine(c, anonCtx, rng, { pool });
        if (!r) continue;
        draws++;
        const leak = containsFixture(r.text);
        if (leak) errors.push(`${c}/${r.id}: filtra "${leak}"`);
        if (ANON_LABEL_WORDS.test(r.text)) errors.push(`${c}/${r.id}: etiqueta anónima`);
        const src = pool.find((l) => l.id === r.id);
        if (src && !src.anonSafe) errors.push(`${c}/${r.id}: no-anonSafe elegida`);
      }
    }
    push("anon", "Modo anónimo sin nombres, colores ni letras", errors, `${safeCount} líneas anonSafe · ${draws} sorteos limpios`);
  }

  /* 4. Named mode resolves names */
  {
    const errors: string[] = [];
    const ctx = fixtureContext(false);
    let named = 0;
    for (const l of pool) {
      if (!hasNamePlaceholder(l.text)) continue;
      const r = resolveLine(l, ctx);
      if (!r) {
        errors.push(`${l.id}: no resuelve con nombres`);
        continue;
      }
      named++;
      if (/\{[a-zA-Z]+\}/.test(r.text)) errors.push(`${l.id}: placeholder sin expandir`);
    }
    push("names", "Nombres expandidos tras la revelación", errors, `${named} líneas con nombre resuelven`);
  }

  /* 5. Interval validation cases */
  {
    const errors: string[] = [];
    const cases: { in: { min?: number; max?: number } | null; out: [number, number] }[] = [
      { in: { min: 14, max: 28 }, out: [14, 28] },
      { in: { min: 3, max: 5 }, out: [6, 8] },
      { in: { min: 6, max: 6 }, out: [6, 8] },
      { in: { min: 200, max: 300 }, out: [118, 120] },
      { in: { min: 30, max: 10 }, out: [30, 32] },
      { in: { min: Number.NaN, max: Number.NaN }, out: [14, 28] },
      { in: null, out: [14, 28] },
    ];
    for (const c of cases) {
      const r = sanitizeInterval(c.in);
      if (r.min !== c.out[0] || r.max !== c.out[1]) errors.push(`sanitize(${JSON.stringify(c.in)}) = ${r.min}/${r.max}`);
    }
    const invalid: Partial<{ min: number; max: number }>[] = [
      { min: 5, max: 20 },
      { min: 14, max: 15 },
      { min: 14, max: 121 },
      { min: 14.5, max: 28 },
      { max: 28 },
    ];
    for (const c of invalid) if (validateInterval(c) === null) errors.push(`validate(${JSON.stringify(c)}) aceptado`);
    if (validateInterval({ min: 6, max: 8 }) !== null) errors.push("validate(6/8) rechazado");
    if (validateInterval({ min: 14, max: 28 }) !== null) errors.push("validate(14/28) rechazado");
    push("interval", "Validación de intervalos", errors, `${cases.length + invalid.length + 2} casos · suelo ${INTERVAL_FLOOR_S} s`);
  }

  /* 6. Scheduler simulation: ambient cadence within [min,max] and the 4 s gap */
  {
    const errors: string[] = [];
    const min = 6;
    const max = 10;
    const rng = mulberry32(7);
    let now = 0;
    const s = new Scheduler({ min, max }, rng, now);
    let lastEnd: number | null = null;
    let count = 0;
    const gaps: number[] = [];
    while (count < 60 && now < 3_600_000) {
      const d = s.tick(now);
      if (d) {
        if (lastEnd !== null) gaps.push((now - lastEnd) / 1000);
        s.onBubbleStart(now, d);
        now += 3000;
        s.onBubbleEnd(now);
        lastEnd = now;
        count++;
      }
      now += 100;
    }
    const bad = gaps.filter((g) => g < min - 0.11 || g > max + 0.11);
    if (bad.length) errors.push(`${bad.length} intervalos fuera de [${min},${max}]: ${bad.slice(0, 3).map((g) => g.toFixed(1)).join(", ")}`);
    if (gaps.some((g) => g * 1000 < MIN_GAP_MS)) errors.push("hueco < 4 s");
    const lo = Math.min(...gaps);
    const hi = Math.max(...gaps);
    // Floor: a config below 6 s must still wait ≥ 6 s.
    const s2 = new Scheduler({ min: 1, max: 2 }, mulberry32(3), 0);
    s2.onBubbleEnd(0);
    let t = 0;
    while (t < 20_000 && !s2.tick(t)) t += 50;
    if (t < INTERVAL_FLOOR_S * 1000 - 60) errors.push(`suelo roto: ${(t / 1000).toFixed(1)} s`);
    push("cadence", "Cadencia U[min,max] y suelo de 6 s", errors, `${gaps.length} intervalos en [${lo.toFixed(1)}, ${hi.toFixed(1)}] s`);
  }

  return { ok: items.every((i) => i.ok), total: pool.length, items };
}
