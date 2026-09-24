"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { CountUp } from "@/components/atoms/CountUp";
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
 *
 * Broadcast dressing (E6): columns carry white 800 value labels ON TOP and a
 * width-aware category axis (each name wraps into ≤ 3 lines inside its own
 * slot, font sized so the longest word fits — five long team names never
 * collide); the donut shows the vote total in its centre (HTML overlay with a
 * NumberFlow roll, aligned to the pie centre).
 */

/**
 * The donut legend only shows when slice labels do not already name teams —
 * and never on an anonymous run (a legend of "?" entries is just noise).
 */
function donutLegendOn(showLegend: boolean, showNames: boolean, anonymized: boolean): boolean {
  return showLegend && !anonymized && !showNames;
}

/** Approximate advance of Overpass 800 per character, as a share of the size. */
const CHAR_EM = 0.58;

/**
 * Greedy word wrap for a canvas axis label: ≤ `maxLines` lines no wider than
 * `maxPx`, the last one ellipsized. Pure; ECharts renders the "\n" breaks.
 */
export function wrapLabel(text: string, fontPx: number, maxPx: number, maxLines = 3): string {
  const maxChars = Math.max(4, Math.floor(maxPx / (fontPx * CHAR_EM)));
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
    return kept.join("\n");
  }
  return lines.map((l) => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l)).join("\n");
}

const TEXT = "#F6F6FA";
/** Donut centre (vertical %) when the legend sits under it. */
const DONUT_CENTER_WITH_LEGEND = 46;
const TEXT_DIM = "#C4C4CD";

export interface ChartViewProps {
  type: Extract<ChartType, "donut" | "columns">;
  teams: RankedTeam[];
  showLegend: boolean;
  showNames: boolean;
  /** Open + anonymous: every name is "?" (identities keyed by id, see below). */
  anonymized?: boolean;
}

