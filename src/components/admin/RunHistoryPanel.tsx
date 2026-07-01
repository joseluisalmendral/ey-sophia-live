"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import { renameRun } from "@/app/admin/(panel)/poll-actions";
import type { PollRun } from "@/app/admin/(panel)/poll-data";

/**
 * RunHistoryPanel — archived launches of a poll ("Historial" tab).
 *
 * Each relaunch of a closed poll snapshots its results into poll_runs; this
 * panel lists those runs newest-first with an inline-editable label, the run's
 * timeframe and totals, a mini results table (already ordered in the snapshot),
 * and a client-side CSV export built straight from the archived jsonb.
 */

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "votacion"
  );
}

/** RFC-4180-style escaping: quote when the value needs it. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildCsv(pollTitle: string, run: PollRun): string {
  const total = run.totalVotes;
  const lines = [
    `${csvCell("Votación")},${csvCell(pollTitle)}`,
    `${csvCell("Lanzamiento")},${csvCell(run.label ?? `Lanzamiento ${run.seq}`)}`,
    `${csvCell("Inicio")},${csvCell(formatDate(run.startedAt))}`,
    `${csvCell("Fin")},${csvCell(formatDate(run.endedAt))}`,
    "",
    "Equipo,Votos,Porcentaje",
    ...run.results.map((r) => {
      const pct = total > 0 ? ((r.count / total) * 100).toFixed(1) : "0.0";
      return `${csvCell(r.name)},${r.count},${pct}%`;
    }),
  ];
  // BOM so Excel opens the UTF-8 file with accents intact.
  return `\uFEFF${lines.join("\r\n")}`;
}

function downloadCsv(pollTitle: string, run: PollRun): void {
  const date = new Date(run.endedAt).toISOString().slice(0, 10);
  const filename = `${slugify(pollTitle)}-r${run.seq}-${date}.csv`;
  const blob = new Blob([buildCsv(pollTitle, run)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RunCard({ pollTitle, run }: { pollTitle: string; run: PollRun }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(run.label ?? "");
  const [error, setError] = useState<string | null>(null);
  const dirty = label.trim() !== (run.label ?? "").trim();

  function saveLabel() {
    if (!dirty) return;
    setError(null);
    startTransition(async () => {
      const res = await renameRun(run.id, label);
      if (!res.ok) setError("No se pudo guardar el nombre.");
      else router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-white/10 bg-surface-raised p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-8 items-center rounded-md bg-surface px-3 font-mono text-small text-text-dim">
          #{run.seq}
        </span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveLabel();
          }}
          placeholder={`Lanzamiento ${run.seq}`}
          aria-label="Nombre del lanzamiento"
          className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-surface px-3 text-body text-text placeholder:text-text-dim focus:border-ey-yellow/60 focus:outline-none"
        />
        {dirty && (
          <button
            type="button"
            onClick={saveLabel}
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md bg-ey-yellow px-4 text-small font-bold text-ey-confident transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        )}
        <button
          type="button"
          onClick={() => downloadCsv(pollTitle, run)}
          className="inline-flex h-9 items-center rounded-md border border-white/15 px-4 text-small font-medium text-text-dim transition-colors hover:text-text"
        >
          Descargar CSV
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-small text-[#FF9E9E]">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-small text-text-dim">
        <span>
          Inicio: <span className="text-text">{formatDate(run.startedAt)}</span>
        </span>
        <span>
          Fin: <span className="text-text">{formatDate(run.endedAt)}</span>
        </span>
        <span>
          Votos:{" "}
          <span className="tabular-nums text-text">{run.totalVotes}</span>
        </span>
      </div>

      {run.results.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-text-dim">
                <th className="pb-2 pr-4 font-medium">Equipo</th>
                <th className="pb-2 pr-4 font-medium">Votos</th>
                <th className="pb-2 font-medium">Porcentaje</th>
              </tr>
            </thead>
            <tbody>
              {run.results.map((r) => {
                const pct =
                  run.totalVotes > 0
                    ? ((r.count / run.totalVotes) * 100).toFixed(1)
                    : "0.0";
                return (
                  <tr key={r.teamId} className="border-t border-white/5">
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-2 text-text">
                        <TeamColorChip color={r.color} size={16} />
                        {r.name}
                      </span>
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-text">
                      {r.count}
                    </td>
                    <td className="py-2 tabular-nums text-text-dim">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

export function RunHistoryPanel({
  pollTitle,
  runs,
}: {
  pollTitle: string;
  runs: PollRun[];
}) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-surface-raised px-6 py-14 text-center">
        <p className="font-display text-h3 font-bold text-text">
          Aún no hay lanzamientos archivados
        </p>
        <p className="mx-auto mt-2 max-w-md text-small text-text-dim">
          Cuando cierres una votación y pulses «Relanzar», los resultados de esa
          ronda quedarán guardados aquí con su fecha y su descarga en CSV.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {runs.map((run) => (
        <RunCard key={run.id} pollTitle={pollTitle} run={run} />
      ))}
    </ul>
  );
}

export default RunHistoryPanel;
