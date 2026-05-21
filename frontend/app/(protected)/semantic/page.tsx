"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/services/api";
import type { SemanticField, DatasetProfile } from "@/types";

const ROLE_OPTIONS: SemanticField["role"][] = ["dimension", "measure", "date"];
const AGG_OPTIONS: SemanticField["aggregation"][] = ["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"];

export default function SemanticPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id");
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [fields, setFields] = useState<SemanticField[]>([]);
  const [suggestions, setSuggestions] = useState<SemanticField[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) {
      router.push("/upload");
      return;
    }

    const load = async () => {
      try {
        const [profileData, suggestedFields] = await Promise.all([
          api.getProfile(datasetId),
          api.getSemanticSuggestions(datasetId).catch(() => null),
        ]);
        setProfile(profileData);

        const initialFields: SemanticField[] = profileData.fields.map((f) => {
          const suggestion = suggestedFields?.fields?.find(
            (s: any) => s.field_name === f.field_name
          );
          return {
            field_name: f.field_name,
            role: suggestion?.role || (f.detected_type === "numeric" ? "measure" : "dimension"),
            aggregation:
              suggestion?.aggregation ||
              (f.detected_type === "numeric" ? "SUM" : null),
            suggested_role: suggestion?.role || null,
            suggested_aggregation: suggestion?.aggregation || null,
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
      router.push(`/metrics?dataset_id=${datasetId}`);
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
                    <input
                      type="text"
                      value={field.formatting || ""}
                      onChange={(e) =>
                        updateField(index, { formatting: e.target.value })
                      }
                      placeholder="e.g., $#,###"
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20 w-28"
                    />
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
