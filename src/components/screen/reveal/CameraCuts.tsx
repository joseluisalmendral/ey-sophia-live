"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Crown } from "../Crown";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import type { RankedTeam } from "@/lib/types";

/**
 * CameraCuts — the videogame-style champion presentation: after the curtain
 * opens, the cosmic stage goes PURE BLACK and three camera shots play over a
 * CSS-3D "scene" of the winner(s), like a victory screen in an esports title:
 *
 *   SHOT 1 (camLow)   — dramatic LOW-ANGLE: a beveled monolith in the team
 *                       color rises seen from below through volumetric god
 *                       rays and floating dust; a specular sweep runs down its
 *                       face and the camera micro-shakes when it locks in.
 *   SHOT 2 (camDolly) — LATERAL DOLLY: the winner's name, gigantic, whips
 *                       across frame with motion-blur trails, chromatic-offset
 *                       ghost outlines, speed lines, and a broadcast HUD
 *                       carrying the vote count.
 *   SHOT 3 (camHero)  — FRONTAL HERO: spring punch-in with overshoot, radial
 *                       shockwave rings on landing, a team-color lens flare,
 *                       and the crown dropping onto the name with a physical
 *                       bounce. The parent fires the winner sting on this cut.
 *
 * EDITING GRAMMAR (v3): shot changes are no longer dry cuts — each edit is a
 * WHIP-PAN: the incoming shot slides in fast with a directional-blur streak
 * overlay and a 2-frame chromatic flash (red/cyan tinted plates), so the eye
 * reads camera movement, not a slideshow. The exit onto the podium is a
 * PULL-BACK: the hero scene recedes (scale-down + fade) while the letterbox
 * bars retract, and the podium rises underneath in continuity.
 *
 * Cinematic letterbox bars frame all three shots. Everything animates
 * transform/opacity only — the few blur() filters live on SMALL offscreen-safe
 * elements (name trails, streak overlays), never full-screen and never
 * sustained — so a projector laptop holds 60fps.
 *
 * Double crown: both co-winners appear in every shot (twin monoliths, stacked
 * travelling names, side-by-side hero). This component is never mounted for
 * reduced motion or zero votes — the parent skips the beat entirely.
 */

export interface CameraCutsProps {
  winners: RankedTeam[];
  /** Total votes in the poll — shown on the shot-2 broadcast HUD. */
  totalVotes: number;
  /** Seconds per shot, from reveal constants. */
  timings: { camLow: number; camDolly: number; camHero: number };
}

type Shot = 1 | 2 | 3;

/** Whip-pan direction per incoming shot (1 has no whip — the curtain reveals it). */
const WHIP_DIR: Record<Shot, 1 | -1> = { 1: 1, 2: -1, 3: 1 };

export function CameraCuts({ winners, totalVotes, timings }: CameraCutsProps) {
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
      exit={{ opacity: 0, transition: { duration: 0.65, ease: "easeIn" } }}
      aria-hidden
    >
      {/* PULL-BACK wrapper: on exit the whole scene recedes while the podium
          rises underneath — the CAM 3 -> podium handover reads as one move. */}
      <motion.div
        className="absolute inset-0"
        exit={{
          scale: 0.9,
          opacity: 0,
          transition: { duration: 0.65, ease: [0.3, 0, 0.6, 1] },
        }}
      >
        {/* The three shots — one mounted at a time; each mounts with its own
            speed-ramp settle so the whip-pan lands INTO the frame. */}
        {shot === 1 && <ShotLowAngle winners={winners} seconds={timings.camLow} />}
        {shot === 2 && (
          <ShotDolly winners={winners} totalVotes={totalVotes} seconds={timings.camDolly} />
        )}
        {shot === 3 && <ShotHero winners={winners} seconds={timings.camHero} />}
      </motion.div>

      {/* WHIP-PAN transition — directional blur streak + chromatic flash. */}
      {shot !== 1 && <WhipPan key={`whip-${shot}`} dir={WHIP_DIR[shot]} />}

      {/* Cinematic letterbox bars. */}
      <motion.div
        className="absolute inset-x-0 top-0 z-10 bg-black"
        style={{ height: "9vh", boxShadow: "0 1px 0 rgba(255,255,255,0.08)" }}
        initial={{ y: "-100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "-100%", transition: { duration: 0.65, ease: [0.3, 0, 0.4, 1] } }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-10 bg-black"
        style={{ height: "9vh", boxShadow: "0 -1px 0 rgba(255,255,255,0.08)" }}
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "100%", transition: { duration: 0.65, ease: [0.3, 0, 0.4, 1] } }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
      />

      {/* Broadcast shot marker — kept: it anchors the "live coverage" visual
          language. Refined to mono type with a subtle REC blink. */}
      <motion.div
        className="absolute bottom-[3.2vh] right-[3vw] z-20 flex items-center gap-2.5 font-mono text-[clamp(0.6rem,0.85vw,0.8rem)] font-medium uppercase tracking-[0.35em] text-white/45"
        exit={{ opacity: 0, transition: { duration: 0.25 } }}
      >
        <motion.span
          className="inline-block h-[7px] w-[7px] rounded-full bg-red-500"
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <span>Cam 0{shot}/03</span>
      </motion.div>
    </motion.div>
  );
}

