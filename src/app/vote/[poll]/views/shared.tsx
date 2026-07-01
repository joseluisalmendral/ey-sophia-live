"use client";

import { motion } from "motion/react";
import { durations, easings } from "@/lib/motion/tokens";

/**
 * Shared, purely presentational primitives for the vote views.
 *
 * These have NO business logic and NO hooks beyond `motion` — they receive
 * everything through props so each view stays a dumb render function.
 */

/** UI copy — single source of truth, kept identical across the refactor. */
export const COPY = {
  tagline: "Vota al equipo finalista que más te voló la cabeza.",
  pick: "Elige uno. Tu voto cuenta una sola vez.",
  cta: "VOTAR",
  ctaPick: "Elige un equipo",
  sending: "Enviando…",
  lobbyTitle: "La votación aún no está abierta",
  lobbySub: "Prepara tu favorito. En cuanto se abra, tu voto entra al instante.",
  lobbyWaitHint:
    "Espera a que se abra la votación. Cuando el presentador la abra, aquí aparecerán las opciones para votar.",
  closedTitle: "La votación ya cerró",
  closedSub: "Esta vez no llegaste a tiempo, pero mira la pantalla grande.",
  confirmKicker: "¡Voto registrado!",
  confirmYour: "Tu voto por",
  confirmIn: "está dentro",
  watch: "Mira la pantalla grande",
  alreadyTitle: "Ya votaste",
  alreadySub: "Solo se permite un voto por dispositivo. Disfruta del directo.",
  revealKicker: "Resultado final",
  revealRank: "Tu equipo quedó",
} as const;

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

export function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}
