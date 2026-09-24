"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { easings } from "@/lib/motion/tokens";

/**
 * LowerThird — a one-shot broadcast caption: 8px EY-yellow spine + a solid
 * glass slab with a kicker and a title (+ optional instruction line).
 *
 * Timeline (spec §2.4): waits `delayMs` (lets the stinger clear), reveals
 * left→right in 420 ms, holds `holdMs`, fades out in 250 ms. The reveal is a
 * translateX of the slab inside an overflow-clip wrapper (transform-only; no
 * clip-path / backdrop-filter on a moving element). Reduced motion: opacity.
 *
 * It carries a mascot keep-out while mounted so the co-host never parks a
 * bubble over it.
 */

export interface LowerThirdProps {
  kicker: string;
  title: string;
  body?: string;
  reduced: boolean;
  delayMs?: number;
  holdMs?: number;
  className?: string;
}

export function LowerThird({
  kicker,
  title,
  body,
  reduced,
  delayMs = 900,
  holdMs = 3600,
  className,
}: LowerThirdProps) {
  const [phase, setPhase] = useState<"wait" | "on" | "off">("wait");
  useEffect(() => {
    const a = setTimeout(() => setPhase("on"), delayMs);
    const b = setTimeout(() => setPhase("off"), delayMs + 420 + holdMs);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [delayMs, holdMs]);

  return (
    <AnimatePresence>
      {phase === "on" && (
        <motion.div
          key="lower-third"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className={["pointer-events-none flex items-stretch overflow-hidden", className ?? ""].join(" ")}
          data-mascot-keepout="lower-third"
          aria-live="polite"
        >
          <motion.span
            aria-hidden
            className="w-2 shrink-0 origin-bottom bg-ey-yellow"
            initial={reduced ? { opacity: 0 } : { scaleY: 0 }}
            animate={reduced ? { opacity: 1 } : { scaleY: 1 }}
            transition={{ duration: 0.22, ease: easings.decel }}
            style={{ boxShadow: "0 0 18px rgb(255 230 0 / 0.45)" }}
          />
          <div className="overflow-hidden">
            <motion.div
              initial={reduced ? { opacity: 0 } : { x: "-101%" }}
              animate={reduced ? { opacity: 1 } : { x: "0%" }}
              transition={{ duration: 0.42, ease: easings.decel, delay: reduced ? 0 : 0.12 }}
              className="flex flex-col gap-[0.35em] px-[clamp(1.1rem,1.6vw,2rem)] py-[clamp(0.8rem,1.6vh,1.3rem)]"
              style={{
                background:
                  "linear-gradient(180deg, rgb(30 38 71 / 0.94), rgb(20 26 51 / 0.94))",
                boxShadow: "var(--shadow-glass)",
              }}
            >
              <span className="font-display text-proj-label font-extrabold uppercase leading-none tracking-[0.2em] text-ey-yellow">
                {kicker}
              </span>
              <span className="whitespace-nowrap font-display text-proj-h2 font-black leading-[1.02] text-text">
                {title}
              </span>
              {body && (
                <span className="whitespace-nowrap text-proj-label font-semibold leading-tight text-text/85">
                  {body}
                </span>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LowerThird;
