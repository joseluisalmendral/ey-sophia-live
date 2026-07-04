"use client";

import { useState } from "react";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";
import {
  AnalyticsDashboard,
  type AnalyticsData,
  type JoinCurve,
} from "./AnalyticsDashboard";
import type { PollRun } from "@/app/admin/(panel)/poll-data";

/**
 * AnalyticsView — per-launch analytics with a run selector.
 *
 * "Current run" renders the live RPC documents (get_poll_analytics +
 * get_lobby_join_curve) fetched server-side by the page. Archived runs render
 * the analytics snapshot frozen into poll_runs.analytics by relaunch_poll.
 * Runs archived before that snapshot existed have analytics = null; those get
 * a friendly empty state with the archived results table as fallback.
 */

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "short",
  timeStyle: "short",
});

function runName(run: PollRun): string {
  const label = run.label?.trim() || `Lanzamiento ${run.seq}`;
  return `#${run.seq} · ${label} · ${dateFmt.format(new Date(run.endedAt))}`;
}

export function AnalyticsView({
  live,
  liveJoins,
  currentSeq,
  runs,
}: {
  live: AnalyticsData;
  liveJoins: JoinCurve | null;
  currentSeq: number;
  /** Archived launches, newest first (poll_runs). */
  runs: PollRun[];
}) {
  // "current" or a poll_runs row id.
  const [selected, setSelected] = useState<string>("current");
  const run = runs.find((r) => r.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="run-selector"
          className="text-small font-medium text-text-dim"
        >
          Lanzamiento
        </label>
        <select
          id="run-selector"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-surface-raised px-3 text-body text-text focus:border-ey-yellow/60 focus:outline-none"
        >
          <option value="current">Lanzamiento actual (#{currentSeq})</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {runName(r)}
            </option>
          ))}
        </select>
      </div>

      {run === null ? (
        <AnalyticsDashboard data={live} joins={liveJoins} />
      ) : run.analytics ? (
        <AnalyticsDashboard data={run.analytics} joins={run.analytics.joins} />
      ) : (
        <NoSnapshotFallback run={run} />
      )}
    </div>
  );
}

/** Runs relaunched before the analytics snapshot existed: show what we DO have. */
function NoSnapshotFallback({ run }: { run: PollRun }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-dashed border-white/15 bg-surface-raised/50 p-8 text-center">
        <p className="font-display text-h3 font-bold text-text">
          Este lanzamiento no guardó analíticas detalladas
        </p>
        <p className="mx-auto mt-2 max-w-md text-small text-text-dim">
          Se archivó antes de que existiera el guardado de analíticas por
          lanzamiento. Aquí tienes sus resultados finales del historial.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-surface-raised p-5">
        <h2 className="mb-3 font-display text-h3 font-bold text-text">
          Resultados archivados
        </h2>
        <div className="mb-3 text-small text-text-dim">
          Votos totales:{" "}
          <span className="tabular-nums text-text">{run.totalVotes}</span>
        </div>
        <div className="overflow-x-auto">
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
      </div>
    </div>
  );
}

export default AnalyticsView;
