"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ChartSpec } from "@/types";
import { getPalette } from "@/lib/palettes";
import { getChartOption } from "@/lib/chart-options";

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

  const formulaTooltip =
    chart.formula
      ? `${chart.title}  ·  Formula: ${chart.formula}`
      : chart.title;

  const chartOption = useMemo(
    () => getChartOption(chart, palette, fieldFormats),
    [chart, palette, fieldFormats]
  );

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
            option={chartOption}
            style={{ height: chart.chart_type === "kpi" ? 60 : 320 }}
            notMerge
            lazyUpdate
          />
        ) : (
          <div className="flex items-center justify-center" style={{ height: chart.chart_type === "kpi" ? 60 : 320 }}>
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
