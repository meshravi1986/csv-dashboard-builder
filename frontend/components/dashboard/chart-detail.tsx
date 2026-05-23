"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ChartSpec } from "@/types";
import { getPalette } from "@/lib/palettes";

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

  const labels = chart.data?.labels || [];
  const values = chart.data?.values || [];
  const hasData = chart.chart_type === "kpi" ? values.length > 0 : labels.length > 0 && values.length > 0;

  const getChartOption = () => {
    const baseColors = palette.colors;

    if (chart.chart_type === "kpi") {
      return {
        series: [{ type: "gauge", startAngle: 90, endAngle: -270, pointer: { show: false }, axisLine: { lineStyle: { width: 10, color: [[1, baseColors[0]]] } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, detail: { fontSize: 36, fontWeight: "bold", color: baseColors[0], offsetCenter: [0, 0], formatter: () => `$${values[0]?.toLocaleString() || 0}` }, data: [{ value: values[0] || 0 }] }],
      };
    }

    const isLine = chart.chart_type === "line";
    const isBar = chart.chart_type === "bar";
    const isScatter = chart.chart_type === "scatter";
    const isPie = chart.chart_type === "pie";

    if (isPie) {
      return {
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        series: [{ type: "pie", radius: ["30%", "60%"], center: ["50%", "50%"], data: labels.map((label: string, i: number) => ({ name: label, value: values[i] || 0 })), itemStyle: { borderRadius: 4 }, label: { fontSize: 13 }, emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.5)" } } }],
      };
    }

    const option: any = {
      tooltip: { trigger: "axis" },
      grid: { left: 60, right: 30, top: 40, bottom: 50 },
      xAxis: { type: "category", data: labels, axisLabel: { rotate: labels.length > 10 ? 45 : 0, fontSize: 12 } },
      yAxis: { type: "value", name: chart.y_field },
      series: [],
    };

    if (isScatter) {
      option.xAxis = { type: "value", name: chart.x_field };
      option.yAxis = { type: "value", name: chart.y_field };
      option.series.push({
        type: "scatter",
        data: labels.map((x: any, i: number) => [Number(x), values[i] || 0]),
        symbolSize: 8,
        itemStyle: { color: baseColors[0] },
      });
    } else {
      option.series.push({
        type: isLine ? "line" : "bar",
        data: values,
        itemStyle: { color: baseColors[0] },
        smooth: isLine,
        showSymbol: isLine,
      });
    }

    return option;
  };

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
              option={getChartOption()}
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
