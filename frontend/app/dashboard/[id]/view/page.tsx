"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api } from "@/services/api";
import dynamic from "next/dynamic";
import html2canvas from "html2canvas";
import { getPalette } from "@/lib/palettes";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface ChartSpec {
  id: string;
  chart_type: string;
  title: string;
  x_field: string;
  y_field: string;
  aggregation: string;
  formula?: string;
  width: string;
  data?: { labels: any[]; values: any[] };
}

interface DashboardData {
  id: string;
  title: string;
  description?: string;
  charts: ChartSpec[];
  color_scheme?: string;
}

export default function DashboardViewPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      try {
        const data = await api.getDashboard(params.id as string);
        setDashboard(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id, router]);

  const exportPNG = async () => {
    const el = captureRef.current;
    if (!el) return;
    setExporting("png");
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#f8fafc",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${dashboard?.title || "dashboard"}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  const exportPDF = async () => {
    const el = captureRef.current;
    if (!el) return;
    setExporting("pdf");
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#f8fafc",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF("l", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${dashboard?.title || "dashboard"}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Dashboard not found</p>
      </div>
    );
  }

  const nonKpiCharts = dashboard.charts.filter((c) => c.chart_type !== "kpi");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div ref={dashboardRef}>
            <h1 className="text-lg font-semibold text-slate-900">{dashboard.title}</h1>
            {dashboard.description && (
              <p className="text-sm text-slate-500">{dashboard.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPNG}
              disabled={exporting !== null}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {exporting === "png" ? "Exporting..." : "Export PNG"}
            </button>
            <button
              onClick={exportPDF}
              disabled={exporting !== null}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {exporting === "pdf" ? "Exporting..." : "Export PDF"}
            </button>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6" ref={captureRef}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{dashboard.title}</h1>
          {dashboard.description && (
            <p className="text-sm text-slate-500 mt-1">{dashboard.description}</p>
          )}
        </div>
        <DashboardCharts charts={nonKpiCharts} colorScheme={dashboard.color_scheme} />
      </div>
    </div>
  );
}

function DashboardCharts({ charts, colorScheme }: { charts: ChartSpec[]; colorScheme?: string }) {
  const palette = getPalette(colorScheme);

  if (charts.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-400">No charts in this dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {charts.map((chart) => (
        <ChartView key={chart.id} chart={chart} palette={palette.colors} />
      ))}
    </div>
  );
}

function ChartView({ chart, palette }: { chart: ChartSpec; palette: string[] }) {
  const labels = chart.data?.labels || [];
  const values = chart.data?.values || [];
  const hasData = chart.chart_type === "kpi" ? values.length > 0 : labels.length > 0 && values.length > 0;

  const getOption = () => {
    if (chart.chart_type === "kpi") {
      return {
        series: [{ type: "gauge", startAngle: 90, endAngle: -270, pointer: { show: false }, axisLine: { lineStyle: { width: 10, color: [[1, palette[0]]] } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, detail: { fontSize: 28, fontWeight: "bold", color: palette[0], offsetCenter: [0, 0], formatter: () => `${values[0]?.toLocaleString() || 0}` }, data: [{ value: values[0] || 0 }] }],
      };
    }

    const isPie = chart.chart_type === "pie";
    if (isPie) {
      return {
        tooltip: { trigger: "item" },
        series: [{ type: "pie", radius: ["30%", "60%"], data: labels.map((l: string, i: number) => ({ name: l, value: values[i] || 0 })), itemStyle: { borderRadius: 4 }, label: { fontSize: 13 }, emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.5)" } } }],
      };
    }

    const isScatter = chart.chart_type === "scatter";
    const base: any = {
      tooltip: { trigger: "axis" },
      grid: { left: 60, right: 30, top: 30, bottom: 40 },
      series: [],
    };

    if (isScatter) {
      base.xAxis = { type: "value", name: chart.x_field };
      base.yAxis = { type: "value", name: chart.y_field };
      base.series.push({ type: "scatter", data: labels.map((x: any, i: number) => [Number(x), values[i] || 0]), symbolSize: 8, itemStyle: { color: palette[0] } });
    } else {
      base.xAxis = { type: "category", data: labels, axisLabel: { rotate: labels.length > 10 ? 45 : 0 } };
      base.yAxis = { type: "value", name: chart.y_field };
      base.series.push({ type: chart.chart_type, data: values, itemStyle: { color: palette[0] }, smooth: chart.chart_type === "line", showSymbol: chart.chart_type === "line" });
    }

    return base;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">{chart.title}</h2>
      </div>
      <div className="p-4">
        {hasData ? (
          <ReactECharts
            key={chart.id}
            option={getOption()}
            style={{ height: chart.chart_type === "kpi" ? 200 : 350 }}
            notMerge
            lazyUpdate
          />
        ) : (
          <div className="flex items-center justify-center" style={{ height: 200 }}>
            <p className="text-sm text-slate-400">No data</p>
          </div>
        )}
      </div>
    </div>
  );
}
