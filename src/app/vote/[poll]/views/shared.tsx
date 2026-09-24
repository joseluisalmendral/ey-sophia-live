"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { EyBeam } from "@/components/brand/EyBeam";
import { durations, easings } from "@/lib/motion/tokens";

/**
 * Shared, purely presentational primitives for the vote views.
 *
 * These have NO business logic and NO hooks beyond `motion` — they receive
 * everything through props so each view stays a dumb render function.
 */

/** UI copy — single source of truth for the phone (es-ES, tú). */
export const COPY = {
  // Lobby
  lobbyKicker: "En breve",
  lobbyKickerCountdown: "Preparados…",
  lobbyTitle: "La votación abre en breve",
  lobbyHint: "Se abrirá aquí sola, sin recargar.",
  opensIn: "Abre en",
  finalists: "Los finalistas",
  howTitle: "Cómo va",
  howPick: "Elige",
  howHold: "Mantén pulsado",
  howWatch: "Mira la pantalla",
  // Voting
  voteTitle: "¿Quién se lleva tu voto?",
  pick: "Un solo voto. Sin vuelta atrás.",
  ctaPick: "Elige un equipo",
  ctaHold: "Mantén para votar a",
  ctaHint: "Mantén pulsado un momento",
  ctaA11y: "Mantén pulsado para confirmar",
  sending: "Enviando…",
  // Confirm / wait
  confirmHero: "¡Voto dentro!",
  confirmYour: "Tu voto por",
  confirmIn: "ya está en la carrera",
  watch: "Mira la pantalla grande",
  waitYour: "Tu voto",
  waitSub: "Tu voto ya está en la carrera.",
  // Already voted
  alreadyTitle: "Ya votaste",
  alreadySub: "Un voto por móvil. El tuyo ya cuenta.",
  // Closed
  closedTitle: "La votación ya cerró",
  closedSub: "Esta vez no llegaste a tiempo, pero mira la pantalla grande.",
  closedJustMissedTitle: "La votación se cerró justo antes de tu voto",
  closedJustMissedSub:
    "Por muy poco no llegó a contar. Gracias por participar: el resultado está a punto de salir.",
  // Personal result
  revealKicker: "Resultado final",
  revealRank: "Tu equipo quedó",
  revealChampion: "¡Campeones!",
  revealOf: (n: number) => `de ${n} finalistas`,
  revealHoldTitle: "El resultado sale allí primero…",
  revealHoldSub: "Después verás aquí el puesto de tu equipo.",
  votes: (n: number) => (n === 1 ? "1 voto" : `${n} votos`),
} as const;

/** Rank colours: gold (EY yellow) / silver / bronze / white. */
export function rankColor(rank: number): string {
  if (rank === 1) return "var(--color-ey-yellow)";
  if (rank === 2) return "#c4c4cd";
  if (rank === 3) return "#d08a4e";
  return "var(--color-text)";
}

export function ViewWrap({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: durations.base, ease: easings.standard }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

/**
 * PhoneHeader — compact 56 px brand row: EY beam + "IA HACKATHON" on the
 * left, thePower mark (monochrome white, no pill) on the right.
 */
export function PhoneHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <EyBeam surface="dark" size={28} label="EY" />
        <span className="truncate font-display text-[0.95rem] font-extrabold tracking-[0.04em] text-text">
          <span className="text-ey-yellow">IA</span> HACKATHON
        </span>
      </div>
      <Image
        src="/brand/thepower-logo.webp"
        alt="thePower"
        width={72}
        height={24}
        className="h-auto w-[72px] opacity-80 [filter:brightness(0)_invert(1)]"
      />
    </header>
  );
}

/** Kicker label (uppercase, tracked). */
export function Kicker({
  children,
  className = "text-ey-yellow",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-display text-m-label font-extrabold uppercase tracking-[0.22em] ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * WatchPill — "Mira la pantalla grande" with an up-arrow that nudges upward
 * (6 px loop). Reduced motion: static arrow.
 */
export function WatchPill({
  reduced,
  delay = 0,
}: {
  reduced: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: durations.base, ease: easings.decel }}
      className="inline-flex items-center gap-2.5 rounded-pill border border-ey-yellow/35 bg-ey-yellow/[0.07] py-2.5 pl-3 pr-5"
    >
      <motion.span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-full bg-ey-yellow text-ey-confident"
        animate={reduced ? undefined : { y: [0, -6, 0] }}
        transition={
          reduced
            ? undefined
            : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <ArrowUpIcon size={16} />
      </motion.span>
      <span className="font-display text-m-body font-extrabold text-ey-yellow">
        {COPY.watch}
      </span>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
 * Icons — inline SVG, 2 px stroke at 24 px, round caps, currentColor.
 * ------------------------------------------------------------------------ */

type IconProps = { size?: number; strokeWidth?: number };

function Svg({
  size = 24,
  strokeWidth = 2,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function CheckIcon({ size = 20, strokeWidth = 3 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <path d="M4 12.5 9.5 18 20 6" />
    </Svg>
  );
}

export function ArrowUpIcon({ size = 24, strokeWidth = 2.5 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
    </Svg>
  );
}

export function LockIcon({ size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </Svg>
  );
}

export function ClockIcon({ size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

/** Tap: a finger-tip dot with a ring (step 1 "Elige"). */
export function TapIcon({ size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" />
    </Svg>
  );
}

/** Hold: a ring filling around a dot (step 2 "Mantén pulsado"). */
export function HoldIcon({ size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.5" strokeOpacity={0.35} />
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Screen: a projector frame with an up tick (step 3 "Mira la pantalla"). */
export function ScreenIcon({ size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <rect x="3.5" y="4.5" width="17" height="11" rx="2" />
      <path d="M12 15.5v4M8.5 19.5h7" />
    </Svg>
  );
}
