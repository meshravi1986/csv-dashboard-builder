"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api } from "@/services/api";
import dynamic from "next/dynamic";
import html2canvas from "html2canvas";
import { getPalette } from "@/lib/palettes";
import { getChartOption } from "@/lib/chart-options";

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
    setExporting("pdf");
    try {
      window.print();
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

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-chart { page-break-inside: avoid; break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-only { display: none; }
      `}</style>
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 no-print">
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
        <DashboardCharts charts={dashboard.charts} colorScheme={dashboard.color_scheme} />
      </div>
    </div>
  );
}

function DashboardCharts({ charts, colorScheme }: { charts: ChartSpec[]; colorScheme?: string }) {
  const kpiCharts = charts.filter((c) => c.chart_type === "kpi");
  const otherCharts = charts.filter((c) => c.chart_type !== "kpi");

  if (charts.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-400">No charts in this dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {kpiCharts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print-chart">
          {kpiCharts.map((chart) => (
            <ChartView key={chart.id} chart={chart} colorScheme={colorScheme} />
          ))}
        </div>
      )}
      {otherCharts.map((chart) => (
        <ChartView key={chart.id} chart={chart} colorScheme={colorScheme} />
      ))}
    </div>
  );
}

function ChartView({ chart, colorScheme }: { chart: ChartSpec; colorScheme?: string }) {
  const palette = getPalette(colorScheme);
  const hasData = (chart.data?.labels?.length || chart.data?.values?.length) ? true : false;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print-chart">
      <div className="px-5 py-3 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">{chart.title}</h2>
      </div>
      <div className="p-4">
        {hasData ? (
          <ReactECharts
            key={chart.id}
            option={getChartOption(chart as any, palette)}
            style={{ height: chart.chart_type === "kpi" ? 120 : 350 }}
            notMerge
            lazyUpdate
          />
        ) : (
          <div className="flex items-center justify-center" style={{ height: chart.chart_type === "kpi" ? 120 : 200 }}>
            <p className="text-sm text-slate-400">No data</p>
          </div>
        )}
      </div>
    </div>
  );
}
