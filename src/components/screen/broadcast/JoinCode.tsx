"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { durations, easings } from "@/lib/motion/tokens";

/**
 * JoinCode — the projector's typed-entry fallback under the QR: a tracked
 * "Entra con el código" kicker over the big EY-yellow code. Never a URL on the
 * projector — the QR carries the link, the room only needs the code.
 *
 *  - `hero`  (lobby): the code is the second focal point after the QR.
 *  - `rail`  (live join rail): compact, same grammar.
 *
 * Entrance: the characters rise in one after another (transform + opacity,
 * 40 ms stagger, decel) under a static glow; reduced motion is a plain fade.
 */
export const JoinCode = memo(function JoinCode({
  code,
  size = "hero",
  reduced,
}: {
  code: string;
  size?: "hero" | "rail";
  reduced: boolean;
}) {
  const hero = size === "hero";
  const chars = [...code.toUpperCase()];
  return (
    <div
      className={[
        "glass glass--flat flex flex-col items-center leading-none",
        hero
          ? "gap-[clamp(0.45rem,1vh,0.8rem)] px-[clamp(1.4rem,2.2vw,2.6rem)] py-[clamp(0.8rem,1.7vh,1.4rem)]"
          : "gap-[clamp(0.3rem,0.7vh,0.55rem)] px-[clamp(1rem,1.5vw,1.8rem)] py-[clamp(0.55rem,1.2vh,0.95rem)]",
      ].join(" ")}
      style={{ borderRadius: hero ? "1.4rem" : "1.1rem" }}
      data-mascot-keepout="code"
    >
      <span className="font-display text-proj-label font-extrabold uppercase tracking-[0.2em] text-text-dim">
        Entra con el código
      </span>
      <span
        className={[
          "whitespace-nowrap font-display font-black uppercase tabular-nums text-ey-yellow",
          hero ? "text-proj-number tracking-[0.12em]" : "text-proj-h1 tracking-[0.1em]",
        ].join(" ")}
        style={{ textShadow: "0 0 28px rgb(255 230 0 / 0.35)" }}
      >
        <span className="sr-only">{code}</span>
        {chars.map((c, i) => (
          <motion.span
            key={`${i}-${c}`}
            aria-hidden
            className="inline-block"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em" }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: (reduced ? 0.1 : 0.35) + (reduced ? 0 : i * 0.04),
              duration: reduced ? durations.base : durations.slow,
              ease: easings.decel,
            }}
          >
            {c}
          </motion.span>
        ))}
      </span>
    </div>
  );
});

export default JoinCode;
