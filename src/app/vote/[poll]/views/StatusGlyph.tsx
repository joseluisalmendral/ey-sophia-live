"use client";

import { motion } from "motion/react";

/**
 * StatusGlyph — the icon disc used by the neutral end states (already voted,
 * closed): glass circle, tinted ring, soft pop-in. Reduced motion: fade.
 */
export function StatusGlyph({
  children,
  tone,
  reduced,
}: {
  children: React.ReactNode;
  /** Ring / icon colour (CSS colour). */
  tone: string;
  reduced: boolean;
}) {
  return (
    <motion.div
      aria-hidden
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduced ? { duration: 0.2 } : { type: "spring", stiffness: 320, damping: 20 }
      }
      className="flex h-24 w-24 items-center justify-center rounded-full"
      style={{
        color: tone,
        background: `radial-gradient(circle at 50% 35%, color-mix(in oklab, ${tone} 16%, #10173a), #080c22 75%)`,
        boxShadow: `inset 0 0 0 2px color-mix(in oklab, ${tone} 60%, transparent), 0 0 40px -10px color-mix(in oklab, ${tone} 50%, transparent)`,
      }}
    >
      {children}
    </motion.div>
  );
}
