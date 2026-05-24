"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/services/api";
import type { SemanticField, DatasetProfile } from "@/types";

const ROLE_OPTIONS: SemanticField["role"][] = ["dimension", "measure", "date"];
const AGG_OPTIONS = ["SUM", "AVG", "COUNT"] as const;

const FORMAT_OPTIONS = [
  { value: "", label: "None" },
  { value: "currency", label: "$1,234 — Currency" },
  { value: "percent", label: "12.3% — Percent" },
  { value: "number", label: "1,234 — Number" },
  { value: "decimal_2", label: "1234.56 — Decimal (2 places)" },
  { value: "month_year", label: "Jan 2024 — Month Year" },
  { value: "quarter", label: "Q1 2024 — Quarter" },
  { value: "year", label: "2024 — Year" },
  { value: "month_short", label: "Jan — Month Short" },
  { value: "day_month", label: "15 Jan — Day Month" },
  { value: "date_short", label: "01/15/2024 — Date Short" },
  { value: "date_full", label: "Monday, January 15, 2024 — Date Full" },
  { value: "week", label: "W3 2024 — Week" },
  { value: "time", label: "02:30 PM — Time" },
  { value: "datetime", label: "Jan 15, 2024, 02:30 PM — Datetime" },
] as const;

export default function SemanticPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id");
  const dashboardId = searchParams.get("dashboard_id");
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [fields, setFields] = useState<SemanticField[]>([]);
  const [suggestions, setSuggestions] = useState<SemanticField[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) {
      router.push("/dashboards");
      return;
    }

    const load = async () => {
      try {
        const [profileData, suggestedFields] = await Promise.all([
          api.getProfile(datasetId),
          api.getSemanticSuggestions(datasetId).catch(() => null),
        ]);
        setProfile(profileData);

        const initialFields: SemanticField[] = profileData.fields.map((f: any) => {
          const suggestion = suggestedFields?.fields?.find(
            (s: any) => s.field_name === f.field_name
          );
          return {
            field_name: f.field_name,
            role: suggestion?.role || (f.detected_type === "numeric" ? "measure" : "dimension"),
            aggregation:
              suggestion?.aggregation ||
              (f.detected_type === "numeric" ? "SUM" : null),
            formatting: suggestion?.formatting,
            suggested_role: suggestion?.role || null,
            suggested_aggregation: suggestion?.aggregation || null,
            semantic_tags: suggestion?.semantic_tags || [],
          };
        });
        setFields(initialFields);
        if (suggestedFields) setSuggestions(suggestedFields.fields);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [datasetId, router]);

  const updateField = (index: number, updates: Partial<SemanticField>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const handleConfirm = async () => {
    if (!datasetId) return;
    setSaving(true);
    try {
      await api.updateSemantics(datasetId, fields);
      router.push(`/metrics?dataset_id=${datasetId}${dashboardId ? `&dashboard_id=${dashboardId}` : ''}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Confirm Semantics
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review and confirm field roles. AI suggestions shown where available.
        </p>
      </div>

      {dashboardId && (
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/dashboard/${dashboardId}`)} className="px-3 py-1.5 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Field
                </th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Aggregation
                </th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Tags
                </th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Format
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr
                  key={field.field_name}
                  className={`${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {field.field_name}
                      {field.suggested_role && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          AI: {field.suggested_role}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={field.role}
                      onChange={(e) =>
                        updateField(index, {
                          role: e.target.value as SemanticField["role"],
                          aggregation:
                            e.target.value === "measure"
                              ? field.aggregation || "SUM"
                              : null,
                        })
                      }
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {field.role === "measure" ? (
                      <select
                        value={field.aggregation || "SUM"}
                        onChange={(e) =>
                          updateField(index, {
                            aggregation: e.target.value as SemanticField["aggregation"],
                          })
                        }
                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                      >
                        {AGG_OPTIONS.map((agg) => (
                          <option key={agg} value={agg}>
                            {agg}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400 text-xs">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(field.semantic_tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={field.formatting || ""}
                      onChange={(e) =>
                        updateField(index, { formatting: e.target.value })
                      }
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20 w-44"
                    >
                      {FORMAT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="px-6 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Confirm Semantics"}
        </button>
      </div>
    </div>
  );
}
