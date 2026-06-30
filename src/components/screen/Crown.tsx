"use client";

import { motion } from "motion/react";
import { springs } from "@/lib/motion/tokens";

/**
 * Crown — a premium SVG crown that DROPS onto the winner at podium landing.
 *
 * We render our own crown (no Lottie asset dependency to block on): an EY-yellow
 * five-point crown with jewel dots and a soft glow. It drops from above with the
 * podiumRise spring and a tiny overshoot, then a gentle idle float. Under
 * reduced motion it simply fades in, static (no drop, no float).
 */

export interface CrownProps {
  /** px height of the crown. */
  size?: number;
  /** Delay before the drop, to sync with the podium landing. */
  delay?: number;
  reduced: boolean;
}

export function Crown({ size = 96, delay = 0, reduced }: CrownProps) {
  if (reduced) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: 0.3 }}
        style={{ width: size, height: size }}
      >
        <CrownSvg size={size} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: -180, opacity: 0, rotate: -12, scale: 0.6 }}
      animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
      transition={{ ...springs.podiumRise, delay }}
      style={{ width: size, height: size }}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay + 0.8,
        }}
      >
        <CrownSvg size={size} />
      </motion.div>
    </motion.div>
  );
}

function CrownSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="Ganador"
      style={{ filter: "drop-shadow(0 0 24px rgba(255,230,0,0.55))" }}
    >
      <title>Corona del ganador</title>
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3A0" />
          <stop offset="45%" stopColor="#FFE600" />
          <stop offset="100%" stopColor="#E6B800" />
        </linearGradient>
      </defs>
      {/* Crown body: five points rising to peaks, valleys between. */}
      <path
        d="M16 86 L24 40 L42 64 L60 30 L78 64 L96 40 L104 86 Z"
        fill="url(#crownGold)"
        stroke="#FFF7C4"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Base band */}
      <rect x="16" y="86" width="88" height="16" rx="4" fill="url(#crownGold)" stroke="#FFF7C4" strokeWidth="2.5" />
      {/* Jewels on the peaks */}
      <circle cx="24" cy="40" r="5" fill="#7DB8FF" stroke="#fff" strokeWidth="1.5" />
      <circle cx="60" cy="30" r="6" fill="#96d3b4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="96" cy="40" r="5" fill="#7DB8FF" stroke="#fff" strokeWidth="1.5" />
      {/* Band gems */}
      <circle cx="38" cy="94" r="3" fill="#0B1026" opacity="0.55" />
      <circle cx="60" cy="94" r="3.5" fill="#0B1026" opacity="0.55" />
      <circle cx="82" cy="94" r="3" fill="#0B1026" opacity="0.55" />
    </svg>
  );
}

export default Crown;
