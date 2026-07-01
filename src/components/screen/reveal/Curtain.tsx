"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { EyBeam } from "@/components/brand/EyBeam";
import { durations, easings } from "@/lib/motion/tokens";

/**
 * Curtain — the TELÓN beat: two 3D curtain panels (CSS perspective, pleated
 * fabric, gold seam trim, roaming sheen) slam shut over the stage. The left
 * panel carries the EY SophIA co-brand (EY beam + "SophIA" wordmark with the
 * "IA" in sophia-purple); the right panel carries thePower. A pulsing
 * "Y el equipo ganador es…" rides the seam.
 *
 * The OPENING is the AnimatePresence exit: when the parent advances to the
 * podium beat, both panels swing outward on rotateY (hinged at the screen
 * edges) while the podium rises underneath — the classic theatre reveal.
 *
 * Reduced motion: no 3D, no sheen — panels crossfade in and out.
 */

export interface CurtainProps {
  reduced: boolean;
  /** Seconds the opening (exit) takes; drives the rotateY swing. */
  openSeconds: number;
}

const FABRIC =
  "linear-gradient(180deg, #241a4d 0%, #1a1338 55%, #120d29 100%)";
// Vertical pleats: alternating light/shadow stripes over the fabric gradient.
const PLEATS =
  "repeating-linear-gradient(90deg, rgba(139,92,246,0.16) 0px, rgba(255,255,255,0.05) 22px, rgba(0,0,0,0.35) 46px, rgba(139,92,246,0.16) 70px)";

export function Curtain({ reduced, openSeconds }: CurtainProps) {
  const closeTransition = reduced
    ? { duration: durations.base }
    : { duration: 0.7, ease: easings.decel };
  const openTransition = reduced
    ? { duration: openSeconds }
    : { duration: openSeconds, ease: easings.accel };

  return (
    <motion.div
      className="absolute inset-0 z-20 overflow-hidden"
      style={{ perspective: reduced ? undefined : "1400px" }}
      initial={{ opacity: reduced ? 0 : 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduced ? 0 : 1 }}
      transition={{ duration: durations.base }}
    >
      {/* LEFT panel — EY SophIA */}
      <CurtainPanel side="left" reduced={reduced} close={closeTransition} open={openTransition}>
        <div className="flex flex-col items-center gap-4">
          <EyBeam surface="dark" size={72} label="EY" />
          <span className="font-display text-[clamp(2.2rem,5vw,4.5rem)] font-extrabold leading-none tracking-tight text-text">
            Soph<span className="text-sophia-purple">IA</span>
          </span>
        </div>
      </CurtainPanel>

      <CurtainPanel side="right" reduced={reduced} close={closeTransition} open={openTransition}>
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex items-center rounded-[16px] bg-white px-5 py-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
            <Image src="/brand/thepower-logo.webp" alt="thePower" width={200} height={50} />
          </span>
          <span className="text-[clamp(0.7rem,1vw,0.95rem)] uppercase tracking-[0.3em] text-text-dim">
            en colaboración
          </span>
        </div>
      </CurtainPanel>

      {/* Seam glow + suspense line riding the join */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-[12vh]">
        <motion.span
          initial={{ opacity: 0, y: reduced ? 0 : 16 }}
          animate={
            reduced
              ? { opacity: 1, y: 0 }
              : { opacity: [0, 1, 0.6, 1], y: 0 }
          }
          transition={
            reduced
              ? { delay: 0.3, duration: durations.slow }
              : { delay: 0.7, duration: 1.8, times: [0, 0.4, 0.7, 1], repeat: Infinity, repeatDelay: 0.2 }
          }
          className="rounded-pill border border-ey-yellow/40 bg-cosmic-deep/70 px-6 py-2.5 font-display text-[clamp(1.1rem,2.2vw,2rem)] font-black uppercase tracking-[0.2em] text-ey-yellow backdrop-blur"
        >
          Y el equipo ganador es…
        </motion.span>
      </div>
    </motion.div>
  );
}

function CurtainPanel({
  side,
  reduced,
  close,
  open,
  children,
}: {
  side: "left" | "right";
  reduced: boolean;
  close: object;
  open: object;
  children: React.ReactNode;
}) {
  const isLeft = side === "left";
  return (
    <motion.div
      className={[
        "absolute inset-y-0 flex w-[50.5%] items-center justify-center",
        isLeft ? "left-0" : "right-0",
      ].join(" ")}
      style={{
        transformOrigin: isLeft ? "left center" : "right center",
        backgroundImage: `${PLEATS}, ${FABRIC}`,
        boxShadow: isLeft
          ? "inset -40px 0 60px rgba(0,0,0,0.55)"
          : "inset 40px 0 60px rgba(0,0,0,0.55)",
        ...(isLeft
          ? { borderRight: "3px solid color-mix(in srgb, var(--color-ey-yellow) 70%, transparent)" }
          : { borderLeft: "3px solid color-mix(in srgb, var(--color-ey-yellow) 70%, transparent)" }),
      }}
      initial={reduced ? { opacity: 0 } : { x: isLeft ? "-102%" : "102%" }}
      animate={reduced ? { opacity: 1 } : { x: "0%" }}
      exit={
        reduced
          ? { opacity: 0, transition: open }
          : {
              rotateY: isLeft ? -105 : 105,
              x: isLeft ? "-6%" : "6%",
              opacity: 0.85,
              transition: open,
            }
      }
      transition={close}
    >
      {/* Roaming sheen — the "light catching the fabric" 3D cue */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-[30%]"
          style={{
            background:
              "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.09) 45%, rgba(139,92,246,0.14) 55%, transparent 100%)",
          }}
          initial={{ left: "-35%" }}
          animate={{ left: "105%" }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: isLeft ? 0.4 : 1.1 }}
        />
      )}
      <motion.div
        initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduced ? 0.15 : 0.5, duration: durations.slow }}
        className="relative"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default Curtain;
