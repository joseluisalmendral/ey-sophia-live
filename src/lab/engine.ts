import type {
  ChartType,
  Poll,
  PollStatus,
  RankedTeam,
  Team,
  TieRule,
} from "@/lib/types";
import { personaStatesAt, type PersonaId, type PersonaState } from "./personas";
import { getScenario, type Scenario } from "./scenarios";

/**
 * /lab scenario engine — a VIRTUAL CLOCK that plays a whole show (lobby →
 * count-in → live → close → reveal) with no network and no Supabase.
 *
 * - Deterministic: every vote and join arrival is precomputed from the
 *   scenario keyframes + a seeded PRNG (mulberry32), so scrubbing/stepping to
 *   any t always yields the same state for the same seed.
 * - Speed ×0.5–8 before the close; the reveal ALWAYS runs at 1× (it is the
 *   show, and RevealStage choreographs on real timers anyway).
 * - opensAt / closesAt are REBASED to real wall-clock time on every speed
 *   change, pause, seek or reset, so the production CountInTimer /
 *   CountdownTimer (which read Date.now()) hit zero exactly at the beat.
 *   While paused they are re-stamped on every tick, which freezes them.
 *
 * The engine is framework-free; src/lab/useLab.ts wires it into React and the
 * BroadcastChannel.
 */

/* ------------------------------------------------------------------ */
/* PRNG                                                                */

/** mulberry32 — tiny, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */

export type BeatKind = "lobby" | "countin" | "open" | "mark" | "close" | "podium";

export interface Beat {
  /** Virtual seconds since the scenario start. */
  at: number;
  label: string;
  kind: BeatKind;
}

export interface Timeline {
  scenario: Scenario;
  seed: number;
  /** Virtual second the count-in starts (null when the scenario has none). */
  countInAt: number | null;
  openAt: number;
  closeAt: number;
  /** End of the scrubber: close + the full 1× reveal arc. */
  end: number;
  /** Sorted virtual arrival times of lobby joins. */
  joinTimes: number[];
  /** Per team (scenario order), sorted virtual arrival times of each vote. */
  voteTimes: number[][];
  beats: Beat[];
}

/** Close → podium climax in the full-motion reveal (reveal/constants.ts sum). */
export const REVEAL_TO_PODIUM_SEC = 16.1;
/** Scrubber tail after the close: reveal + podium + fireworks settle. */
const REVEAL_TAIL_SEC = 24;

