"use client";

import { Broqui } from "@/components/mascot/Broqui";
import { MascotBoundary } from "@/components/mascot/MascotBoundary";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";

/**
 * HomeBroqui — a small, silent Broqui cameo perched on the join card's top
 * right corner (decorative: no lines, no interaction, no network).
 */
export function HomeBroqui() {
  const reduced = useReducedMotionPref();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-11 right-2 z-10"
    >
      <MascotBoundary name="home">
        <Broqui size={92} expression="smug" reduced={reduced} lookAt={{ x: -0.35, y: 0.35 }} />
      </MascotBoundary>
    </div>
  );
}

export default HomeBroqui;
