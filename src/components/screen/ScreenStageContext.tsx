"use client";

import { createContext, useContext } from "react";
import type { ChartType, PollStatus, RankedTeam } from "@/lib/types";

/**
 * ScreenStageFrame — the DERIVED projector data ScreenStage already computes
 * (effective status, masked teams, anonymous flag, deadlines, joins) plus the
 * current reveal beat, exposed to whatever is mounted in `mascotSlot`.
 *
 * The mascot host only READS this: no data hooks, no network, and the
 * anonymous masking stays upstream (the teams here are the display teams).
 */

export type RevealBeat = "suspense" | "curtain" | "cameras" | "podium";

export interface ScreenStageFrame {
  status: PollStatus;
  /** Display teams: identities already masked while anonymous + open. */
  teams: RankedTeam[];
  anonymized: boolean;
  chartType: ChartType;
  opensAt: string | null;
  closesAt: string | null;
  joined: number | null;
  /** Current reveal beat while closed; null otherwise. */
  revealBeat: RevealBeat | null;
}

const ScreenStageContext = createContext<ScreenStageFrame | null>(null);

export const ScreenStageProvider = ScreenStageContext.Provider;

/** Null outside a ScreenStage (e.g. the /lab/mascot gallery). */
export function useScreenStageFrame(): ScreenStageFrame | null {
  return useContext(ScreenStageContext);
}