/** Number of sorted values ≤ t (binary search upper bound). */
function countUpTo(sorted: number[], t: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function buildTimeline(scenario: Scenario, seed: number): Timeline {
  const rand = mulberry32(seed);
  const countInAt = scenario.countInSec > 0 ? scenario.lobbySec : null;
  const openAt = scenario.lobbySec + scenario.countInSec;
  const openFor = scenario.durationSec ?? scenario.manualCloseSec ?? 45;
  const closeAt = openAt + openFor;
  const end = closeAt + REVEAL_TAIL_SEC;

  // Joins: early-biased arrivals across the lobby (+ count-in), so the room
  // visibly "fills" and then trickles in.
  const joinTimes: number[] = [];
  for (let i = 0; i < scenario.joinTarget; i++) {
    const u = rand();
    joinTimes.push(0.4 + (openAt - 0.4) * (1 - Math.pow(1 - u, 1.6)));
  }
  joinTimes.sort((a, b) => a - b);

  // Votes: between consecutive keyframes each team receives exactly the
  // keyframe delta, spread evenly with a seeded jitter. Counts are therefore
  // EXACT at every keyframe (ties/margins are guaranteed), with organic
  // arrival in between.
  const voteTimes: number[][] = scenario.teams.map(() => []);
  const frames = scenario.tally;
  for (let k = 1; k < frames.length; k++) {
    const [t0, c0] = frames[k - 1];
    const [t1, c1] = frames[k];
    const span = t1 - t0;
    scenario.teams.forEach((_, i) => {
      const d = Math.max(0, (c1[i] ?? 0) - (c0[i] ?? 0));
      const step = span / Math.max(1, d);
      for (let v = 0; v < d; v++) {
        const base = t0 + step * (v + 0.5);
        const jitter = (rand() - 0.5) * step * 0.8;
        const at = Math.min(t1, Math.max(t0 + 0.001, base + jitter));
        voteTimes[i].push(openAt + at);
      }
    });
  }
  voteTimes.forEach((list) => list.sort((a, b) => a - b));

  const beats: Beat[] = [{ at: 0, label: "Lobby", kind: "lobby" }];
  if (countInAt !== null) {
    beats.push({ at: countInAt, label: "Cuenta atrás", kind: "countin" });
  }
  beats.push({ at: openAt, label: "Abre", kind: "open" });
  for (const m of scenario.marks ?? []) {
    beats.push({ at: openAt + m.at, label: m.label, kind: "mark" });
  }
  beats.push({ at: closeAt, label: "Cierre", kind: "close" });
  beats.push({ at: closeAt + REVEAL_TO_PODIUM_SEC, label: "Podio", kind: "podium" });
  beats.sort((a, b) => a.at - b.at);

  return { scenario, seed, countInAt, openAt, closeAt, end, joinTimes, voteTimes, beats };
}

export function statusAt(tl: Timeline, t: number): PollStatus {
  if (t >= tl.closeAt) return "closed";
  if (t >= tl.openAt) return "open";
  if (tl.countInAt !== null && t >= tl.countInAt) return "countdown";
  return "draft";
}

/** Percentages stay hidden until the tally is meaningful (useLiveTally parity). */
const MEANINGFUL_TOTAL = 10;

/**
 * Rank + order exactly like useLiveTally's rankAndOrder: count desc, stable by
 * configured position, dense 1-based rank, suppressed-until-meaningful %.
 */
export function rankTeams(teams: Team[], counts: number[]): RankedTeam[] {
  const total = counts.reduce((s, c) => s + c, 0);
  const meaningful = total >= MEANINGFUL_TOTAL;
  const rows = teams.map((team, position) => ({
    team,
    position,
    count: counts[position] ?? 0,
  }));
  rows.sort((a, b) => b.count - a.count || a.position - b.position);
  let lastCount = Number.POSITIVE_INFINITY;
  let lastRank = 0;
  return rows.map((r, i): RankedTeam => {
    const rank = r.count === lastCount ? lastRank : i + 1;
    lastCount = r.count;
    lastRank = rank;
    return {
      ...r.team,
      count: r.count,
      rank,
      percentage:
        meaningful && total > 0 ? Math.round((r.count / total) * 100) : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Settings + snapshot                                                 */

export const LAB_SPEEDS = [0.5, 1, 2, 4, 8] as const;
export type LabSpeed = (typeof LAB_SPEEDS)[number];

/** Assistant knobs; consumed by the mascot host from E3 on. */
export interface LabAssistantSettings {
  enabled: boolean;
  minIntervalS: number;
  maxIntervalS: number;
}

export interface LabSettings {
  scenarioId: string;
  seed: number;
  speed: LabSpeed;
  anonymous: boolean;
  chartType: ChartType;
  tieRule: TieRule;
  reduced: boolean;
  showKeepouts: boolean;
  assistant: LabAssistantSettings;
}

export interface LabSnapshot {
  /** Bumps on reset / scenario / seed change: frames drop manual overrides. */
  runId: number;
  t: number;
  end: number;
  openAt: number;
  closeAt: number;
  playing: boolean;
  status: PollStatus;
  /** Real wall-clock ISO (rebased) — a future time during countdown. */
  opensAt: string | null;
  /** Real wall-clock ISO (rebased) — only with a configured duration. */
  closesAt: string | null;
  joined: number;
  poll: Poll;
  teams: Team[];
  liveTeams: RankedTeam[];
  beats: Beat[];
  personas: Record<PersonaId, PersonaState>;
  settings: LabSettings;
}

export function defaultSettings(scenarioId?: string): LabSettings {
  const scenario = getScenario(scenarioId);
  return {
    scenarioId: scenario.id,
    seed: 27,
    speed: 1,
    anonymous: scenario.anonymous,
    chartType: scenario.chartType,
    tieRule: scenario.tieRule,
    reduced: false,
    showKeepouts: false,
    assistant: { enabled: true, minIntervalS: 14, maxIntervalS: 28 },
  };
}

function teamsOf(scenario: Scenario): Team[] {
  const pollId = `lab-${scenario.id}`;
  return scenario.teams.map((t) => ({ ...t, pollId }));
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */

const TICK_MS = 100;
/** Ignore rebase drift below this (keeps timer props referentially calm). */
const STAMP_EPSILON_MS = 40;

export class LabEngine {
  private settings: LabSettings;
  private tl: Timeline;
  private teams: Team[];
  private t = 0;
  private playing = false;
  private runId = 1;
  private lastReal = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private opensMs: number | null = null;
  private closesMs: number | null = null;

  constructor(
    settings: LabSettings,
    private readonly emit: (snap: LabSnapshot) => void,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.settings = settings;
    this.tl = buildTimeline(getScenario(settings.scenarioId), settings.seed);
    this.teams = teamsOf(this.tl.scenario);
  }

  start(): void {
    if (this.timer !== null) return;
    this.lastReal = this.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    // First frame on the next macrotask (never synchronously in a React effect).
    setTimeout(() => this.publish(), 0);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  getSettings(): LabSettings {
    return this.settings;
  }

  play(): void {
    if (this.t >= this.tl.end) this.seek(0);
    this.advance();
    this.playing = true;
    this.lastReal = this.now();
    this.rebase();
  }

  pause(): void {
    this.advance();
    this.playing = false;
    this.rebase();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number): void {
    this.t = Math.max(0, Math.min(this.tl.end, t));
    this.lastReal = this.now();
    this.rebase();
  }

  /** Jump to the next beat marker after the current time. */
  step(): void {
    this.advance();
    const next = this.tl.beats.find((b) => b.at > this.t + 0.05);
    this.seek(next ? next.at : this.tl.end);
  }

  reset(): void {
    this.runId += 1;
    this.playing = false;
    this.seek(0);
  }

  /** Merge settings; scenario/seed changes rebuild the timeline and reset. */
  update(patch: Partial<LabSettings>): void {
    const prev = this.settings;
    let next: LabSettings = { ...prev, ...patch };
    if (patch.scenarioId && patch.scenarioId !== prev.scenarioId) {
      const s = getScenario(patch.scenarioId);
      next = {
        ...next,
        scenarioId: s.id,
        anonymous: s.anonymous,
        chartType: s.chartType,
        tieRule: s.tieRule,
      };
    }
    if (next.speed !== prev.speed) this.advance();
    this.settings = next;
    if (next.scenarioId !== prev.scenarioId || next.seed !== prev.seed) {
      this.tl = buildTimeline(getScenario(next.scenarioId), next.seed);
      this.teams = teamsOf(this.tl.scenario);
      this.reset();
      return;
    }
    this.lastReal = this.now();
    this.rebase();
  }

  /* -------------------------------------------------------------- */

  private rateAt(t: number): number {
    return t < this.tl.closeAt ? this.settings.speed : 1;
  }

  /** Integrate real elapsed time into virtual time (×speed, 1× after close). */
  private advance(): void {
    const nowReal = this.now();
    const dt = (nowReal - this.lastReal) / 1000;
    this.lastReal = nowReal;
    if (!this.playing || dt <= 0) return;
    let t = this.t;
    let rem = dt;
    if (t < this.tl.closeAt) {
      const speed = this.settings.speed;
      const toClose = (this.tl.closeAt - t) / speed;
      if (rem <= toClose) {
        t += rem * speed;
        rem = 0;
      } else {
        t = this.tl.closeAt;
        rem -= toClose;
      }
    }
    t += rem;
    if (t >= this.tl.end) {
      t = this.tl.end;
      this.playing = false;
    }
    this.t = t;
  }

  /** Re-stamp opensAt/closesAt against the real clock at the current rate. */
  private rebase(): void {
    this.opensMs = null;
    this.closesMs = null;
    this.stamp();
    this.publish();
  }

  private stamp(): void {
    const nowReal = this.now();
    // Paused: 1× so the frozen countdowns read virtual seconds.
    const rate = this.playing ? this.rateAt(this.t) : 1;
    const status = statusAt(this.tl, this.t);
    const nextOpens =
      status === "countdown"
        ? nowReal + ((this.tl.openAt - this.t) / rate) * 1000
        : null;
    const nextCloses =
      status === "open" && this.tl.scenario.durationSec !== null
        ? nowReal + ((this.tl.closeAt - this.t) / rate) * 1000
        : null;
    const drift = (a: number | null, b: number | null) =>
      a === null || b === null || Math.abs(a - b) > STAMP_EPSILON_MS;
    if (nextOpens === null || drift(this.opensMs, nextOpens)) this.opensMs = nextOpens;
    if (nextCloses === null || drift(this.closesMs, nextCloses)) this.closesMs = nextCloses;
  }

  private tick(): void {
    this.advance();
    this.stamp();
    this.publish();
  }

  private publish(): void {
    this.emit(this.snapshot());
  }

  snapshot(): LabSnapshot {
    const { tl, t, settings } = this;
    const scenario = tl.scenario;
    const status = statusAt(tl, t);
    const counts = tl.voteTimes.map((list) => countUpTo(list, t));
    const opensAt = this.opensMs !== null ? new Date(this.opensMs).toISOString() : null;
    const closesAt = this.closesMs !== null ? new Date(this.closesMs).toISOString() : null;
    const poll: Poll = {
      id: `lab-${scenario.id}`,
      title: scenario.title,
      status,
      opensAt,
      closesAt,
      durationSeconds: scenario.durationSec,
      chartType: settings.chartType,
      showLegend: true,
      anonymousDisplay: settings.anonymous,
      tieRule: settings.tieRule,
      joinCode: scenario.joinCode,
      createdAt: "2026-09-24T17:00:00.000Z",
    };
    return {
      runId: this.runId,
      t,
      end: tl.end,
      openAt: tl.openAt,
      closeAt: tl.closeAt,
      playing: this.playing,
      status,
      opensAt,
      closesAt,
      joined: countUpTo(tl.joinTimes, t),
      poll,
      teams: this.teams,
      liveTeams: rankTeams(this.teams, counts),
      beats: tl.beats,
      personas: personaStatesAt(tl, t),
      settings,
    };
  }
}
