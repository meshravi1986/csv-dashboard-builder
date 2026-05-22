"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api } from "@/services/api";
import ProductTour from "@/components/onboarding/product-tour";

const steps = [
  { number: 1, title: "Upload CSV", desc: "Import your data — CSV or spreadsheet files", icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
  { number: 2, title: "Review Profile", desc: "Auto-detect data types, nulls, and distributions", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { number: 3, title: "Set Semantics", desc: "Tag fields as dimensions, measures, or dates", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  { number: 4, title: "Define Metrics", desc: "Create KPIs with formulas or use AI generation", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { number: 5, title: "Generate Dashboard", desc: "Auto-build charts and interactive dashboards", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
];

export default function DashboardsPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [workflowDismissed, setWorkflowDismissed] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [userId, setUserId] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const stored = localStorage.getItem("dashboards_view_mode");
    if (stored === "list") setViewMode("list");
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem("workflow_dismissed");
    if (dismissed === "true") setWorkflowDismissed(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || "";
      setUserId(uid);
      const key = `tour_completed_${uid}`;
      const tourCompleted = localStorage.getItem(key);
      if (tourCompleted !== "true") { setIsFirstTime(true); setShowTour(true); }
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getDashboards();
        setDashboards(data.dashboards || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const dismissWorkflow = () => {
    setWorkflowDismissed(true);
    localStorage.setItem("workflow_dismissed", "true");
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this dashboard? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await api.deleteDashboard(id);
      setDashboards((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  const showWorkflow = dashboards.length < 3 && !workflowDismissed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Dashboards</h1>
          <p className="text-sm text-slate-500 mt-1">
            {dashboards.length === 0 ? "Get started by uploading your first CSV file" : "Your saved dashboards"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => { setViewMode("grid"); localStorage.setItem("dashboards_view_mode", "grid"); }}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
            <button
              onClick={() => { setViewMode("list"); localStorage.setItem("dashboards_view_mode", "list"); }}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => setShowTour(true)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Show tour"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => router.push("/upload")}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            New Dashboard
          </button>
        </div>
      </div>

      {dashboards.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((d) => (
            <div
              key={d.id}
              onClick={() => router.push(`/dashboard/${d.id}`)}
              className="bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all relative group"
            >
              <button
                onClick={(e) => handleDelete(e, d.id)}
                disabled={deleting === d.id}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
              >
                <svg className="w-4 h-4 text-slate-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{d.title}</p>
                  <p className="text-xs text-slate-400">{d.charts?.length || 0} charts</p>
                </div>
              </div>
              {d.description && <p className="text-xs text-slate-500 line-clamp-2">{d.description}</p>}
              <p className="text-xs text-slate-300 mt-3">{new Date(d.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {dashboards.length > 0 && viewMode === "list" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">Charts</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-5 py-3">Created</th>
                <th className="w-10 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {dashboards.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => router.push(`/dashboard/${d.id}`)}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-slate-900">{d.title}</p>
                    {d.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{d.description}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{d.charts?.length || 0}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-400">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={(e) => handleDelete(e, d.id)}
                      disabled={deleting === d.id}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dashboards.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 mb-4">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 font-medium">No dashboards yet</p>
          <p className="text-xs text-slate-400 mt-1">Follow the workflow below to create your first dashboard</p>
          <button
            onClick={() => router.push("/upload")}
            className="mt-4 px-6 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload your first CSV
          </button>
        </div>
      )}

      {showWorkflow && (
        <div className="relative bg-white rounded-xl border border-slate-200 p-6">
          <button
            onClick={dismissWorkflow}
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            title="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h3 className="text-sm font-medium text-slate-700 mb-4">How it works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-5 -right-3 z-10">
                    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-semibold mb-3">
                  {step.number}
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">{step.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showTour && <ProductTour onClose={() => setShowTour(false)} mandatory={isFirstTime} userId={userId} />}
    </div>
  );
}
