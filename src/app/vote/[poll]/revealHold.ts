"use client";

import { useEffect, useState } from "react";
import {
  REVEAL_BEATS,
  REVEAL_BEATS_REDUCED,
  type RevealBeatTimings,
} from "@/components/screen/reveal/constants";

/**
 * Phone reveal hold — the projector reveals the winner FIRST.
 *
 * The projector's cinematic arc (dim → suspense → curtain → camera cuts →
 * podium) runs for the sum of its beats after it learns the poll closed. A
 * phone that learned 'closed' at the same moment (local closes_at flip) or
 * later (polling) must not show the rank, the ranked list or any winner line
 * before that podium lands, or the room reads the result on their phones
 * first. The phone therefore holds its personal result for the whole arc,
 * measured from the moment IT learned the poll closed (never earlier than the
 * projector, only ever later).
 *
 * Production always holds for the FULL-motion arc: the phone cannot know the
 * projector's reduced-motion preference, and holding a little longer is safe
 * while showing early is a spoiler. The /lab phone (same browser as its lab
 * projector) passes the reduced hold when reduced motion is on.
 */

/** Sum of every beat of a reveal arc, in ms. */
export function revealArcMs(beats: RevealBeatTimings): number {
  const s =
    beats.dim +
    beats.suspense +
    beats.curtainHold +
    beats.curtainOpen +
    beats.camLow +
    beats.camDolly +
    beats.camHero;
  return Math.round(s * 1000);
}

/** Production hold: the full-motion projector arc (~16 s). */
export const PHONE_REVEAL_HOLD_MS = revealArcMs(REVEAL_BEATS);
/** Lab-only hold when the lab projector runs the reduced arc (~4 s). */
export const PHONE_REVEAL_HOLD_REDUCED_MS = revealArcMs(REVEAL_BEATS_REDUCED);

/**
 * True once `active` has stayed true for `holdMs`. Resets (false) as soon as
 * `active` drops, so a relaunched run holds again from scratch.
 */
export function useRevealHold(active: boolean, holdMs: number = PHONE_REVEAL_HOLD_MS): boolean {
  const [armed, setArmed] = useState(false);
  // State-during-render reset: any change of `active` disarms immediately
  // (no effect round-trip, so a stale "armed" never paints for a frame).
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    setArmed(false);
  }

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setArmed(true), holdMs);
    return () => clearTimeout(id);
  }, [active, holdMs]);

  return active && armed;
}
