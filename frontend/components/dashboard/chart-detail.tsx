"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ChartSpec } from "@/types";
import { getPalette } from "@/lib/palettes";
import { getChartOption } from "@/lib/chart-options";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface ChartDetailProps {
  chart: ChartSpec;
  colorScheme?: string;
  onClose: () => void;
}

export function ChartDetail({ chart, colorScheme, onClose }: ChartDetailProps) {
  const [showInfo, setShowInfo] = useState(false);
  const palette = getPalette(colorScheme);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasData = chart.data?.labels?.length || chart.data?.values?.length;

  const formulaInfo =
    chart.formula ||
    (chart.chart_type === "kpi"
      ? `${chart.aggregation}(${chart.y_field})`
      : `${chart.aggregation}(${chart.y_field}) by ${chart.x_field}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{chart.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{formulaInfo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="px-3 py-1.5 text-xs text-slate-500 font-medium rounded-lg hover:bg-slate-100 transition-colors"
            >
              {showInfo ? "Hide Details" : "Why this chart?"}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 flex items-center justify-center bg-slate-50/50">
          {hasData ? (
            <ReactECharts
              key={colorScheme || "slate"}
              option={getChartOption(chart, palette, undefined, "large")}
              style={{ width: "100%", height: "100%" }}
              notMerge
              lazyUpdate
            />
          ) : (
            <p className="text-sm text-slate-400">No data</p>
          )}
        </div>

        {showInfo && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 space-y-1.5 shrink-0">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Chart: </span>
              {chart.chart_reasoning}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Aggregation: </span>
              {chart.aggregation_reasoning}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Semantics: </span>
              {chart.semantic_reasoning}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
