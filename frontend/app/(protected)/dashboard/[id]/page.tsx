"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/services/api";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { AddChartPanel } from "@/components/dashboard/add-chart-panel";
import { FilterBar } from "@/components/dashboard/filter-bar";

export default function DashboardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [suggestedFilters, setSuggestedFilters] = useState<any[]>([]);
  const [activeFilters, setActiveFilters] = useState<any[]>([]);

  const loadDashboard = useCallback(async () => {
    if (!params.id) return;
    try {
      const data = await api.getDashboard(params.id as string);
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!params.id) return;
    api.suggestFilters(params.id as string)
      .then((data) => setSuggestedFilters(data.filters || []))
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    if (!params.id || !dashboard?.charts) return;

    const fetchFiltered = async () => {
      if (activeFilters.length === 0) {
        loadDashboard();
        return;
      }

      try {
        const batchData = await api.getAllChartDataFiltered(params.id as string, activeFilters);
        setDashboard((prev: any) => {
          if (!prev) return prev;
          const newCharts = prev.charts.map((c: any) => {
            if (batchData[c.id]) {
              return { ...c, data: batchData[c.id] };
            }
            return c;
          });
          return { ...prev, charts: newCharts };
        });
      } catch (err) {
        console.error("Batch filter fetch failed, falling back to per-chart:", err);
        const results = await Promise.allSettled(
          dashboard.charts.map(async (chart: any) => {
            const data = await api.getChartDataFiltered(
              params.id as string,
              chart.id,
              activeFilters
            );
            return { id: chart.id, data };
          })
        );

        setDashboard((prev: any) => {
          if (!prev) return prev;
          const newCharts = prev.charts.map((c: any) => {
            const match = results.find(
              (r) => r.status === "fulfilled" && r.value.id === c.id
            );
            if (match && match.status === "fulfilled") {
              return { ...c, data: match.value.data };
            }
            return c;
          });
          return { ...prev, charts: newCharts };
        });
      }
    };

    fetchFiltered();
  }, [activeFilters, params.id, dashboard?.charts]);

  const handleDelete = async () => {
    if (!confirm("Delete this dashboard? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.deleteDashboard(params.id as string);
      router.push("/dashboards");
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-500">Dashboard not found</p>
        <button onClick={() => router.push("/dashboards")} className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg">
          Back to Dashboards
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{dashboard.title}</h1>
          {dashboard.description && (
            <p className="text-sm text-slate-500 mt-1">{dashboard.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAddPanel(!showAddPanel)} className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            {showAddPanel ? "Close" : "+ Add"}
          </button>
          <button onClick={() => router.push(`/semantic?dataset_id=${dashboard.dataset_id}`)} className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            Edit Workspace
          </button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <button onClick={() => router.push("/dashboards")} className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            All Dashboards
          </button>
        </div>
      </div>

      <FilterBar
        availableFilters={suggestedFilters}
        activeFilters={activeFilters}
        onChange={setActiveFilters}
      />

      {showAddPanel && (
        <AddChartPanel
          dashboardId={params.id as string}
          onClose={() => setShowAddPanel(false)}
          onAdded={() => { setShowAddPanel(false); loadDashboard(); }}
        />
      )}
      <DashboardView dashboard={dashboard} onRefresh={loadDashboard} />
    </div>
  );
}
