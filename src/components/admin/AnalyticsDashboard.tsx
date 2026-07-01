"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { CountUp } from "@/components/atoms/CountUp";
import { TeamColorChip } from "@/components/atoms/TeamColorChip";

// Code-split echarts-for-react (pulls in the heavy echarts core). Analytics is a
// separate admin route, so echarts stays out of every other bundle. ssr:false
// because ECharts renders on the client only.
const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center text-text-dim">
      Cargando gráfico…
    </div>
  ),
});

/**
 * AnalyticsDashboard — PII-free past-poll review.
 *
 * Renders the aggregate document from get_poll_analytics with a cosmic/yellow
 * ECharts theme: a votes-over-time area chart + a per-team bar chart, plus
 * headline stats animated with CountUp. No raw votes, no identities.
 */

export interface TeamStat {
  team_id: string;
  name: string;
  color: string;
  count: number;
  pct: number;
}

export interface Bucket {
  bucket: number;
  t: string;
  count: number;
}

export interface AnalyticsData {
  poll_id: string;
  title: string;
  status: string;
  total_votes: number;
  bucket_seconds: number;
  teams: TeamStat[];
  buckets: Bucket[];
  peak: { bucket: number; t: string; count: number } | null;
}

const AXIS_COLOR = "#747480"; // ey-gray1
const TEXT_COLOR = "#C4C4CD"; // ey-gray2
const GRID_COLOR = "rgba(255,255,255,0.06)";
const YELLOW = "#FFE600";

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const overTimeOption = useMemo(() => {
    const cats = data.buckets.map((b) => `${b.bucket * data.bucket_seconds}s`);
    const vals = data.buckets.map((b) => b.count);
    return {
      backgroundColor: "transparent",
      grid: { left: 44, right: 16, top: 24, bottom: 32 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#20202c",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#F6F6FA" },
      },
      xAxis: {
        type: "category",
        data: cats,
        axisLine: { lineStyle: { color: AXIS_COLOR } },
        axisLabel: { color: TEXT_COLOR },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: TEXT_COLOR },
      },
      series: [
        {
          type: "line",
          data: vals,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: YELLOW, width: 2.5 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(255,230,0,0.35)" },
                { offset: 1, color: "rgba(255,230,0,0.02)" },
              ],
            },
          },
        },
      ],
    };
  }, [data]);

  const perTeamOption = useMemo(() => {
    // Render in display order (already sorted desc by the RPC); reverse so the
    // leader sits at the TOP of a horizontal bar chart.
    const teams = [...data.teams].reverse();
    return {
      backgroundColor: "transparent",
      grid: { left: 8, right: 40, top: 12, bottom: 12, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#20202c",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#F6F6FA" },
      },
      xAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: TEXT_COLOR },
      },
      yAxis: {
        type: "category",
        data: teams.map((t) => t.name),
        axisLine: { lineStyle: { color: AXIS_COLOR } },
        axisLabel: { color: TEXT_COLOR },
      },
      series: [
        {
          type: "bar",
          data: teams.map((t, i) => ({
            value: t.count,
            // Leader (last in reversed array) gets the EY yellow highlight.
            itemStyle: {
              color: i === teams.length - 1 ? YELLOW : t.color,
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: "55%",
          label: {
            show: true,
            position: "right",
            color: TEXT_COLOR,
            formatter: "{c}",
          },
        },
      ],
    };
  }, [data]);

  const peakLabel = data.peak
    ? `${data.peak.bucket * data.bucket_seconds}s`
    : "—";
  const leader = data.teams[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Headline stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Votos totales">
          <CountUp value={data.total_votes} className="text-display text-text" />
        </Stat>
        <Stat label="Equipo líder">
          {leader ? (
            <span className="flex items-center gap-2">
              <TeamColorChip color={leader.color} size={28} />
              <span className="truncate font-display text-h2 font-bold text-text">
                {leader.name}
              </span>
            </span>
          ) : (
            <span className="text-h2 text-text-dim">—</span>
          )}
        </Stat>
        <Stat label={`Pico (intervalos de ${data.bucket_seconds}s)`}>
          <span className="font-display text-display text-text">
            {data.peak ? (
              <>
                <CountUp value={data.peak.count} /> <span className="text-h3 text-text-dim">@ {peakLabel}</span>
              </>
            ) : (
              "—"
            )}
          </span>
        </Stat>
      </div>

      {data.total_votes === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-surface-raised/50 p-12 text-center text-text-dim">
          Esta votación todavía no registró votos.
        </div>
      ) : (
        <>
          <Panel title="Votos a lo largo del tiempo">
            <ReactECharts
              option={overTimeOption}
              style={{ height: 280 }}
              opts={{ renderer: "svg" }}
            />
          </Panel>

          <Panel title="Votos por equipo">
            <ReactECharts
              option={perTeamOption}
              style={{ height: Math.max(160, data.teams.length * 56) }}
              opts={{ renderer: "svg" }}
            />
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {data.teams.map((t) => (
                <li
                  key={t.team_id}
                  className="flex items-center gap-2 text-small text-text-dim"
                >
                  <TeamColorChip color={t.color} size={16} />
                  <span className="text-text">{t.name}</span>
                  <span className="tabular-nums">{t.pct}%</span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-raised p-5">
      <div className="text-small text-text-dim">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-raised p-5">
      <h2 className="mb-3 font-display text-h3 font-bold text-text">{title}</h2>
      {children}
    </div>
  );
}

export default AnalyticsDashboard;
