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

  useEffect(() => {
    if (!datasetId) {
      router.push("/dashboards");
      return;
    }
    generateDashboard();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [datasetId, router]);

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
