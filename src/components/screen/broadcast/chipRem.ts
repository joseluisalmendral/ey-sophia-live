import { chipFontFactor } from "@/components/atoms/TeamColorChip";

/**
 * rem-sized TeamColorChip override (the chip takes px; projector chips must
 * scale with the projector root font so 4K frames keep their proportions).
 * Pass the label so multi-character initials ("A3", "ER") keep the same
 * length-aware type size the chip uses in px.
 */
export function chipRem(rem: number, label?: string) {
  return { width: `${rem}rem`, height: `${rem}rem`, fontSize: `${rem * chipFontFactor(label)}rem` };
}
