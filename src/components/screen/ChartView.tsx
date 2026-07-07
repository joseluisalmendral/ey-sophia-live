"use client";

import { memo, useMemo } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { pickTextOn } from "@/lib/utils/contrast";
import { columnsYAxisMax } from "./chartScale";
import type { ChartType, RankedTeam } from "@/lib/types";

// Code-split echarts-for-react (pulls in the heavy echarts core). ChartView is
// only mounted for the donut/columns chart types, so bar_race screens never load
// echarts. ssr:false because ECharts renders to canvas on the client only.
const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full min-h-[240px] w-full items-center justify-center text-text-dim"
      aria-hidden
    >
      Cargando gráfico…
    </div>
  ),
});

// ECharts renders to a canvas and cannot resolve CSS custom properties, so a
// literal font stack is required. next/font/google exposes "Overpass" and "Inter"
// as concrete family names; the display stack resolves Overpass first, then Inter.
const CHART_FONT_FAMILY = "Overpass, Inter, ui-sans-serif, system-ui, sans-serif";

/**
 * ChartView — ECharts renderer for the `donut` and `columns` chart types.
 *
 * The hero bar-race is hand-built styled divs (BarRace); ECharts is reserved for
 * these alternate visualizations. Themed to the cosmic palette: every team is
 * ALWAYS rendered with its own assigned color (a team named "Azul" must look
 * blue even while leading), all text is projector-legible off-white with
 * tabular-ish sizing, and there are no chart chrome/grid lines fighting the
 * dark stage. EY yellow remains an accent (emphasis glow), never a bar color.
 *
 * Live updates: ECharts diffs on the `option` object, so feeding fresh data each
 * render animates bars/arcs smoothly. `notMerge={false}` keeps that diff path.
 */

const TEXT = "#F6F6FA";
const TEXT_DIM = "#C4C4CD";

export interface ChartViewProps {
  type: Extract<ChartType, "donut" | "columns">;
  teams: RankedTeam[];
  showLegend: boolean;
  showNames: boolean;
}

export const ChartView = memo(function ChartView({
  type,
  teams,
  showLegend,
  showNames,
}: ChartViewProps) {
  // ECharts only takes numeric px font sizes (no CSS clamp/vw), so we scale a
  // 1280px-wide baseline by the real viewport width, clamped to a sane band.
  // Read once per mount — projectors don't resize mid-show, and a reload after
  // a window move is acceptable. Guarded for the SSR pass of the page shell.
  const vwScale =
    typeof window === "undefined"
      ? 1
      : Math.min(1.7, Math.max(0.75, window.innerWidth / 1280));

  const option = useMemo<EChartsOption>(() => {
    // Projector-legible type scale: values/labels must read from the back of a
    // room, so all data/axis fonts run notably larger than chart defaults.
    const fs = (base: number) => Math.round(base * vwScale);
    // Teams always paint with their own assigned color — no leader override.
    const colorFor = (t: RankedTeam) => t.color;

    const base: EChartsOption = {
      backgroundColor: "transparent",
      animationDuration: 600,
      animationDurationUpdate: 600,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      textStyle: { color: TEXT, fontFamily: CHART_FONT_FAMILY },
    };

    // Anonymous runs mask every name to "": labels/axes then show only the
    // vote counts (no placeholder, no stray line break, no empty axis slots).
    const hasNames = teams.some((t) => t.name);

    if (type === "donut") {
      return {
        ...base,
        tooltip: { show: false },
        // A legend of nameless entries is just floating dots — skip it too.
        legend: showLegend && hasNames
          ? {
              bottom: 8,
              textStyle: { color: TEXT_DIM, fontSize: fs(24) },
              icon: "circle",
            }
          : { show: false },
        series: [
          {
            type: "pie",
            radius: ["46%", "74%"],
            center: ["50%", showLegend && hasNames ? "46%" : "50%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderColor: "#0B1026",
              borderWidth: 4,
              borderRadius: 6,
            },
            label: {
              show: showNames,
              color: TEXT,
              fontSize: fs(32),
              fontWeight: "bold",
              lineHeight: fs(38),
              // Function formatter so an empty (anonymous) name renders just
              // the count — "{b}\n{c}" would leave a dangling line break.
              formatter: (p: { name: string; value: unknown }) =>
                p.name ? `${p.name}\n${p.value}` : `${p.value}`,
            },
            labelLine: { show: showNames, lineStyle: { color: TEXT_DIM } },
            emphasis: {
              scale: true,
              scaleSize: 8,
              itemStyle: { shadowBlur: 24, shadowColor: "rgba(255,230,0,0.4)" },
            },
            data: teams.map((t) => ({
              name: t.name,
              value: t.count,
              itemStyle: { color: colorFor(t) },
            })),
          },
        ],
      };
    }

    // columns
    return {
      ...base,
      grid: { left: 16, right: 32, top: 24, bottom: 8, containLabel: true },
      tooltip: { show: false },
      xAxis: {
        type: "category",
        data: teams.map((t) => t.name),
        axisLabel: {
          // Hide the whole axis label row when names are masked (anonymous):
          // empty category labels would just reserve ugly blank space.
          show: showNames && hasNames,
          color: TEXT,
          fontSize: fs(30),
          fontWeight: "bold",
          interval: 0,
          // Long team names: wrap instead of colliding at the bigger size.
          overflow: "break",
          width: fs(240),
        },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        // Adaptive max with headroom: keeps the tallest bar off the top edge and
        // gives near-equal bars a legible gap instead of both hugging the ceiling.
        // null lets ECharts auto-scale the empty grid before any votes land.
        max: columnsYAxisMax(Math.max(0, ...teams.map((t) => t.count))) ?? undefined,
        minInterval: 1,
        axisLabel: { color: TEXT_DIM, fontSize: fs(22) },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 96,
          itemStyle: {
            borderRadius: [8, 8, 0, 0],
            color: (params: { dataIndex: number }) =>
              colorFor(teams[params.dataIndex]),
          },
          label: {
            show: true,
            color: TEXT,
            fontSize: fs(40),
            fontWeight: "bold",
          },
          // Vote count anchored INSIDE the column at its base (live AND reveal),
          // colored for AA contrast against the actual rendered bar color (the
          // team's own color). Zero-height bars have no "inside" to write on,
          // so 0 falls back to a dim label above the baseline.
          data: teams.map((t) => ({
            value: t.count,
            label:
              t.count > 0
                ? {
                    position: "insideBottom" as const,
                    distance: 10,
                    color: pickTextOn(colorFor(t)),
                  }
                : {
                    position: "top" as const,
                    color: TEXT_DIM,
                  },
          })),
        },
      ],
    };
  }, [type, teams, showLegend, showNames, vwScale]);

  return (
    <ReactECharts
      option={option}
      notMerge={false}
      lazyUpdate
      style={{ width: "100%", height: "100%", minHeight: 0 }}
      opts={{ renderer: "canvas" }}
    />
  );
});

export default ChartView;
