"use client";

import { ChartCard } from "./chart-card";
import type { ChartSpec } from "@/types";
import { api } from "@/services/api";

interface DashboardViewProps {
  dashboard: {
    id?: string;
    title: string;
    description?: string;
    charts: ChartSpec[];
  };
  onRefresh?: () => void;
}

export function DashboardView({ dashboard, onRefresh }: DashboardViewProps) {
  const kpiCards = dashboard.charts.filter((c) => c.chart_type === "kpi");
  const otherCharts = dashboard.charts.filter((c) => c.chart_type !== "kpi");
  const fullWidthCharts = otherCharts.filter((c) => c.width === "full");
  const halfWidthCharts = otherCharts.filter((c) => c.width === "half");

  const handleDeleteChart = async (chartId: string) => {
    if (!dashboard.id) return;
    if (!confirm("Remove this chart from the dashboard?")) return;
    try {
      await api.deleteChart(dashboard.id, chartId);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      {kpiCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((chart) => (
            <ChartCard key={chart.id} chart={chart} onDelete={handleDeleteChart} />
          ))}
        </div>
      )}
      {fullWidthCharts.map((chart) => (
        <ChartCard key={chart.id} chart={chart} onDelete={handleDeleteChart} />
      ))}
      {halfWidthCharts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {halfWidthCharts.map((chart) => (
            <ChartCard key={chart.id} chart={chart} onDelete={handleDeleteChart} />
          ))}
        </div>
      )}
      {dashboard.charts.length === 0 && (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-400">No charts generated</p>
        </div>
      )}
    </div>
  );
}