/**
 * WhipPan — one-shot transition overlay: a directional blur streak sweeps
 * across frame while two chromatic plates (red/cyan) flash for ~2 frames.
 * The blur lives on a narrow streak element, never the full frame.
 */
function WhipPan({ dir }: { dir: 1 | -1 }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {/* Directional blur streak. */}
      <motion.div
        className="absolute inset-y-0 w-[60vw]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 35%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 65%, transparent 100%)",
          filter: "blur(10px)",
        }}
        initial={{ x: dir === 1 ? "110vw" : "-60vw", scaleX: 1.6 }}
        animate={{ x: dir === 1 ? "-60vw" : "110vw", scaleX: 1 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0.2, 1] }}
      />
      {/* Chromatic flash plates — opposite micro-offsets sell the aberration. */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "rgba(255,40,40,0.14)" }}
        initial={{ opacity: 1, x: dir * 10 }}
        animate={{ opacity: 0, x: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />
      <motion.div
        className="absolute inset-0"
        style={{ background: "rgba(40,220,255,0.12)" }}
        initial={{ opacity: 1, x: dir * -10 }}
        animate={{ opacity: 0, x: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />
      {/* White pop on the exact edit frame. */}
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0.3 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
      />
    </div>
  );
}

/** Deterministic pseudo-random in [0,1) — same dust field on every projector. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** SHOT 1 — low-angle beveled monolith(s) rising through god rays and dust. */
function ShotLowAngle({ winners, seconds }: { winners: RankedTeam[]; seconds: number }) {
  const riseSeconds = seconds * 0.7;
  const accent = winners[0]?.color ?? "#fff";

  return (
    <motion.div
      className="absolute inset-0"
      // Speed-ramp settle: the shot lands slightly wide and eases into place.
      initial={{ scale: 1.05, x: "1.5%" }}
      animate={{ scale: 1, x: "0%" }}
      transition={{ duration: 0.5, ease: [0.2, 0, 0.2, 1] }}
    >
      {/* Volumetric god rays — skewed light shafts breathing from above. */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={`ray-${i}`}
          className="pointer-events-none absolute -top-[10vh] h-[120vh] w-[14vw] origin-top"
          style={{
            left: `${16 + i * 20}%`,
            background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 26%, rgba(255,255,255,0.10)) 0%, transparent 78%)`,
            transform: `skewX(${i % 2 === 0 ? -14 : -9}deg)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0.28, 0.45] }}
          transition={{ duration: seconds, times: [0, 0.35, 0.7, 1], ease: "easeInOut", delay: i * 0.12 }}
        />
      ))}

      {/* Floating dust motes drifting up through the rays. */}
      {Array.from({ length: 16 }, (_, i) => (
        <motion.span
          key={`dust-${i}`}
          className="pointer-events-none absolute rounded-full bg-white"
          style={{
            width: 2 + Math.round(seeded(i) * 2),
            height: 2 + Math.round(seeded(i) * 2),
            left: `${6 + seeded(i * 3 + 1) * 88}%`,
            top: `${25 + seeded(i * 5 + 2) * 65}%`,
          }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 0.55 * (0.4 + seeded(i * 7)), 0], y: -40 - seeded(i * 11) * 60 }}
          transition={{
            duration: 2 + seeded(i * 13) * 1.5,
            repeat: Infinity,
            ease: "linear",
            delay: seeded(i * 17) * 1.2,
          }}
        />
      ))}

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

        {/* Camera body: slow push-in + tilt, then a MICRO-SHAKE the instant the
            monolith locks in — the "impact frame". Transform-only. */}
        <motion.div
          className="absolute inset-0 flex items-end justify-center"
          animate={{ x: [0, 0, -7, 6, -3, 2, 0], y: [0, 0, 5, -4, 2, -1, 0] }}
          transition={{
            duration: 0.42,
            delay: riseSeconds,
            times: [0, 0.01, 0.2, 0.45, 0.65, 0.85, 1],
            ease: "easeOut",
          }}
        >
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
                className="relative flex w-[clamp(14rem,26vw,24rem)] flex-col items-center justify-start overflow-hidden rounded-t-2xl"
                style={{
                  height: "78vh",
                  transformOrigin: "bottom center",
                  rotateX: 18,
                  background: `linear-gradient(180deg, color-mix(in srgb, ${w.color} 90%, #fff) 0%, ${w.color} 45%, color-mix(in srgb, ${w.color} 40%, #000) 100%)`,
                  // Bevel: bright top lip + side edge highlights, dark inner base.
                  boxShadow: [
                    `0 0 90px color-mix(in srgb, ${w.color} 55%, transparent)`,
                    "inset 0 4px 0 rgba(255,255,255,0.55)",
                    "inset 3px 0 0 rgba(255,255,255,0.22)",
                    "inset -3px 0 0 rgba(0,0,0,0.35)",
                    "inset 0 -60px 80px rgba(0,0,0,0.35)",
                  ].join(", "),
                }}
                initial={{ y: "85%" }}
                animate={{ y: "12%" }}
                transition={{ duration: riseSeconds, ease: [0.2, 0, 0, 1], delay: i * 0.15 }}
              >
                {/* Specular sweep — light raking down the polished face. */}
                <motion.div
                  className="pointer-events-none absolute inset-x-0 h-[26%]"
                  style={{
                    background:
                      "linear-gradient(175deg, transparent 0%, rgba(255,255,255,0.34) 45%, rgba(255,255,255,0.08) 60%, transparent 100%)",
                  }}
                  initial={{ top: "-30%", opacity: 0 }}
                  animate={{ top: "110%", opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.1, delay: riseSeconds + 0.15 + i * 0.15, ease: "easeInOut" }}
                />
                <span
                  className="mt-[clamp(1rem,3vh,2rem)] max-w-[90%] truncate font-display text-[clamp(1.6rem,3.2vw,3.2rem)] font-black uppercase tracking-tight"
                  style={{ color: "rgba(0,0,0,0.72)" }}
                >
                  {w.name}
                </span>
              </motion.div>
            ))}
          </motion.div>
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
    </motion.div>
  );
}

