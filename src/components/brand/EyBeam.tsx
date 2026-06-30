import type { CSSProperties } from "react";

/**
 * EyBeam — an inspired-by recreation of the EY mark.
 *
 * Bold "EY" wordmark with three ascending yellow parallelogram bands fanning to
 * the right (Input -> Inflection -> Output), each skewed ~33deg and growing in
 * length as they rise. The bands are ALWAYS EY Yellow (#FFE600) and never
 * altered; only the letters flip between off-black (on light) and white (on dark).
 *
 * NOTE: This is a recreation for development. Swap in the official EY asset from
 * the EY brand team before the real event.
 */

const EY_YELLOW = "#FFE600";
const LETTER_ON_LIGHT = "#2E2E38"; // EY off-black
const LETTER_ON_DARK = "#FFFFFF";

export interface EyBeamProps {
  /** Which surface the mark sits on; controls letter color. Bands are always yellow. */
  surface?: "light" | "dark";
  /** Rendered height in px (width scales by the 240:120 viewBox ratio). */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; set to "" to mark decorative (when a text label sits beside it). */
  label?: string;
}

export function EyBeam({
  surface = "dark",
  size = 48,
  className,
  style,
  label = "EY",
}: EyBeamProps) {
  const letterFill = surface === "light" ? LETTER_ON_LIGHT : LETTER_ON_DARK;
  const decorative = label === "";

  // skewX(-33deg) ~ horizontal offset of 0.649 per unit of height.
  // Bands stacked bottom-left (lowest) to top-right (highest), growing in length.
  const SKEW = 0.649;
  const bandHeight = 13;
  const bandGap = 8;
  const bandX = 138; // bands begin to the right of the "EY" letters

  // Each band: [top-y, length]. Lower index = lower + shorter (Input -> Output).
  // Lengths chosen so the longest (top) band stays inside the 240-wide viewBox
  // after skew + rightward fan (max x = bandX + 2*4 + length + SKEW*bandHeight).
  const bands: Array<[number, number]> = [
    [82, 52], // bottom band (Input)
    [82 - (bandHeight + bandGap), 67], // middle band (Inflection)
    [82 - 2 * (bandHeight + bandGap), 82], // top band (Output)
  ];

  return (
    <svg
      viewBox="0 0 240 120"
      height={size}
      width={size * (240 / 120)}
      className={className}
      style={style}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
    >
      {!decorative && <title>{label}</title>}

      {/* "EY" wordmark — bold, weight ~900 via thick strokes drawn as filled paths */}
      <g fill={letterFill}>
        {/* E */}
        <path d="M8 18 H64 V37 H32 V49 H58 V67 H32 V83 H64 V102 H8 Z" />
        {/* Y */}
        <path d="M70 18 H94 L108 44 L122 18 H146 L120 62 V102 H96 V62 Z" />
      </g>

      {/* Three ascending yellow parallelogram bands, fanning right at ~33deg */}
      <g fill={EY_YELLOW}>
        {bands.map(([topY, length], i) => {
          const x0 = bandX + i * 4; // slight rightward fan as bands rise
          const x1 = x0 + length;
          const skewTop = SKEW * bandHeight;
          // Parallelogram points: top-left, top-right, bottom-right, bottom-left
          const points = [
            `${x0 + skewTop},${topY}`,
            `${x1 + skewTop},${topY}`,
            `${x1},${topY + bandHeight}`,
            `${x0},${topY + bandHeight}`,
          ].join(" ");
          return <polygon key={i} points={points} />;
        })}
      </g>
    </svg>
  );
}

export default EyBeam;
