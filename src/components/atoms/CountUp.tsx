"use client";

import NumberFlow from "@number-flow/react";

/**
 * CountUp — a NumberFlow wrapper for live-animating counters.
 *
 * NumberFlow ships its own reduced-motion handling (it respects the OS setting),
 * tabular-nums alignment, and digit-roll animation. This wrapper enforces
 * tabular numerals and a sensible default transition so all counters across the
 * app (vote tallies, winning scores) read consistently and never cause layout
 * shift.
 */

export interface CountUpProps {
  value: number;
  className?: string;
  /** Optional prefix/suffix (e.g. "%"). */
  prefix?: string;
  suffix?: string;
  "aria-label"?: string;
}

export function CountUp({
  value,
  className,
  prefix,
  suffix,
  "aria-label": ariaLabel,
}: CountUpProps) {
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      aria-label={ariaLabel}
      className={["tabular-nums", className ?? ""].join(" ")}
      // Snappy but legible roll; NumberFlow collapses this under reduced-motion.
      transformTiming={{ duration: 500, easing: "cubic-bezier(0.2,0,0,1)" }}
      spinTiming={{ duration: 600, easing: "cubic-bezier(0.2,0,0,1)" }}
    />
  );
}

export default CountUp;
