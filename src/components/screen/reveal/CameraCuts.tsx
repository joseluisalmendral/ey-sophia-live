"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Crown } from "../Crown";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import type { RankedTeam } from "@/lib/types";

/**
 * CameraCuts — the videogame-style champion presentation: after the curtain
 * opens, the cosmic stage goes PURE BLACK and three hard camera cuts play over
 * a CSS-3D "scene" of the winner(s), like a victory screen in an esports title:
 *
 *   SHOT 1 (camLow)   — dramatic LOW-ANGLE: a monolithic plinth in the team
 *                       color rises seen from below (strong perspective +
 *                       rotateX), lit from beneath by the team color.
 *   SHOT 2 (camDolly) — LATERAL DOLLY: the winner's name, gigantic, travels
 *                       across frame with parallax layers (ghost name behind
 *                       moving slower, light streaks in front moving faster).
 *   SHOT 3 (camHero)  — FRONTAL HERO: punch-in on crown + name, radial team
 *                       glow. The parent fires the winner sting on this cut.
 *
 * Cinematic letterbox bars frame all three shots; they retract when the
 * component exits onto the full podium. Cuts are HARD (no crossfade) with a
 * 2-frame flash to sell the edit. Everything animates transform/opacity only —
 * no layout, no filters — so a projector laptop holds 60fps.
 *
 * Double crown: both co-winners appear in every shot (twin monoliths, stacked
 * travelling names, side-by-side hero). This component is never mounted for
 * reduced motion or zero votes — the parent skips the beat entirely.
 */

export interface CameraCutsProps {
  winners: RankedTeam[];
  /** Seconds per shot, from reveal constants. */
  timings: { camLow: number; camDolly: number; camHero: number };
}

type Shot = 1 | 2 | 3;

