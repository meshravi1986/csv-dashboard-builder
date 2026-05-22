"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/services/api";
import type { Metric } from "@/types";

const AGG_OPTIONS = ["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"] as const;
const OPERATORS = ["+", "-", "*", "/"] as const;

export default function MetricsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [metricMode, setMetricMode] = useState<"simple" | "custom" | "ai">("simple");

  const [aiDescription, setAiDescription] = useState("");
  const [aiSql, setAiSql] = useState("");
  const [aiPreviewValue, setAiPreviewValue] = useState<number | null>(null);
  const [aiPreviewError, setAiPreviewError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreviewing, setAiPreviewing] = useState(false);
  const [editingMetric, setEditingMetric] = useState<any | null>(null);
  const [showSelectPanel, setShowSelectPanel] = useState(false);
  const [availableMetrics, setAvailableMetrics] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectingMetric, setSelectingMetric] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    field_name: "",
    aggregation: "SUM" as string,
    expression: "",
  });

  const [formulaFields, setFormulaFields] = useState<string[]>(["", ""]);
  const [formulaOperators, setFormulaOperators] = useState<string[]>(["-"]);
  const [formulaAggs, setFormulaAggs] = useState<string[]>(["SUM", "SUM"]);

  useEffect(() => {
    if (!datasetId) {
      router.push("/dashboards");
      return;
    }

    const load = async () => {
      try {
        const [profileData, metricsData] = await Promise.all([
          api.getProfile(datasetId),
          api.getMetrics(datasetId).catch(() => ({ metrics: [] })),
        ]);
        setAvailableFields(
          profileData.fields.map((f: any) => f.field_name)
        );
        setMetrics(metricsData.metrics || []);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [datasetId, router]);

  const formatField = (name: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) ? name : `"${name}"`;

  const buildFormulaExpr = () => {
    let expr = "";
    for (let i = 0; i < formulaFields.length; i++) {
      if (!formulaFields[i]) return "";
      const agg = formulaAggs[i] || "SUM";
      expr += `${agg}(${formatField(formulaFields[i])})`;
      if (i < formulaOperators.length) {
        expr += ` ${formulaOperators[i]} `;
      }
    }
    return expr;
  };

  const parseFormulaExpr = (formula: string) => {
    const regex = /(\w+)\(\s*"([^"]+)"\s*\)|(\w+)\(([^)]+)\)/g;
    const fields: string[] = [];
    const ops: string[] = [];
    const aggs: string[] = [];
    const matchRanges: { start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(formula)) !== null) {
      aggs.push((m[1] || m[3]).toUpperCase());
      fields.push((m[2] || m[4]).trim());
      matchRanges.push({ start: m.index, end: m.index + m[0].length });
    }
    for (let i = 0; i < fields.length - 1; i++) {
      const gap = formula.slice(matchRanges[i].end, matchRanges[i + 1].start).trim();
      const op = gap.split(/\s+/).find((o) => ["+", "-", "*", "/"].includes(o)) || "+";
      ops.push(op);
    }
    return { fields, ops, aggs };
  };

  const handleSaveMetric = async () => {
    if (!datasetId || !formData.name) return;
    if (metricMode === "simple" && !formData.field_name) return;
    if (metricMode === "custom") {
      const expr = buildFormulaExpr();
      if (!expr) return;
      formData.expression = expr;
    }
    if (metricMode === "ai" && !aiSql) return;

    setCreating(true);
    try {
      const payload: any = { name: formData.name };
      if (metricMode === "simple") {
        payload.field_name = formData.field_name;
        payload.aggregation = formData.aggregation;
      } else if (metricMode === "custom") {
        payload.field_name = "";
        payload.formula = buildFormulaExpr();
      } else {
        payload.field_name = "";
        payload.formula = aiSql;
      }
      if (editingMetric) {
        const result = await api.updateMetric(datasetId, editingMetric.id, payload);
        setMetrics((prev) => prev.map((m) => (m.id === editingMetric.id ? result : m)));
      } else {
        const result = await api.createMetric(datasetId, payload);
        setMetrics((prev) => [...prev, result]);
      }
      setShowForm(false);
      setEditingMetric(null);
      resetForm();
    } catch (err: any) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", field_name: "", aggregation: "SUM", expression: "" });
    setFormulaFields(["", ""]);
    setFormulaOperators(["-"]);
    setFormulaAggs(["SUM", "SUM"]);
    setAiDescription("");
    setAiSql("");
    setAiPreviewValue(null);
    setAiPreviewError(null);
    setMetricMode("simple");
  };

  const addFormulaField = () => {
    setFormulaFields((prev) => [...prev, ""]);
    setFormulaOperators((prev) => [...prev, "+"]);
    setFormulaAggs((prev) => [...prev, "SUM"]);
  };

  const removeFormulaField = (idx: number) => {
    if (formulaFields.length <= 2) return;
    setFormulaFields((prev) => prev.filter((_, i) => i !== idx));
    setFormulaOperators((prev) => prev.filter((_, i) => i !== idx && i !== idx - 1));
    setFormulaAggs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEditMetric = (metric: any) => {
    setEditingMetric(metric);
    setFormData({
      name: metric.name,
      field_name: metric.field_name || "",
      aggregation: metric.aggregation || "SUM",
      expression: metric.expression || "",
    });
    if (metric.formula) {
      setMetricMode("custom");
      const parsed = parseFormulaExpr(metric.formula);
      if (parsed.fields.length >= 2) {
        setFormulaFields(parsed.fields);
        setFormulaAggs(parsed.aggs);
        const ops = parsed.ops.length >= parsed.fields.length - 1
          ? parsed.ops.slice(0, parsed.fields.length - 1)
          : Array(parsed.fields.length - 1).fill("-");
        setFormulaOperators(ops);
      } else {
        const parts = metric.formula.split(/\s*[+\-*/]\s*/);
        const ops = metric.formula.match(/[+\-*/]/g) || [];
        if (parts.length >= 2) {
          setFormulaFields(parts);
          setFormulaAggs(parts.map(() => "SUM"));
          setFormulaOperators(ops.slice(0, parts.length - 1));
        } else {
          setFormulaFields(["", ""]);
          setFormulaOperators(["-"]);
          setFormulaAggs(["SUM", "SUM"]);
        }
      }
    } else {
      setMetricMode("simple");
    }
    setShowForm(true);
  };

  const handleDeleteMetric = async (metricId: string) => {
    if (!datasetId) return;
    try {
      await api.deleteMetric(datasetId, metricId);
      setMetrics((prev) => prev.filter((m) => m.id !== metricId));
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadAvailableMetrics = async () => {
    if (!datasetId) return;
    setLoadingAvailable(true);
    setShowSelectPanel(true);
    try {
      const data = await api.getAvailableMetrics(datasetId);
      setAvailableMetrics(data.metrics || []);
    } catch (err) {
      console.error(err);
      setAvailableMetrics([]);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleSelectMetric = async (metric: any) => {
    if (!datasetId) return;
    setSelectingMetric(metric.id);
    try {
      const payload: any = { name: metric.name };
      if (metric.formula) {
        payload.field_name = "";
        payload.formula = metric.formula;
      } else {
        payload.field_name = metric.field_name;
        payload.aggregation = metric.aggregation;
      }
      const result = await api.createMetric(datasetId, payload);
      setMetrics((prev) => [...prev, result]);
      setAvailableMetrics((prev) => prev.filter((m) => m.id !== metric.id));
    } catch (err: any) {
      console.error(err);
    } finally {
      setSelectingMetric(null);
    }
  };

  const handleGenerate = () => {
    if (!datasetId) return;
    router.push(`/dashboard?dataset_id=${datasetId}`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Metrics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define metrics for your dashboard
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setEditingMetric(null); setShowForm(true); resetForm(); }}
            className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Add Metric
          </button>
          <button
            onClick={loadAvailableMetrics}
            disabled={loadingAvailable}
            className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {loadingAvailable ? "Loading..." : "Select Metrics"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={metrics.length === 0}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Generate Dashboard
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900">{editingMetric ? "Edit Metric" : "New Metric"}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setMetricMode("simple")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${metricMode === "simple" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Simple
              </button>
              <button
                onClick={() => setMetricMode("custom")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${metricMode === "custom" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Custom
              </button>
              <button
                onClick={() => setMetricMode("ai")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${metricMode === "ai" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                AI
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Total Revenue"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>

          {metricMode === "simple" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Field</label>
                <select
                  value={formData.field_name}
                  onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option value="">Select field...</option>
                  {availableFields.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Aggregation</label>
                <select
                  value={formData.aggregation}
                  onChange={(e) => setFormData({ ...formData, aggregation: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  {AGG_OPTIONS.map((agg) => (
                    <option key={agg} value={agg}>{agg === "COUNT_DISTINCT" ? "COUNT DISTINCT" : agg}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : metricMode === "ai" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Describe your metric</label>
                <textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="e.g., Total active customer percentage"
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
                />
              </div>
              <button
                onClick={async () => {
                  if (!datasetId || !aiDescription) return;
                  setAiGenerating(true);
                  setAiSql("");
                  setAiPreviewValue(null);
                  setAiPreviewError(null);
                  try {
                    const result = await api.suggestSQL(datasetId, aiDescription);
                    setAiSql(result.sql);
                  } catch (err: any) {
                    setAiPreviewError(err.message);
                  } finally {
                    setAiGenerating(false);
                  }
                }}
                disabled={aiGenerating || !aiDescription}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {aiGenerating ? "Generating..." : "Generate SQL"}
              </button>
              {aiSql && (
                <>
                  <div>
                    <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Generated SQL</label>
                    <textarea
                      value={aiSql}
                      onChange={(e) => { setAiSql(e.target.value); setAiPreviewValue(null); setAiPreviewError(null); }}
                      rows={3}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!datasetId || !aiSql) return;
                      setAiPreviewing(true);
                      setAiPreviewValue(null);
                      setAiPreviewError(null);
                      try {
                        const result = await api.previewSQL(datasetId, aiSql);
                        if (result.error) setAiPreviewError(result.error);
                        else setAiPreviewValue(result.value);
                      } catch (err: any) {
                        setAiPreviewError(err.message);
                      } finally {
                        setAiPreviewing(false);
                      }
                    }}
                    disabled={aiPreviewing}
                    className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {aiPreviewing ? "Previewing..." : "Preview Value"}
                  </button>
                  {aiPreviewValue !== null && (
                    <div className="text-sm bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded">
                      Preview: {aiPreviewValue}
                    </div>
                  )}
                  {aiPreviewError && (
                    <div className="text-sm bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded">
                      Error: {aiPreviewError}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Formula</label>
              {formulaFields.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {idx > 0 && (
                    <select
                      value={formulaOperators[idx - 1]}
                      onChange={(e) => {
                        const next = [...formulaOperators];
                        next[idx - 1] = e.target.value;
                        setFormulaOperators(next);
                      }}
                      className="w-14 px-1 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  )}
                  <select
                    value={formulaAggs[idx]}
                    onChange={(e) => {
                      const next = [...formulaAggs];
                      next[idx] = e.target.value;
                      setFormulaAggs(next);
                    }}
                    className="w-28 px-2 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  >
                    {AGG_OPTIONS.map((agg) => (
                      <option key={agg} value={agg}>{agg === "COUNT_DISTINCT" ? "COUNT DISTINCT" : agg}</option>
                    ))}
                  </select>
                  <select
                    value={field}
                    onChange={(e) => {
                      const next = [...formulaFields];
                      next[idx] = e.target.value;
                      setFormulaFields(next);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  >
                    <option value="">Select field...</option>
                    {availableFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {formulaFields.length > 2 && (
                    <button
                      onClick={() => removeFormulaField(idx)}
                      className="text-slate-400 hover:text-red-500 px-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addFormulaField}
                className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
              >
                + Add Field
              </button>
              {buildFormulaExpr() && (
                <div className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded">
                  Expression: {buildFormulaExpr()}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowForm(false); setEditingMetric(null); resetForm(); }}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMetric}
              disabled={
                creating ||
                !formData.name ||
                (metricMode === "simple" && !formData.field_name) ||
                (metricMode === "custom" && formulaFields.some((f) => !f)) ||
                (metricMode === "ai" && !aiSql)
              }
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {creating ? "Saving..." : editingMetric ? "Update Metric" : "Create Metric"}
            </button>
          </div>
        </div>
      )}

      {showSelectPanel && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900">Select Metric from Other Datasets</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowSelectPanel(false); }}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
              <button
                onClick={() => { setShowSelectPanel(false); setAvailableMetrics([]); }}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>
          </div>

          {loadingAvailable ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900" />
            </div>
          ) : availableMetrics.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400">No reusable metrics found</p>
              <p className="text-xs text-slate-300 mt-1">
                Metrics from other datasets are shown here when all their required fields exist in this dataset
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {availableMetrics.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {m.formula || `${m.aggregation}(${m.field_name})`}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400">from {m.source_dataset_name}</span>
                      <span className="text-xs text-slate-400">fields: {m.required_fields?.join(", ")}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectMetric(m)}
                    disabled={selectingMetric === m.id}
                    className="ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {selectingMetric === m.id ? "Adding..." : "Select"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {metrics.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-400">No metrics defined yet</p>
          <p className="text-xs text-slate-300 mt-1">
            Click "Add Metric" to define your first metric
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {metric.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {metric.formula || `${metric.aggregation}(${metric.field_name})`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                  {metric.formula ? "Formula" : (metric.aggregation === "COUNT_DISTINCT" ? "COUNT DISTINCT" : metric.aggregation)}
                </span>
                <button
                  onClick={() => handleEditMetric(metric)}
                  className="text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit metric"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteMetric(metric.id)}
                  className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete metric"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
