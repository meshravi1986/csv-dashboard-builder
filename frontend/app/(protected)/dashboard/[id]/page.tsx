"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/services/api";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { AddChartPanel } from "@/components/dashboard/add-chart-panel";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { paletteOptions } from "@/lib/palettes";

export default function DashboardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [suggestedFilters, setSuggestedFilters] = useState<any[]>([]);
  const [activeFilters, setActiveFilters] = useState<any[]>([]);
  const [filterRefreshKey, setFilterRefreshKey] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const unfilteredDataRef = useRef<any>(null);
  const loadAttemptRef = useRef(0);
  const chartsRef = useRef<any>(null);
  chartsRef.current = dashboard?.charts;
  const activeFiltersRef = useRef<any[]>([]);
  activeFiltersRef.current = activeFilters;

  const loadDashboard = useCallback(async () => {
    if (!params.id) return;
    loadAttemptRef.current = 0;
    const tryLoad = async (): Promise<any> => {
      try {
        const data = await api.getDashboard(params.id as string);
        return data;
      } catch (err) {
        if (loadAttemptRef.current < 3) {
          loadAttemptRef.current++;
          await new Promise((r) => setTimeout(r, 800));
          return tryLoad();
        }
        throw err;
      }
    };
    try {
      const data = await tryLoad();
      const saved = localStorage.getItem(`dashboard_color_${params.id}`);
      if (saved) data.color_scheme = saved;
      setDashboard(data);
      setTitleDraft(data.title);
      if (activeFiltersRef.current.length > 0) {
        unfilteredDataRef.current = null;
        setFilterRefreshKey(k => k + 1);
      }
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
    if (!params.id || !chartsRef.current) return;

    const fetchFiltered = async () => {
      if (activeFilters.length === 0) {
        if (unfilteredDataRef.current) {
          setDashboard((prev: any) => {
            if (!prev) return prev;
            return { ...prev, charts: unfilteredDataRef.current };
          });
          unfilteredDataRef.current = null;
        }
        return;
      }

      if (!unfilteredDataRef.current) {
        unfilteredDataRef.current = chartsRef.current;
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
          chartsRef.current.map(async (chart: any) => {
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
  }, [activeFilters, params.id, filterRefreshKey]);

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus();
  }, [editingTitle]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setShowPalettePicker(false);
      }
    };
    if (showPalettePicker) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPalettePicker]);

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== dashboard.title) {
      try {
        await api.updateDashboard(params.id as string, { title: trimmed });
        setDashboard((prev: any) => ({ ...prev, title: trimmed }));
      } catch (err) {
        console.error(err);
      }
    }
    setEditingTitle(false);
  };

  const changeColorScheme = (scheme: string) => {
    setDashboard((prev: any) => ({ ...prev, color_scheme: scheme }));
    localStorage.setItem(`dashboard_color_${params.id}`, scheme);
    setShowPalettePicker(false);
  };

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

  const currentPalette = paletteOptions.find((p) => p.value === (dashboard.color_scheme || "slate")) || paletteOptions[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(dashboard.title); setEditingTitle(false); } }}
              className="text-2xl font-semibold text-slate-900 bg-transparent border-b-2 border-slate-900 outline-none w-full"
            />
          ) : (
            <h1
              className="text-2xl font-semibold text-slate-900 cursor-pointer hover:text-slate-600 transition-colors"
              onClick={() => setEditingTitle(true)}
              title="Click to edit"
            >
              {dashboard.title}
            </h1>
          )}
          {dashboard.description && (
            <p className="text-sm text-slate-500 mt-1">{dashboard.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative" ref={paletteRef}>
            <button
              onClick={() => setShowPalettePicker(!showPalettePicker)}
              className="px-3 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
              title="Change color scheme"
            >
              <span className="flex gap-0.5">
                {currentPalette.colors.slice(0, 4).map((c, i) => (
                  <span key={i} className="w-2 h-4 rounded-sm" style={{ backgroundColor: c }} />
                ))}
              </span>
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPalettePicker && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg p-2 z-20 min-w-[200px]">
                {paletteOptions.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => changeColorScheme(p.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-50 ${p.value === (dashboard.color_scheme || "slate") ? "bg-slate-100" : ""}`}
                  >
                    <span className="flex gap-0.5">
                      {p.colors.slice(0, 4).map((c, i) => (
                        <span key={i} className="w-3 h-4 rounded-sm" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="text-slate-700">{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
