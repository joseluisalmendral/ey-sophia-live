/**
 * rem-sized TeamColorChip override (the chip takes px; projector chips must
 * scale with the projector root font so 4K frames keep their proportions).
 */
export function chipRem(rem: number) {
  return { width: `${rem}rem`, height: `${rem}rem`, fontSize: `${rem * 0.5}rem` };
}
