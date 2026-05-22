"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/services/api";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id");
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);
  const [columnMatch, setColumnMatch] = useState<any>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionTag, setVersionTag] = useState("");
  const [versionCreating, setVersionCreating] = useState(false);

  useEffect(() => {
    if (!datasetId) {
      router.push("/dashboards");
      return;
    }
    checkColumnMatch();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [datasetId, router]);

  const checkColumnMatch = async () => {
    try {
      const result = await api.checkColumnMatch(datasetId!);
      const matches = result.matches || [];
      if (matches.length > 0) {
        const match = matches[0];
        setColumnMatch({
          matched_dashboard: {
            id: match.dashboard_id,
            title: match.dashboard_title,
            dataset_id: match.dataset_id,
            version_group_id: match.version_group_id,
            version_count: 0,
          }
        });
        setShowVersionModal(true);
      } else {
        generateDashboard();
      }
    } catch {
      generateDashboard();
    }
  };

  const generateDashboard = async () => {
    if (!datasetId) return;
    setGenerating(true);
    setError(null);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    try {
      const result = await api.generateDashboard(datasetId);
      clearInterval(timerRef.current);
      setDashboard(result);
      router.push(`/dashboard/${result.id}`);
    } catch (err: any) {
      clearInterval(timerRef.current);
      setError(err.message || "Dashboard generation failed");
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!datasetId || !columnMatch?.matched_dashboard) return;
    setVersionCreating(true);
    try {
      const result = await api.createDashboardVersion(
        columnMatch.matched_dashboard.id,
        datasetId,
        versionTag || `v${(columnMatch.matched_dashboard.version_count || 0) + 1}`
      );
      router.push(`/dashboard/${result.id}`);
    } catch (err: any) {
      setError(err.message || "Version creation failed");
      setShowVersionModal(false);
    } finally {
      setVersionCreating(false);
    }
  };

  if (showVersionModal && columnMatch) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md w-full shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Matching Columns Found</h2>
              <p className="text-sm text-slate-500">
                This dataset&apos;s columns match &quot;{columnMatch.matched_dashboard.title}&quot;
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            Would you like to create a new version of the existing dashboard, or generate a brand new dashboard?
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Version Tag <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={versionTag}
                onChange={(e) => setVersionTag(e.target.value)}
                placeholder="e.g. Monthly Refresh"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreateVersion}
                disabled={versionCreating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {versionCreating ? "Creating..." : "Create Version"}
              </button>
              <button
                onClick={() => { setShowVersionModal(false); generateDashboard(); }}
                disabled={versionCreating}
                className="flex-1 px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                New Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || generating) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Generating Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Analyzing data and creating visualizations...
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900" />
            <p className="text-sm text-slate-400">{elapsed}s elapsed</p>
            <div className="space-y-2 text-center">
              <div className="h-4 w-48 bg-slate-100 rounded animate-pulse mx-auto" />
              <div className="h-3 w-32 bg-slate-100 rounded animate-pulse mx-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-red-600 mb-2">{error}</p>
        <button
          onClick={generateDashboard}
          className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {dashboard.title}
          </h1>
          {dashboard.description && (
            <p className="text-sm text-slate-500 mt-1">
              {dashboard.description}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push("/dashboards")}
          className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          All Dashboards
        </button>
      </div>
      <DashboardView dashboard={dashboard} />
    </div>
  );
}
