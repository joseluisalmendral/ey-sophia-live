"use client";

import { motion } from "motion/react";
import { EyBeam } from "@/components/brand/EyBeam";
import { durations, springs } from "@/lib/motion/tokens";
import { pickTextOn } from "@/lib/utils/contrast";
import type { Team } from "@/lib/types";
import { COPY, CheckIcon, ViewWrap } from "./shared";

/** Pure presentational confirmation view for a fresh 'ok' vote. */
export function ConfirmView({ team, reduced }: { team: Team; reduced: boolean }) {
  const fg = pickTextOn(team.color);
  return (
    <ViewWrap reduced={reduced}>
      <div className="flex flex-1 flex-col items-center justify-center gap-7 py-10 text-center">
        <motion.div
          initial={reduced ? { opacity: 0 } : { scale: 0, rotate: -20 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, rotate: 0 }}
          transition={springs.podiumRise}
          className="flex h-28 w-28 items-center justify-center rounded-full"
          style={{ backgroundColor: team.color, color: fg, boxShadow: "var(--shadow-e2)" }}
        >
          <CheckIcon size={56} />
        </motion.div>

        <div className="flex flex-col gap-2">
          <span className="text-micro uppercase tracking-[0.3em] text-power-green">
            {COPY.confirmKicker}
          </span>
          <h2 className="font-display text-h1 font-extrabold leading-tight text-text">
            {COPY.confirmYour}{" "}
            <span style={{ color: team.color }}>{team.name}</span>{" "}
            {COPY.confirmIn}
          </h2>
        </div>

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: durations.base }}
          className="flex items-center gap-3 rounded-pill border border-ey-yellow/30 bg-ey-yellow/5 px-5 py-2.5"
        >
          <EyBeam surface="dark" size={26} label="" />
          <span className="font-display text-body font-bold text-ey-yellow">
            {COPY.watch}
          </span>
        </motion.div>
      </div>
    </ViewWrap>
  );
}
