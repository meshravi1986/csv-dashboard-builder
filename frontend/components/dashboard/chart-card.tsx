"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ChartSpec } from "@/types";
import { getPalette } from "@/lib/palettes";
import { formatValue } from "@/lib/formatters";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface ChartCardProps {
  chart: ChartSpec;
  onDelete?: (chartId: string) => void;
  onExpand?: (chart: ChartSpec) => void;
  colorScheme?: string;
  fieldFormats?: Record<string, string>;
}

export function ChartCard({ chart, onDelete, onExpand, colorScheme, fieldFormats }: ChartCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const palette = getPalette(colorScheme);

  const labels = chart.data?.labels || [];
  const values = chart.data?.values || [];
  const hasData = chart.chart_type === "kpi" ? values.length > 0 : labels.length > 0 && values.length > 0;
  const xFormat = fieldFormats?.[chart.x_field];
  const yFormat = fieldFormats?.[chart.y_field];

  const formulaTooltip =
    chart.formula
      ? `${chart.title}  ·  Formula: ${chart.formula}`
      : chart.title;

  const fmtAxis = (fmt?: string) => (value: any) => formatValue(value, fmt);
  const fmtY = fmtAxis(yFormat);
  const fmtX = fmtAxis(xFormat);

  const getChartOption = () => {

    const base = {
      backgroundColor: "transparent",
      animation: false,
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        top: "12%",
        containLabel: true,
      },
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        textStyle: { color: "#1e293b", fontSize: 12 },
      },
    };

    switch (chart.chart_type) {
      case "kpi": {
        const val = typeof values[0] === "number" ? values[0] : null;
        return {
          backgroundColor: "transparent",
          grid: { show: false, left: 0, top: 0, right: 0, bottom: 0 },
          xAxis: { show: false },
          yAxis: { show: false },
          graphic: {
            type: "text",
            left: "center",
            top: "center",
            style: {
              text: val !== null ? formatValue(val, yFormat) : "—",
              fontSize: 36,
              fontWeight: 600,
              fill: val !== null ? palette.colors[0] : "#94a3b8",
            },
          },
        };
      }

      case "line":
        return {
          ...base,
          xAxis: {
            type: "category" as const,
            data: labels,
            axisLine: { lineStyle: { color: "#e2e8f0" } },
            axisLabel: { color: "#64748b", fontSize: 11, formatter: fmtX },
            axisTick: { show: false },
          },
          yAxis: {
            type: "value" as const,
            splitLine: { lineStyle: { color: "#f1f5f9" } },
            axisLabel: { color: "#64748b", fontSize: 11, formatter: fmtY },
          },
          series: [
            {
              type: "line",
              smooth: true,
              symbol: "circle",
              symbolSize: 6,
              lineStyle: { width: 2, color: palette.colors[0] },
              itemStyle: { color: palette.colors[0] },
              areaStyle: {
                color: {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: palette.fill(0.1) },
                    { offset: 1, color: palette.fill(0.01) },
                  ],
                },
              },
              data: values,
            },
          ],
        };

      case "bar":
        return {
          ...base,
          xAxis: {
            type: "category" as const,
            data: labels,
            axisLine: { lineStyle: { color: "#e2e8f0" } },
            axisLabel: { color: "#64748b", fontSize: 11, rotate: 45, formatter: fmtX },
            axisTick: { show: false },
          },
          yAxis: {
            type: "value" as const,
            splitLine: { lineStyle: { color: "#f1f5f9" } },
            axisLabel: { color: "#64748b", fontSize: 11, formatter: fmtY },
          },
          series: [
            {
              type: "bar",
              barWidth: "60%",
              itemStyle: {
                color: {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: palette.colors[0] },
                    { offset: 1, color: palette.colors[1] || palette.colors[0] },
                  ],
                },
                borderRadius: [2, 2, 0, 0],
              },
              data: values,
            },
          ],
        };

      case "pie":
        return {
          backgroundColor: "transparent",
          tooltip: {
            trigger: "item" as const,
            backgroundColor: "rgba(255,255,255,0.95)",
            borderColor: "#e2e8f0",
            borderWidth: 1,
            textStyle: { color: "#1e293b", fontSize: 12 },
            formatter: "{b}: {c} ({d}%)",
          },
          series: [
            {
              type: "pie",
              radius: ["35%", "65%"],
              center: ["50%", "50%"],
              avoidLabelOverlap: true,
              itemStyle: {
                borderRadius: 4,
                borderColor: "#fff",
                borderWidth: 2,
              },
              color: palette.colors,
              label: {
                show: true,
                formatter: "{b}\n{d}%",
                fontSize: 11,
                color: "#475569",
              },
              emphasis: {
                label: { show: true, fontSize: 14, fontWeight: 700 },
                itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.2)" },
              },
              data: labels.map((label, i) => ({
                name: label,
                value: typeof values[i] === "number" ? values[i] : 0,
              })),
            },
          ],
        };

      case "scatter":
        return {
          ...base,
          tooltip: {
            trigger: "item" as const,
            backgroundColor: "rgba(255,255,255,0.95)",
            borderColor: "#e2e8f0",
            borderWidth: 1,
            textStyle: { color: "#1e293b", fontSize: 12 },
            formatter: (p: any) => `${chart.x_field}: ${formatValue(p.value?.x, xFormat)}, ${chart.y_field}: ${formatValue(p.value?.y, yFormat)}`,
          },
          xAxis: {
            type: "value" as const,
            name: chart.x_field,
            splitLine: { lineStyle: { color: "#f1f5f9" } },
            axisLabel: { color: "#64748b", fontSize: 11, formatter: fmtX },
          },
          yAxis: {
            type: "value" as const,
            name: chart.y_field,
            splitLine: { lineStyle: { color: "#f1f5f9" } },
            axisLabel: { color: "#64748b", fontSize: 11, formatter: fmtY },
          },
          series: [
            {
              type: "scatter",
              symbolSize: 10,
              itemStyle: {
                color: {
                  type: "radial",
                  x: 0.5,
                  y: 0.5,
                  r: 0.5,
                  colorStops: [
                    { offset: 0, color: palette.fill(0.6) },
                    { offset: 1, color: palette.fill(0.1) },
                  ],
                },
              },
              data: values,
            },
          ],
        };

      default:
        return base;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-900" title={formulaTooltip}>
            {chart.title}
            <span className="ml-1.5 inline-block w-2 h-2 rounded-full" style={{ backgroundColor: palette.colors[0] }} />
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
          >
            Why this chart?
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(chart.id); }}
              className="text-xs text-slate-300 hover:text-red-500 px-1.5 py-1 rounded hover:bg-red-50 transition-colors"
              title="Remove chart"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="p-2 cursor-pointer" onClick={() => chart.chart_type !== "kpi" && onExpand?.(chart)}>
        {hasData ? (
          <ReactECharts
            key={colorScheme || "slate"}
            option={getChartOption()}
            style={{ height: chart.chart_type === "kpi" ? 120 : 320 }}
            notMerge
            lazyUpdate
          />
        ) : (
          <div className="flex items-center justify-center" style={{ height: chart.chart_type === "kpi" ? 120 : 320 }}>
            <p className="text-xs text-slate-400">No data</p>
          </div>
        )}
      </div>
      {showInfo && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 space-y-1.5">
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Chart: </span>
            {chart.chart_reasoning}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Aggregation: </span>
            {chart.aggregation_reasoning}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Semantics: </span>
            {chart.semantic_reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