/** SHOT 2 — lateral dolly: motion-blur trails, chromatic ghosts, speed lines, HUD. */
function ShotDolly({
  winners,
  totalVotes,
  seconds,
}: {
  winners: RankedTeam[];
  totalVotes: number;
  seconds: number;
}) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-start justify-center overflow-hidden"
      // Speed-ramp settle out of the whip-pan.
      initial={{ x: "4%", scale: 1.04 }}
      animate={{ x: "0%", scale: 1 }}
      transition={{ duration: 0.45, ease: [0.2, 0, 0.2, 1] }}
    >
      {/* Speed lines — thin horizontal streaks, the fastest layer in frame. */}
      {Array.from({ length: 6 }, (_, i) => (
        <motion.div
          key={`speed-${i}`}
          className="pointer-events-none absolute h-[2px] w-[34vw]"
          style={{
            top: `${12 + seeded(i * 9 + 4) * 76}%`,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
          }}
          initial={{ x: i % 2 === 0 ? "110vw" : "120vw" }}
          animate={{ x: "-40vw" }}
          transition={{
            duration: 0.5 + seeded(i * 21) * 0.35,
            repeat: Infinity,
            ease: "linear",
            delay: seeded(i * 23) * 0.6,
          }}
        />
      ))}

      {winners.map((w, i) => {
        const reverse = i % 2 === 1;
        return (
          <div key={w.id} className="relative w-full" style={{ height: winners.length > 1 ? "38vh" : "60vh" }}>
            {/* Parallax BACK layer — ghost outline with CHROMATIC OFFSET copies. */}
            {[
              { dx: "0.45vh", color: "rgba(255,60,60,0.5)", z: 0 },
              { dx: "-0.45vh", color: "rgba(60,220,255,0.5)", z: 0 },
              { dx: "0vh", color: `color-mix(in srgb, ${w.color} 45%, transparent)`, z: 1 },
            ].map((layer, li) => (
              <motion.span
                key={`ghost-${li}`}
                className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-display font-black uppercase leading-none"
                style={{
                  fontSize: winners.length > 1 ? "16vh" : "26vh",
                  color: "transparent",
                  WebkitTextStroke: `2px ${layer.color}`,
                  translate: layer.dx,
                  zIndex: layer.z,
                }}
                initial={{ x: reverse ? "-60%" : "10%" }}
                animate={{ x: reverse ? "-30%" : "-20%" }}
                transition={{ duration: seconds, ease: "linear" }}
              >
                {w.name} {w.name}
              </motion.span>
            ))}

            {/* MOTION-BLUR TRAILS — blurred duplicates lagging behind the name.
                Small blur on text-sized elements only, never full frame. */}
            {[
              { lagFrom: reverse ? "-83%" : "43%", lagTo: reverse ? "-3%" : "-37%", blur: 10, opacity: 0.18 },
              { lagFrom: reverse ? "-79%" : "39%", lagTo: reverse ? "1%" : "-41%", blur: 5, opacity: 0.34 },
            ].map((trail, ti) => (
              <motion.span
                key={`trail-${ti}`}
                className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-display font-black uppercase leading-none"
                style={{
                  fontSize: winners.length > 1 ? "20vh" : "32vh",
                  color: w.color,
                  opacity: trail.opacity,
                  filter: `blur(${trail.blur}px)`,
                }}
                initial={{ x: trail.lagFrom }}
                animate={{ x: trail.lagTo }}
                transition={{ duration: seconds, ease: "linear" }}
              >
                {w.name}
              </motion.span>
            ))}

            {/* Parallax FRONT layer — solid name, fastest. */}
            <motion.span
              className="absolute top-1/2 z-10 -translate-y-1/2 whitespace-nowrap font-display font-black uppercase leading-none"
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

            {/* Light streak — sells the dolly speed. */}
            <motion.div
              className="pointer-events-none absolute inset-y-0 z-10 w-[45vw]"
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

      {/* Broadcast HUD — vote count sliding past like telemetry. */}
      <motion.div
        className="pointer-events-none absolute left-[4vw] top-[13vh] z-20 flex items-center gap-3 font-mono text-[clamp(0.7rem,1vw,1rem)] font-medium uppercase tracking-[0.3em] text-white/60"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <span className="inline-block h-[1px] w-[3vw] bg-white/40" />
        <span>
          {totalVotes} {totalVotes === 1 ? "voto" : "votos"} · recuento final
        </span>
      </motion.div>
    </motion.div>
  );
}

/** SHOT 3 — frontal hero: overshoot punch-in, shockwave, lens flare, crown drop. */
function ShotHero({ winners, seconds }: { winners: RankedTeam[]; seconds: number }) {
  const accent = winners[0]?.color ?? "#fff";
  // The punch-in spring lands ~0.45s in; shockwave + flare sync to that frame.
  const landing = 0.4;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Radial team glow behind the hero. */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 55%, ${accent} 0%, transparent 55%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.32 }}
        transition={{ duration: 0.6 }}
      />

      {/* SHOCKWAVE — expanding rings fired on the punch-in landing. */}
      {[0, 1].map((i) => (
        <motion.div
          key={`shock-${i}`}
          className="pointer-events-none absolute left-1/2 top-[55%] rounded-full"
          style={{
            width: "30vmin",
            height: "30vmin",
            translate: "-50% -50%",
            border: `3px solid color-mix(in srgb, ${accent} ${70 - i * 25}%, #fff)`,
          }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: 3.4 + i * 0.8, opacity: [0, 0.75 - i * 0.25, 0] }}
          transition={{ duration: 0.9 + i * 0.2, delay: landing + i * 0.1, ease: [0.1, 0.6, 0.3, 1] }}
        />
      ))}

      {/* LENS FLARE — team-color core + horizontal streak, pops on landing. */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[38%]"
        style={{ translate: "-50% -50%" }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0.35], scale: [0.4, 1.15, 1] }}
        transition={{ duration: 1.4, delay: landing, times: [0, 0.25, 1], ease: "easeOut" }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[3px] w-[70vw]"
          style={{
            translate: "-50% -50%",
            background: `linear-gradient(90deg, transparent 0%, color-mix(in srgb, ${accent} 80%, #fff) 50%, transparent 100%)`,
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[18vmin] w-[18vmin] rounded-full"
          style={{
            translate: "-50% -50%",
            background: `radial-gradient(circle, color-mix(in srgb, ${accent} 65%, #fff) 0%, color-mix(in srgb, ${accent} 30%, transparent) 40%, transparent 70%)`,
          }}
        />
      </motion.div>

      {/* PUNCH-IN — spring with real overshoot, then a slow live drift. */}
      <motion.div
        className="flex items-center justify-center gap-[5vw]"
        initial={{ scale: 1.45, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 210, damping: 15, mass: 0.9 }}
      >
        <motion.div
          className="flex items-center justify-center gap-[5vw]"
          animate={{ scale: [1, 1.045] }}
          transition={{ duration: seconds, ease: "linear" }}
        >
          {winners.map((w, i) => (
            <div key={w.id} className="flex flex-col items-center gap-4 text-center">
              {/* CROWN DROP — falls from above the frame and lands with a
                  physical bounce, right after the punch-in settles. */}
              <motion.div
                initial={{ y: "-42vh", opacity: 0, rotate: -10 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 13,
                  mass: 1.1,
                  delay: landing + 0.15 + i * 0.12,
                }}
              >
                <Crown size={winners.length > 1 ? 120 : 150} delay={0} reduced />
              </motion.div>
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
      </motion.div>
    </div>
  );
}

export default CameraCuts;
