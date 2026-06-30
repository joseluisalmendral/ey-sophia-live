import type { CSSProperties } from "react";
import { pickTextOn } from "@/lib/utils/contrast";

/**
 * TeamColorChip — a small team-identity swatch.
 *
 * Renders the team color as a filled chip; when `label` is supplied (e.g. the
 * team initial) the text color is chosen via `pickTextOn` so it is always
 * legible on an arbitrary brand hue. A subtle inner ring keeps the chip visible
 * even on near-black or near-white team colors against the cosmic base.
 */

export interface TeamColorChipProps {
  color: string;
  /** Optional short label drawn inside the chip (e.g. a team initial). */
  label?: string;
  /** Diameter in px. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function TeamColorChip({
  color,
  label,
  size = 20,
  className,
  style,
}: TeamColorChipProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold",
        "ring-1 ring-inset ring-white/25",
        className ?? "",
      ].join(" ")}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        color: pickTextOn(color),
        fontSize: Math.round(size * 0.5),
        ...style,
      }}
    >
      {label}
    </span>
  );
}

export default TeamColorChip;
