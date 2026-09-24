"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { EyBeam } from "@/components/brand/EyBeam";
import { durations, easings } from "@/lib/motion/tokens";

/**
 * Curtain — the TELÓN beat: two 3D curtain panels (CSS perspective, pleated
 * fabric, gold seam trim, roaming sheen) slam shut over the stage. The left
 * panel carries the EY lockup: EY beam on top, "IA HACKATHON" on ONE line
 * ("IA" in the sophia accent + glow, "HACKATHON" white) sized to the panel
 * width with container-query units (never wraps, never overflows at any
 * projector width), and the tracked #EYBOOTCAMPFY27 tag. The right panel
 * carries thePower in the same container scale, so both lockups share one
 * optical centre line and rhythm. A pulsing "Y el equipo ganador es…" rides
 * the seam.
 *
 * Lockup entrance (after the panels land): beam → wordmark → tag rise in on
 * a 90 ms stagger (transform + opacity, decel); reduced motion fades.
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
      {/* LEFT panel — EY IA Hackathon lockup */}
      <CurtainPanel side="left" reduced={reduced} close={closeTransition} open={openTransition}>
        <Lockup reduced={reduced}>
          <EyBeam
            surface="dark"
            size={116}
            label="EY"
            style={{ height: "clamp(3rem, 15cqw, 14rem)", width: "clamp(6rem, 30cqw, 28rem)" }}
          />
          <span
            className="whitespace-nowrap font-display font-black leading-[0.9] tracking-[-0.01em] text-text"
            // 12 glyphs of Overpass Black ≈ 7.3 em (measured): 12.4 cqw
            // fills ~91 % of the lockup box at every width, never wider.
            style={{ fontSize: "12.4cqw" }}
          >
            <span className="text-sophia-accent glow-sophia">IA</span> HACKATHON
          </span>
          <span
            className="whitespace-nowrap font-display font-bold uppercase text-text-dim"
            style={{ fontSize: "2.8cqw", letterSpacing: "0.4em", marginRight: "-0.4em" }}
          >
            #EYBOOTCAMPFY27
          </span>
        </Lockup>
      </CurtainPanel>

      {/* RIGHT panel — thePower, same container scale as the EY lockup. */}
      <CurtainPanel side="right" reduced={reduced} close={closeTransition} open={openTransition}>
        <Lockup reduced={reduced}>
          <span
            className="inline-flex items-center bg-white shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
            style={{ padding: "3.2cqw 5cqw", borderRadius: "3cqw" }}
          >
            <Image
              src="/brand/thepower-logo.webp"
              alt="thePower"
              width={320}
              height={80}
              className="h-auto"
              style={{ width: "44cqw" }}
            />
          </span>
          <span
            className="whitespace-nowrap font-display font-bold uppercase text-text-dim"
            style={{ fontSize: "2.8cqw", letterSpacing: "0.4em", marginRight: "-0.4em" }}
          >
            en colaboración
          </span>
        </Lockup>
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
      {children}
    </motion.div>
  );
}

/**
 * Lockup — a centred column sized to 74 % of its panel and made an
 * inline-size container: every child sizes in `cqw`, so the whole lockup
 * scales as one piece with the panel (1280 → 3840 px) and never overflows.
 * Children rise in on a stagger once the panels have landed.
 */
function Lockup({ reduced, children }: { reduced: boolean; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div
      className="relative w-[74%]"
      style={{ containerType: "inline-size" }}
      data-mascot-keepout="curtain"
    >
      {/* cqw resolves against the nearest ANCESTOR container, so the gap
          lives on this inner column, not on the container itself. */}
      <div className="flex flex-col items-center text-center" style={{ gap: "4cqw" }}>
        {items.map((child, i) => (
          <motion.div
            key={i}
            className="flex max-w-full justify-center"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: (reduced ? 0.15 : 0.55) + (reduced ? 0 : i * 0.09),
              duration: reduced ? durations.base : durations.slow,
              ease: easings.decel,
            }}
          >
            {child}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default Curtain;
