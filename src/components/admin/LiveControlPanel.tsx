"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLiveTally } from "@/lib/realtime/useLiveTally";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { StatusBadge } from "./StatusBadge";
import { CopyButton } from "./CopyButton";
import { voteUrl, screenUrl } from "./links";
import { changeStatus } from "@/app/admin/(panel)/poll-actions";
import type { PollStatus } from "@/lib/types";

/**
 * LiveControlPanel — the operator's live cockpit.
 *
 * Big, unambiguous state-machine buttons (Draft -> Countdown -> Open -> Close),
 * each calling set_poll_status via the changeStatus action. The CURRENT state
 * and the NEXT recommended action are made obvious at a glance (event pressure).
 * A live tally mirror reuses useLiveTally so the operator sees exactly what the
 * room sees. Close is confirm-gated ("Cerrar votación y revelar").
 */

const STEPS: { status: PollStatus; label: string }[] = [
  { status: "draft", label: "Borrador" },
  { status: "countdown", label: "Cuenta atrás" },
  { status: "open", label: "Abierta" },
  { status: "closed", label: "Cerrada" },
];

/** The recommended next transition from a given status. */
function nextAction(
  status: PollStatus,
  hasCountdown: boolean,
): { to: PollStatus; label: string; danger?: boolean } | null {
  switch (status) {
    case "draft":
      return hasCountdown
        ? { to: "countdown", label: "Iniciar cuenta atrás" }
        : { to: "open", label: "Abrir votación" };
    case "countdown":
      return { to: "open", label: "Abrir votación" };
    case "open":
      return { to: "closed", label: "Cerrar votación y revelar", danger: true };
    case "closed":
      return null;
  }
}

export function LiveControlPanel({
  pollId,
  joinCode,
  initialStatus,
  hasCountdown,
  enabled = true,
}: {
  pollId: string;
  joinCode: string;
  initialStatus: PollStatus;
  hasCountdown: boolean;
  /**
   * When false, the panel stays mounted but does NOT open a realtime
   * subscription. PollWorkspace keeps the inactive tab mounted (to preserve
   * state) and passes `enabled={tab === "live"}` so only the visible tab
   * subscribes.
   */
  enabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // Live mirror of what the room sees (subscribes to poll:<id> when enabled).
  const { teams, status: liveStatus, connectionState } = useLiveTally(pollId, {
    enabled,
  });
  // Prefer the realtime status once it arrives; fall back to the server snapshot.
  const status = liveStatus ?? initialStatus;
  const action = nextAction(status, hasCountdown);

  function go(to: PollStatus) {
    setError(null);
    startTransition(async () => {
      const res = await changeStatus(pollId, to);
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  const total = teams.reduce((s, t) => s + t.count, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* State machine strip */}
      <div className="rounded-xl border border-white/10 bg-surface-raised p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-small font-medium text-text-dim">
            Estado actual
          </span>
          <StatusBadge status={status} size="lg" />
        </div>

        <ol className="flex items-center gap-2">
          {STEPS.map((step, i) => {
            const active = step.status === status;
            const done =
              STEPS.findIndex((s) => s.status === status) > i;
            return (
              <li key={step.status} className="flex flex-1 items-center gap-2">
                <div
                  className={[
                    "flex h-9 flex-1 items-center justify-center rounded-lg text-small font-medium transition-colors",
                    active
                      ? "bg-ey-yellow text-ey-confident"
                      : done
                        ? "bg-power-green/15 text-power-green"
                        : "bg-surface text-text-dim",
                  ].join(" ")}
                >
                  {step.label}
                </div>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="text-text-dim">
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Next action — the one obvious button under pressure */}
        <div className="mt-5">
          {action ? (
            action.danger ? (
              confirmClose ? (
                <div className="flex items-center gap-3 rounded-lg border border-[#FF6B6B]/40 bg-[#FF6B6B]/5 p-3">
                  <span className="text-small text-text">
                    ¿Cerrar la votación y mostrar el resultado?
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => go(action.to)}
                    className="ml-auto inline-flex h-10 items-center rounded-lg bg-[#FF6B6B] px-5 font-display font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "Cerrando…" : "Sí, cerrar y revelar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClose(false)}
                    className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-small text-text-dim hover:text-text"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClose(true)}
                  className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-[#FF6B6B] font-display text-h3 font-bold text-white transition-opacity hover:opacity-90"
                >
                  {action.label}
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => go(action.to)}
                className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-ey-yellow font-display text-h3 font-bold text-ey-confident transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Aplicando…" : action.label}
              </button>
            )
          ) : (
            <p className="rounded-lg bg-surface px-4 py-3 text-center text-small text-text-dim">
              Votación cerrada. El resultado está en pantalla.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-small text-[#FF9E9E]">
            {error}
          </p>
        )}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap items-center gap-2.5">
        <a
          href={screenUrl(joinCode)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-small font-medium text-text-dim hover:text-text"
        >
          Abrir pantalla ↗
        </a>
        <a
          href={voteUrl(joinCode)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-small font-medium text-text-dim hover:text-text"
        >
          Abrir votación ↗
        </a>
        <CopyButton value={voteUrl(joinCode)} label="Copiar URL de votación" />
        <span className="ml-auto text-micro text-text-dim">
          Realtime:{" "}
          <span
            className={
              connectionState === "live"
                ? "text-power-green"
                : "text-text-dim"
            }
          >
            {connectionState}
          </span>
        </span>
      </div>

      {/* Live tally mirror */}
      <div className="rounded-xl border border-white/10 bg-surface-raised p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h3 font-bold text-text">
            Recuento en vivo
          </h2>
          <span className="text-small text-text-dim">
            Total: <CountUp value={total} className="text-text" /> votos
          </span>
        </div>
        {teams.length === 0 ? (
          <p className="py-6 text-center text-small text-text-dim">
            Sin equipos todavía.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {teams.map((t) => {
              const pct = total > 0 ? (t.count / total) * 100 : 0;
              const leading = t.rank === 1 && t.count > 0;
              return (
                <li key={t.id} className="flex items-center gap-3">
                  <TeamColorChip color={t.color} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-body text-text">
                        {t.name}
                      </span>
                      <span className="tabular-nums text-small text-text-dim">
                        <CountUp
                          value={t.count}
                          className={leading ? "text-ey-yellow" : "text-text"}
                        />
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: leading
                            ? "var(--color-ey-yellow)"
                            : t.color,
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default LiveControlPanel;