export function CameraCuts({ winners, timings }: CameraCutsProps) {
  const [shot, setShot] = useState<Shot>(1);

  useEffect(() => {
    const t1 = setTimeout(() => setShot(2), timings.camLow * 1000);
    const t2 = setTimeout(
      () => setShot(3),
      (timings.camLow + timings.camDolly) * 1000,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [timings.camLow, timings.camDolly]);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
      aria-hidden
    >
      {/* The three shots — hard cuts, one mounted at a time. */}
      {shot === 1 && <ShotLowAngle winners={winners} seconds={timings.camLow} />}
      {shot === 2 && <ShotDolly winners={winners} seconds={timings.camDolly} />}
      {shot === 3 && <ShotHero winners={winners} seconds={timings.camHero} />}

      {/* Cut flash — sells the hard edit on every shot change. */}
      <motion.div
        key={`flash-${shot}`}
        className="pointer-events-none absolute inset-0 bg-white"
        initial={{ opacity: shot === 1 ? 0 : 0.22 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />

      {/* Cinematic letterbox bars. */}
      <motion.div
        className="absolute inset-x-0 top-0 z-10 bg-black"
        style={{ height: "9vh", boxShadow: "0 1px 0 rgba(255,255,255,0.08)" }}
        initial={{ y: "-100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "-100%" }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-10 bg-black"
        style={{ height: "9vh", boxShadow: "0 -1px 0 rgba(255,255,255,0.08)" }}
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
      />

      {/* REC-style shot marker, bottom-right over the bar. */}
      <div className="absolute bottom-[3vh] right-[3vw] z-20 flex items-center gap-2 text-[clamp(0.6rem,0.9vw,0.85rem)] font-bold uppercase tracking-[0.3em] text-white/50">
        <motion.span
          className="inline-block h-2 w-2 rounded-full bg-red-500"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        Cam {shot} / 3
      </div>
    </motion.div>
  );
}

/** SHOT 1 — low-angle monolith(s) rising, lit from below by the team color. */
function ShotLowAngle({ winners, seconds }: { winners: RankedTeam[]; seconds: number }) {
  return (
    <div
      className="absolute inset-0 flex items-end justify-center"
      style={{ perspective: "700px", perspectiveOrigin: "50% 85%" }}
    >
      {/* Under-light wash in the winner color(s). */}
      {winners.map((w, i) => (
        <motion.div
          key={`glow-${w.id}`}
          className="pointer-events-none absolute bottom-0 h-[55vh] w-[70vw]"
          style={{
            left: winners.length > 1 ? `${12 + i * 40}%` : "15%",
            background: `radial-gradient(ellipse at 50% 100%, ${w.color} 0%, transparent 65%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55 }}
          transition={{ duration: 0.8 }}
        />
      ))}

      {/* Camera drift: slow push-in + tilt, transform-only. */}
      <motion.div
        className="flex items-end justify-center gap-[6vw]"
        style={{ transformStyle: "preserve-3d" }}
        initial={{ scale: 1, rotateX: 0 }}
        animate={{ scale: 1.12, rotateX: -3 }}
        transition={{ duration: seconds, ease: "linear" }}
      >
        {winners.map((w, i) => (
          <motion.div
            key={w.id}
            className="relative flex w-[clamp(14rem,26vw,24rem)] flex-col items-center justify-start rounded-t-2xl"
            style={{
              height: "78vh",
              transformOrigin: "bottom center",
              rotateX: 18,
              background: `linear-gradient(180deg, color-mix(in srgb, ${w.color} 90%, #fff) 0%, ${w.color} 45%, color-mix(in srgb, ${w.color} 40%, #000) 100%)`,
              boxShadow: `0 0 90px color-mix(in srgb, ${w.color} 55%, transparent)`,
            }}
            initial={{ y: "85%" }}
            animate={{ y: "12%" }}
            transition={{ duration: seconds * 0.75, ease: [0.2, 0, 0, 1], delay: i * 0.15 }}
          >
            <span
              className="mt-[clamp(1rem,3vh,2rem)] max-w-[90%] truncate font-display text-[clamp(1.6rem,3.2vw,3.2rem)] font-black uppercase tracking-tight"
              style={{ color: "rgba(0,0,0,0.72)" }}
            >
              {w.name}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Kicker line. */}
      <motion.span
        className="absolute top-[14vh] left-1/2 -translate-x-1/2 text-[clamp(0.8rem,1.3vw,1.2rem)] font-bold uppercase tracking-[0.5em] text-white/70"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {winners.length > 1 ? "Campeones" : "Campeón"}
      </motion.span>
    </div>
  );
}

/** SHOT 2 — lateral dolly: giant travelling name(s) with parallax layers. */
function ShotDolly({ winners, seconds }: { winners: RankedTeam[]; seconds: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-start justify-center overflow-hidden">
      {winners.map((w, i) => {
        const reverse = i % 2 === 1;
        return (
          <div key={w.id} className="relative w-full" style={{ height: winners.length > 1 ? "38vh" : "60vh" }}>
            {/* Parallax BACK layer — ghost name, slower, dimmer. */}
            <motion.span
              className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-display font-black uppercase leading-none"
              style={{
                fontSize: winners.length > 1 ? "16vh" : "26vh",
                color: "transparent",
                WebkitTextStroke: `2px color-mix(in srgb, ${w.color} 45%, transparent)`,
              }}
              initial={{ x: reverse ? "-60%" : "10%" }}
              animate={{ x: reverse ? "-30%" : "-20%" }}
              transition={{ duration: seconds, ease: "linear" }}
            >
              {w.name} {w.name}
            </motion.span>
            {/* Parallax FRONT layer — solid name, faster. */}
            <motion.span
              className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-display font-black uppercase leading-none"
              style={{
                fontSize: winners.length > 1 ? "20vh" : "32vh",
                color: w.color,
                textShadow: `0 0 60px color-mix(in srgb, ${w.color} 60%, transparent)`,
              }}
              initial={{ x: reverse ? "-75%" : "35%" }}
              animate={{ x: reverse ? "5%" : "-45%" }}
              transition={{ duration: seconds, ease: "linear" }}
            >
              {w.name}
            </motion.span>
            {/* Light streaks — fastest layer, sells the dolly speed. */}
            <motion.div
              className="pointer-events-none absolute inset-y-0 w-[45vw]"
              style={{
                background:
                  "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.10) 48%, rgba(255,255,255,0.03) 55%, transparent 100%)",
              }}
              initial={{ x: reverse ? "110vw" : "-45vw" }}
              animate={{ x: reverse ? "-45vw" : "110vw" }}
              transition={{ duration: seconds * 0.7, ease: "linear" }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** SHOT 3 — frontal hero: punch-in on crown + identity. Sting lands here. */
function ShotHero({ winners, seconds }: { winners: RankedTeam[]; seconds: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Radial team glow behind the hero. */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 55%, ${winners[0]?.color ?? "#fff"} 0%, transparent 55%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.32 }}
        transition={{ duration: 0.6 }}
      />
      {/* Punch-in: lands hard, then keeps a slow drift so it never freezes. */}
      <motion.div
        className="flex items-center justify-center gap-[5vw]"
        initial={{ scale: 1.35, opacity: 0.6 }}
        animate={{ scale: [1.35, 1, 1.04] }}
        transition={{ duration: seconds, times: [0, 0.22, 1], ease: ["circOut", "linear"] }}
        style={{ opacity: 1 }}
      >
        {winners.map((w, i) => (
          <div key={w.id} className="flex flex-col items-center gap-4 text-center">
            <Crown size={winners.length > 1 ? 120 : 150} delay={0.15 + i * 0.1} reduced={false} />
            <TeamColorChip
              color={w.color}
              label={w.name.charAt(0).toUpperCase()}
              size={winners.length > 1 ? 64 : 80}
            />
            <span
              className="max-w-[42vw] truncate font-display font-black leading-none"
              style={{
                fontSize: winners.length > 1 ? "clamp(2.4rem,5.5vw,5.5rem)" : "clamp(3rem,8vw,8rem)",
                color: "var(--color-ey-yellow)",
                textShadow: `0 0 50px color-mix(in srgb, ${w.color} 70%, transparent)`,
              }}
            >
              {w.name}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default CameraCuts;
