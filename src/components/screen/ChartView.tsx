"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { pickTextOn } from "@/lib/utils/contrast";
import type { ChartType, RankedTeam } from "@/lib/types";

/**
 * ChartView — ECharts renderer for the `donut` and `columns` chart types.
 *
 * The hero bar-race is hand-built styled divs (BarRace); ECharts is reserved for
 * these alternate visualizations. Themed to the cosmic/EY-yellow palette: the
 * leader is forced to EY-yellow (the single highlight), everyone else keeps
 * their team color, all text is projector-legible off-white with tabular-ish
 * sizing, and there are no chart chrome/grid lines fighting the dark stage.
 *
 * Live updates: ECharts diffs on the `option` object, so feeding fresh data each
 * render animates bars/arcs smoothly. `notMerge={false}` keeps that diff path.
 */

const EY_YELLOW = "#FFE600";
const TEXT = "#F6F6FA";
const TEXT_DIM = "#C4C4CD";

export interface ChartViewProps {
  type: Extract<ChartType, "donut" | "columns">;
  teams: RankedTeam[];
  showLegend: boolean;
  showNames: boolean;
}

export function ChartView({ type, teams, showLegend, showNames }: ChartViewProps) {
  const option = useMemo<EChartsOption>(() => {
    const colorFor = (t: RankedTeam) =>
      t.rank === 1 && t.count > 0 ? EY_YELLOW : t.color;

    const base: EChartsOption = {
      backgroundColor: "transparent",
      animationDuration: 600,
      animationDurationUpdate: 600,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      textStyle: { color: TEXT, fontFamily: "var(--font-display), sans-serif" },
    };

    if (type === "donut") {
      return {
        ...base,
        tooltip: { show: false },
        legend: showLegend
          ? {
              bottom: 8,
              textStyle: { color: TEXT_DIM, fontSize: 18 },
              icon: "circle",
            }
          : { show: false },
        series: [
          {
            type: "pie",
            radius: ["46%", "74%"],
            center: ["50%", showLegend ? "46%" : "50%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderColor: "#0B1026",
              borderWidth: 4,
              borderRadius: 6,
            },
            label: {
              show: showNames,
              color: TEXT,
              fontSize: 22,
              fontWeight: "bold",
              formatter: "{b}\n{c}",
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
          show: showNames,
          color: TEXT,
          fontSize: 22,
          fontWeight: "bold",
          interval: 0,
        },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: TEXT_DIM, fontSize: 16 },
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
            position: "top",
            color: TEXT,
            fontSize: 26,
            fontWeight: "bold",
          },
          data: teams.map((t) => ({
            value: t.count,
            label: {
              color:
                t.rank === 1 && t.count > 0 ? EY_YELLOW : pickTextOn(t.color),
            },
          })),
        },
      ],
    };
  }, [type, teams, showLegend, showNames]);

  return (
    <ReactECharts
      option={option}
      notMerge={false}
      lazyUpdate
      style={{ width: "100%", height: "100%", minHeight: 0 }}
      opts={{ renderer: "canvas" }}
    />
  );
}

export default ChartView;
