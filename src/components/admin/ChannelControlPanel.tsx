"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "./CopyButton";
import { StatusBadge } from "./StatusBadge";
import { tvUrl } from "./links";
import { assignChannel } from "@/app/admin/(panel)/poll-actions";
import type { PollStatus } from "@/lib/types";

/**
 * ChannelControlPanel — the "technician screen" block on the admin home.
 *
 * Shows the STABLE /tv/[slug] URL the admin hands to the room technician
 * (copy + open), plus a dropdown to assign which poll the channel projects
 * ("Sin asignar" returns it to the standby board). The projector detects the
 * change on its own (ChannelRefresher polling) — no reload in the room.
 */

export interface ChannelPollOption {
  id: string;
  title: string;
  joinCode: string;
  status: PollStatus;
}

export function ChannelControlPanel({
  slug,
  assignedPollId,
  polls,
}: {
  slug: string;
  /** Poll currently assigned to the channel, or null (standby). */
  assignedPollId: string | null;
  polls: ChannelPollOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const url = tvUrl(slug);
  const assigned = polls.find((p) => p.id === assignedPollId) ?? null;

  function onAssign(value: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await assignChannel(slug, value === "" ? null : value);
      if (!res.ok) setError(res.error ?? "Error");
      router.refresh();
    });
  }

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-surface-raised p-5">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-h3 font-bold text-text">
          Pantalla del técnico
        </h2>
        <span className="font-mono text-micro uppercase tracking-widest text-text-dim">
          canal {slug}
        </span>
      </div>
      <p className="mb-4 text-small text-text-dim">
        URL fija para el proyector: ábrela una vez y asigna aquí la votación
        que toque. La pantalla cambia sola.
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className="min-w-0 flex-1 truncate font-mono text-micro text-text-dim"
          title={url}
        >
          {url}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 shrink-0 items-center rounded-md border border-white/15 px-2.5 text-micro font-medium text-text-dim transition-colors hover:text-text"
          >
            Abrir ↗
          </a>
          <CopyButton value={url} label="Copiar" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <label
          htmlFor={`channel-${slug}-poll`}
          className="text-small font-medium text-text-dim"
        >
          Proyectando
        </label>
        <select
          id={`channel-${slug}-poll`}
          value={assignedPollId ?? ""}
          disabled={pending}
          onChange={(e) => onAssign(e.target.value)}
          className="h-10 min-w-56 rounded-lg border border-white/15 bg-surface px-3 text-small text-text disabled:opacity-50"
        >
          <option value="">Sin asignar (pantalla de espera)</option>
          {polls.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.joinCode}
            </option>
          ))}
        </select>
        {pending ? (
          <span className="text-small text-text-dim">Aplicando…</span>
        ) : assigned ? (
          <span className="flex items-center gap-2 text-small text-text-dim">
            <StatusBadge status={assigned.status} />
            <span className="font-mono uppercase tracking-widest">
              {assigned.joinCode}
            </span>
          </span>
        ) : (
          <span className="text-small text-text-dim">
            El canal muestra la pantalla de espera.
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-small text-[#FF9E9E]">
          {error}
        </p>
      )}
    </section>
  );
}

export default ChannelControlPanel;
