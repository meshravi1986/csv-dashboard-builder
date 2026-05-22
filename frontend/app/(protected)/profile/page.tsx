"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/services/api";
import type { DatasetProfile } from "@/types";

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id");
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) {
      router.push("/dashboards");
      return;
    }

    const fetchProfile = async () => {
      try {
        const data = await api.getProfile(datasetId);
        setProfile(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [datasetId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => router.push("/upload")}
          className="mt-4 text-sm text-slate-500 hover:text-slate-900"
        >
          Go back to upload
        </button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dataset Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Technical analysis of your dataset
          </p>
        </div>
        <button
          onClick={() => router.push(`/semantic?dataset_id=${datasetId}`)}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Continue to Semantics
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Fields
          </p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {profile.field_count}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Rows
          </p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {profile.row_count.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Null Cells
          </p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {profile.total_null_cells.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-900">Fields</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Field Name
                </th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Type
                </th>
                <th className="text-right px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Null %
                </th>
                <th className="text-right px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Cardinality
                </th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Sample Values
                </th>
              </tr>
            </thead>
            <tbody>
              {profile.fields.map((field, index) => (
                <tr
                  key={field.field_name}
                  className={`${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {field.field_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {field.detected_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {(field.null_percent * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {field.cardinality.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                    {field.sample_values.slice(0, 3).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
