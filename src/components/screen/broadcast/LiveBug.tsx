"use client";

import { memo, type ReactNode } from "react";
import { CountUp } from "@/components/atoms/CountUp";
import type { ConnectionState, PollStatus } from "@/lib/types";
import { Sep } from "./Sep";
import { remainingUntil, useTicker } from "./useTicker";

/**
 * LiveBug — the broadcast "bug" pill at the top-right of the projector header.
 *
 *   draft      yellow static dot · "EN BREVE"
 *   countdown  yellow dot        · "ARRANCA EN {s}"
 *   open       red pulsing dot   · "EN DIRECTO · {total} VOTOS"
 *              last 10 s         · yellow border/text "ÚLTIMOS SEGUNDOS"
 *              realtime down     · grey/yellow dot "RECONECTANDO…" (honest)
 *   closed     hidden (the reveal owns the screen; the header unmounts)
 *
 * `total` is the sum of the (possibly masked) display counts: a vote total is
 * never an identity, so it is safe on anonymous runs. The pulse is two CSS
 * loops on transform/opacity (see globals.css); reduced motion = static dot.
 */

export interface LiveBugProps {
  status: PollStatus;
  opensAt: string | null;
  closesAt: string | null;
  total: number;
  connectionState: ConnectionState;
}

const RED = "var(--color-live)";
const YELLOW = "var(--color-ey-yellow)";

export const LiveBug = memo(function LiveBug({
  status,
  opensAt,
  closesAt,
  total,
  connectionState,
}: LiveBugProps) {
  const ticking = status === "countdown" || (status === "open" && closesAt !== null);
  const now = useTicker(ticking, 250);

  let dot = YELLOW;
  let pulse = false;
  let urgent = false;
  let label: ReactNode;

  if (status === "draft") {
    label = "EN BREVE";
  } else if (status === "countdown") {
    const ms = remainingUntil(opensAt, now);
    const s = ms === null ? null : Math.ceil(ms / 1000);
    label =
      s === null || s <= 0
        ? "¡ARRANCAMOS!"
        : `ARRANCA EN ${s > 99 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : s}`;
  } else if (connectionState !== "live") {
    dot = connectionState === "reconnecting" ? YELLOW : "var(--color-ey-gray1)";
    label = connectionState === "reconnecting" ? "RECONECTANDO…" : "CONECTANDO…";
  } else {
    const ms = remainingUntil(closesAt, now);
    urgent = ms !== null && ms > 0 && ms <= 10_000;
    dot = urgent ? YELLOW : RED;
    pulse = true;
    label = urgent ? (
      "ÚLTIMOS SEGUNDOS"
    ) : (
      <span className="inline-flex items-center">
        <span>EN DIRECTO</span>
        <Sep />
        <CountUp value={total} className="tabular-nums" />
        <span className="ml-[0.45em]">{total === 1 ? "VOTO" : "VOTOS"}</span>
      </span>
    );
  }

  return (
    <div
      className="glass flex h-[clamp(2.6rem,4.4vh,3.6rem)] items-center gap-[0.7em] px-[1.1em] font-display text-proj-label font-extrabold uppercase leading-none tracking-[0.18em]"
      style={{
        borderRadius: 9999,
        color: urgent ? YELLOW : "var(--color-text)",
        borderColor: urgent ? "rgb(255 230 0 / 0.7)" : undefined,
        transition: "color 300ms ease, border-color 300ms ease",
      }}
      role="status"
      aria-live="off"
    >
      <span className="relative inline-flex h-[0.42em] w-[0.42em] shrink-0" aria-hidden>
        {pulse && (
          <span
            className="live-halo absolute inset-0 rounded-full"
            style={{ border: `1.5px solid ${dot}` }}
          />
        )}
        <span
          className={`${pulse ? "live-dot " : ""}relative inline-block h-full w-full rounded-full`}
          style={{ backgroundColor: dot, boxShadow: `0 0 12px ${dot}` }}
        />
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
});

export default LiveBug;