export const ChartView = memo(function ChartView({
  type,
  teams,
  showLegend,
  showNames,
  anonymized = false,
}: ChartViewProps) {
  // ECharts only takes numeric px font sizes (no CSS clamp/vw), so we scale a
  // 1280px-wide baseline by the real viewport width, clamped to a sane band.
  // Read once per mount — projectors don't resize mid-show, and a reload after
  // a window move is acceptable. Guarded for the SSR pass of the page shell.
  const vwScale =
    typeof window === "undefined"
      ? 1
      : Math.min(3.4, Math.max(0.75, window.innerWidth / 1280));

  // Real chart width (ResizeObserver): the columns axis sizes each label to
  // its own category slot. 0 until measured (first paint uses a safe guess).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

    // ECharts keys pie slices / categories by NAME: on an anonymous run every
    // name is "?", which would merge legend entries and categories. Data is
    // therefore keyed by team id and the display name is looked up for labels.
    const nameById = new Map(teams.map((t) => [t.id, t.name]));
    const display = (id: string) => nameById.get(id) ?? "";

    if (type === "donut") {
      // Slice labels already carry each name (wrapped, ≤ 2 lines) + its count,
      // so a legend would only repeat them: it shows only when names are off
      // the labels. A legend of nameless entries is just floating dots — skip.
      const legendOn = donutLegendOn(showLegend, showNames, anonymized);
      const dense = teams.length >= 5;
      const nameFs = fs(dense ? 20 : 26);
      const countFs = fs(dense ? 30 : 38);
      const labelW = (width > 0 ? width : (typeof window === "undefined" ? 1280 : window.innerWidth) * 0.7) * 0.26;
      return {
        ...base,
        tooltip: { show: false },
        legend: legendOn
          ? {
              bottom: 8,
              textStyle: { color: TEXT_DIM, fontSize: fs(24) },
              icon: "circle",
              formatter: (id: string) => display(id),
            }
          : { show: false },
        series: [
          {
            type: "pie",
            radius: ["46%", "74%"],
            center: ["50%", legendOn ? `${DONUT_CENTER_WITH_LEGEND}%` : "50%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderColor: "#0B1026",
              borderWidth: 4,
              borderRadius: 6,
            },
            label: {
              show: showNames,
              color: TEXT,
              // Rich text: the name wrapped into ≤ 2 lines (never a collision
              // with a neighbour's label), the count big underneath. An
              // anonymous slice reads "?" beside its count (one line).
              formatter: (p: { name: string; value: unknown }) => {
                const count = `{c|${p.value}}`;
                const label = display(p.name);
                if (!label) return count;
                if (anonymized) return `{q|${label}}  ${count}`;
                const name = wrapLabel(label, nameFs, labelW, 2)
                  .split("\n")
                  .map((l) => `{n|${l}}`)
                  .join("\n");
                return `${name}\n${count}`;
              },
              rich: {
                n: { fontSize: nameFs, lineHeight: Math.round(nameFs * 1.15), fontWeight: 800, color: TEXT },
                q: { fontSize: countFs, lineHeight: Math.round(countFs * 1.1), fontWeight: 900, color: TEXT_DIM },
                c: { fontSize: countFs, lineHeight: Math.round(countFs * 1.1), fontWeight: 900, color: TEXT },
              },
            },
            labelLine: { show: showNames, lineStyle: { color: TEXT_DIM } },
            emphasis: {
              scale: true,
              scaleSize: 8,
              itemStyle: { shadowBlur: 24, shadowColor: "rgba(255,230,0,0.4)" },
            },
            data: teams.map((t) => ({
              name: t.id,
              value: t.count,
              itemStyle: { color: colorFor(t) },
            })),
          },
        ],
      };
    }

    // columns — every category gets its own slot; each name wraps inside it
    // (≤ 3 lines) at the largest size where its longest word still fits.
    const n = Math.max(1, teams.length);
    const plotW = (width > 0 ? width : (typeof window === "undefined" ? 1280 : window.innerWidth) * 0.7) - 48;
    const slotW = Math.max(80, (plotW / n) * 0.9);
    const longestWord = Math.max(
      4,
      ...teams.flatMap((t) => t.name.split(/\s+/).map((w) => w.length)),
    );
    const labelPx = Math.max(
      fs(17),
      Math.min(fs(30), Math.floor(slotW / (longestWord * CHAR_EM))),
    );
    return {
      ...base,
      grid: { left: 16, right: 16, top: fs(56), bottom: 8, containLabel: true },
      tooltip: { show: false },
      xAxis: {
        type: "category",
        data: teams.map((t) => t.id),
        axisLabel: {
          show: showNames,
          color: TEXT,
          fontSize: labelPx,
          lineHeight: Math.round(labelPx * 1.12),
          fontWeight: "bold",
          interval: 0,
          margin: fs(14),
          width: slotW,
          overflow: "none",
          formatter: (id: string) => wrapLabel(display(id), labelPx, slotW),
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
        // Value labels sit on every column: the y scale is redundant chrome.
        axisLabel: { show: false },
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
          // Broadcast value labels: white 800 on top of every column (dim
          // for an empty column), tabular-ish via the display font.
          label: {
            show: true,
            position: "top",
            distance: fs(8),
            color: TEXT,
            fontSize: fs(40),
            fontWeight: 800,
          },
          data: teams.map((t) => ({
            value: t.count,
            label: t.count > 0 ? {} : { color: TEXT_DIM },
          })),
        },
      ],
    };
  }, [type, teams, showLegend, showNames, anonymized, vwScale, width]);

  const total = teams.reduce((s, t) => s + t.count, 0);
  const legendShown = donutLegendOn(showLegend, showNames, anonymized);

  return (
    <div ref={wrapRef} className="relative h-full w-full min-h-0">
      <ReactECharts
        option={option}
        notMerge={false}
        lazyUpdate
        style={{ width: "100%", height: "100%", minHeight: 0 }}
        opts={{ renderer: "canvas" }}
      />
      {type === "donut" && (
        // Vote total in the donut's hole (aligned to the series centre).
        <div
          className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center leading-none"
          style={{ top: `${legendShown ? DONUT_CENTER_WITH_LEGEND : 50}%` }}
          aria-hidden
        >
          <span className="font-display text-proj-number font-black text-text tabular-nums">
            <CountUp value={total} />
          </span>
          <span className="mt-1 font-display text-proj-label font-extrabold uppercase tracking-[0.2em] text-text-dim">
            {total === 1 ? "voto" : "votos"}
          </span>
        </div>
      )}
    </div>
  );
});

export default ChartView;
