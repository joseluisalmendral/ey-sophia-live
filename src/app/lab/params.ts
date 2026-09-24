import { defaultSettings, LAB_SPEEDS, type LabSettings, type LabSpeed } from "@/lab/engine";
import type { ChartType } from "@/lib/types";

/**
 * Query-string presets shared by the /lab pages, so QA scripts and a
 * standalone projector tab can start in a known state:
 *   ?scenario=final-ajustada&speed=4&seed=27&anon=1&chart=donut&reduced=1
 *   &keepouts=1&assistant=0&amin=6&amax=10
 *   &autoplay=1&drive=1 (frames only: run a local engine)
 */

export type SearchParams = Record<string, string | string[] | undefined>;

export function one(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

const CHARTS: readonly ChartType[] = ["bar_race", "columns", "donut"];

export function settingsFromParams(sp: SearchParams): LabSettings {
  const base = defaultSettings(one(sp, "scenario"));
  const speed = Number(one(sp, "speed"));
  const seed = Number(one(sp, "seed"));
  const chart = one(sp, "chart") as ChartType | undefined;
  const anon = one(sp, "anon");
  const amin = Number(one(sp, "amin"));
  const amax = Number(one(sp, "amax"));
  const assistantOn = one(sp, "assistant");
  const assistant = {
    enabled: assistantOn === undefined ? base.assistant.enabled : assistantOn !== "0",
    minIntervalS: Number.isInteger(amin) && amin >= 6 && amin <= 120 ? amin : base.assistant.minIntervalS,
    maxIntervalS: Number.isInteger(amax) && amax >= 8 && amax <= 120 ? amax : base.assistant.maxIntervalS,
  };
  if (assistant.maxIntervalS < assistant.minIntervalS + 2) assistant.maxIntervalS = assistant.minIntervalS + 2;
  return {
    ...base,
    speed: (LAB_SPEEDS as readonly number[]).includes(speed) ? (speed as LabSpeed) : base.speed,
    seed: Number.isInteger(seed) && seed > 0 ? seed : base.seed,
    chartType: chart && CHARTS.includes(chart) ? chart : base.chartType,
    anonymous: anon === undefined ? base.anonymous : anon === "1",
    reduced: one(sp, "reduced") === "1",
    showKeepouts: one(sp, "keepouts") === "1",
    assistant,
  };
}
