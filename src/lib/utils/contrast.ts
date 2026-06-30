/**
 * WCAG contrast utilities.
 *
 * Team colors are arbitrary brand hues chosen by admins, so legibility of any
 * text/checkmark drawn on top of a team color cannot rely on the hue. These
 * helpers compute the WCAG relative luminance of a background and pick the
 * foreground (black or white) that yields the higher contrast ratio.
 *
 * Reference: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

const BLACK = "#000";
const WHITE = "#fff";

/** Parse a #rgb / #rrggbb hex string into [r, g, b] in the 0-255 range. */
function parseHex(hex: string): [number, number, number] | null {
  let value = hex.trim().replace(/^#/, "");

  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (value.length !== 6 || /[^0-9a-fA-F]/.test(value)) {
    return null;
  }

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return [r, g, b];
}

/** Linearize a single 0-255 sRGB channel per the WCAG formula. */
function linearizeChannel(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white) for an [r, g, b] triplet. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return (
    0.2126 * linearizeChannel(r) +
    0.7152 * linearizeChannel(g) +
    0.0722 * linearizeChannel(b)
  );
}

/** WCAG contrast ratio between two luminance values (always >= 1). */
export function contrastRatio(lumA: number, lumB: number): number {
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick the text color ('#000' or '#fff') that meets WCAG AA (>= 4.5:1) against
 * `bgHex`, preferring whichever yields the higher ratio. Falls back to white on
 * an unparseable color (matches the dark, projector-first base).
 */
export function pickTextOn(bgHex: string): typeof BLACK | typeof WHITE {
  const rgb = parseHex(bgHex);
  if (!rgb) return WHITE;

  const bgLum = relativeLuminance(rgb);
  const blackLum = 0; // luminance of pure black
  const whiteLum = 1; // luminance of pure white

  const contrastWithBlack = contrastRatio(bgLum, blackLum);
  const contrastWithWhite = contrastRatio(bgLum, whiteLum);

  return contrastWithBlack >= contrastWithWhite ? BLACK : WHITE;
}
