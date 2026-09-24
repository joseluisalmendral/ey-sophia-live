"use client";

/**
 * SpeechBubble — Broqui's line on the projector (spec §4.7, motion §C3).
 *
 * Presentational and self-placing: it renders the FULL text first (hidden) to
 * reserve the final size, shrinks the type if the copy would need a third
 * line, picks a side around the mascot that clears every keep-out
 * (`placeBubble`), then pops in from the tail and reveals the words one by
 * one at 90 ms/word. Timing of the dwell/exit is owned by the host (it also
 * drives Broqui's `talking` from `typingMs`).
 *
 * Reduced motion: fade only, text appears whole.
 */

import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { springs } from "@/lib/motion/tokens";
import {
  placeBubble,
  type BubblePlacement,
  type BubbleSide,
  type Pose,
  type Rect,
} from "./placement";
import "./speech-bubble.css";

export const WORD_MS = 90;
export const DWELL_MIN_MS = 2500;
export const DWELL_MAX_MS = 8000;
export const BUBBLE_EXIT_MS = 200;

export function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Word-by-word typing duration. */
export function typingMs(text: string, reduced = false): number {
  return reduced ? 0 : wordsOf(text).length * WORD_MS;
}

/** Dwell after typing: 1.5 s + chars/15 s, clamped to [2.5, 8] s. */
export function dwellMs(text: string): number {
  const chars = [...text].length;
  return Math.min(DWELL_MAX_MS, Math.max(DWELL_MIN_MS, 1500 + (chars / 15) * 1000));
}

export interface SpeechBubbleProps {
  text: string;
  /** Mascot pose + geometry (frame coordinates) at open time. */
  pose: Pose;
  baseSize: number;
  keepouts: readonly Rect[];
  frame: Rect;
  prefer: readonly BubbleSide[];
  maxWidthPx: number;
  /** 1080p scale factor of the frame. */
  k: number;
  reduced: boolean;
  onPlaced?: (placement: BubblePlacement) => void;
  onTypingEnd?: () => void;
}

const FONT_STEPS = [1, 0.86, 0.74] as const;
/** When no side clears the keep-outs, the card narrows itself (tight margins). */
const WIDTH_STEPS = [1, 0.78, 0.6, 0.48] as const;

export function SpeechBubble({
  text,
  pose,
  baseSize,
  keepouts,
  frame,
  prefer,
  maxWidthPx,
  k,
  reduced,
  onPlaced,
  onTypingEnd,
}: SpeechBubbleProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontStep, setFontStep] = useState(0);
  const [widthStep, setWidthStep] = useState(0);
  const [placement, setPlacement] = useState<BubblePlacement | null>(null);
  const [revealed, setRevealed] = useState(reduced ? Infinity : 0);
  const words = useMemo(() => wordsOf(text), [text]);

  // Geometry is frozen at open time (spec §C3: "recompute on each open, no
  // live re-flow"); the host mounts a fresh bubble per line.
  const [geo] = useState(() => ({ pose, keepouts, frame, prefer, baseSize }));
  const onPlacedRef = useRef(onPlaced);
  const onTypingEndRef = useRef(onTypingEnd);
  useEffect(() => {
    onPlacedRef.current = onPlaced;
    onTypingEndRef.current = onTypingEnd;
  });

  const fontPx = 38 * k * FONT_STEPS[fontStep];
  const lineHeightPx = fontPx * 1.15;
  const tailPx = Math.round(18 * k);
  const maxW = Math.round(maxWidthPx * WIDTH_STEPS[widthStep]);

  // Measure → shrink the type if > 2 lines → place → narrow the card if no
  // side is clear (then the type may shrink again) → place.
  useLayoutEffect(() => {
    const card = cardRef.current;
    const span = textRef.current;
    if (!card || !span) return;
    const lines = Math.round(span.getBoundingClientRect().height / lineHeightPx);
    if (lines > 2 && fontStep < FONT_STEPS.length - 1) {
      setFontStep(fontStep + 1);
      return;
    }
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const g = geo;
    const p = placeBubble({ w, h }, g.pose, g.baseSize, g.keepouts, g.frame, g.prefer, tailPx);
    if (!p.clear && widthStep < WIDTH_STEPS.length - 1) {
      setWidthStep(widthStep + 1);
      return;
    }
    setPlacement(p);
    onPlacedRef.current?.(p);
  }, [text, fontStep, widthStep, lineHeightPx, tailPx, geo]);

  // Word-by-word reveal once placed.
  useEffect(() => {
    if (!placement) return;
    if (reduced || words.length === 0) {
      // Whole text at once (initial `revealed` is already Infinity when reduced).
      const id = setTimeout(() => onTypingEndRef.current?.(), 0);
      return () => clearTimeout(id);
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= words.length) {
        clearInterval(id);
        onTypingEndRef.current?.();
      }
    }, WORD_MS);
    return () => clearInterval(id);
  }, [placement, reduced, words.length]);

  const origin = placement
    ? `${placement.tail.x}px ${placement.tail.y}px`
    : "50% 100%";

  return (
    <motion.div
      ref={cardRef}
      className="bubble"
      data-side={placement?.side ?? "left"}
      data-mascot-bubble=""
      data-clear={placement ? String(placement.clear) : "pending"}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 8 }}
      animate={placement ? { opacity: 1, scale: 1, y: 0 } : undefined}
      exit={reduced ? { opacity: 0, transition: { duration: 0.2 } } : { opacity: 0, scale: 0.92, y: 4, transition: { duration: BUBBLE_EXIT_MS / 1000, ease: [0.3, 0, 1, 1] } }}
      transition={reduced ? { duration: 0.2 } : springs.bubble}
      style={{
        left: placement ? placement.rect.x : 0,
        top: placement ? placement.rect.y : 0,
        visibility: placement ? "visible" : "hidden",
        transformOrigin: origin,
        maxWidth: maxW,
        width: "max-content",
        padding: `${Math.round(18 * k)}px ${Math.round(26 * k)}px`,
        fontSize: fontPx,
        ["--bubble-radius" as string]: `${Math.round(28 * k)}px`,
        ["--bubble-tail" as string]: `${tailPx}px`,
      }}
      aria-live="polite"
    >
      <span ref={textRef} className="bubble-text" data-mascot-bubble-text={text}>
        {words.map((w, i) => (
          <span key={`${i}-${w}`} className="bubble-word" data-hidden={i < revealed ? "false" : "true"}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
      {placement && (
        <span
          className="bubble-tail"
          aria-hidden
          style={
            placement.side === "left" || placement.side === "right"
              ? { top: placement.tail.y }
              : { left: placement.tail.x }
          }
        />
      )}
    </motion.div>
  );
}

export default SpeechBubble;
