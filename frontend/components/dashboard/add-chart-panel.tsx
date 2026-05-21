"use client";

import { useState, useEffect } from "react";
import { api } from "@/services/api";

interface AddChartPanelProps {
  dashboardId: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddChartPanel({ dashboardId, onClose, onAdded }: AddChartPanelProps) {
  const [mode, setMode] = useState<"chart" | "kpi">("chart");
  const [fields, setFields] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [chartType, setChartType] = useState("bar");
  const [xField, setXField] = useState("");
  const [yField, setYField] = useState("");
  const [aggregation, setAggregation] = useState("SUM");
  const [metricId, setMetricId] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getAvailableFields(dashboardId);
        setFields(data.fields || []);
        setMetrics(data.metrics || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dashboardId]);

  const dimensions = fields.filter((f) => f.role === "dimension");
  const dateFields = fields.filter((f) => f.role === "date");
  const measures = fields.filter((f) => f.role === "measure");

  const xFieldOptions = chartType === "scatter" ? measures : [...dateFields, ...dimensions];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (mode === "kpi") {
        if (metricId) {
          const metric = metrics.find((m) => m.id === metricId);
          if (!metric) return;
          await api.addChart(dashboardId, {
            chart_type: "kpi",
            x_field: "",
            y_field: metric.field_name,
            aggregation: metric.aggregation,
            title: metric.name,
          });
        } else {
          await api.addChart(dashboardId, {
            chart_type: "kpi",
            x_field: "",
            y_field: yField,
            aggregation,
            title: title || `Total ${yField}`,
          });
        }
      } else {
        await api.addChart(dashboardId, {
          chart_type: chartType,
          x_field: xField,
          y_field: yField,
          aggregation,
          title: title || `${aggregation}(${yField}) by ${xField}`,
        });
      }
      onAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="animate-pulse h-4 w-32 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-900">Add to Dashboard</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("chart")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${mode === "chart" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Chart
        </button>
        <button
          onClick={() => setMode("kpi")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${mode === "kpi" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          KPI Card
        </button>
      </div>

      {mode === "chart" ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Chart Type</label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
              <option value="scatter">Scatter</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              X Field {chartType === "scatter" ? "(Measure)" : "(Dimension/Date)"}
            </label>
            <select
              value={xField}
              onChange={(e) => setXField(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            >
              <option value="">Select...</option>
              {xFieldOptions.map((f: any) => (
                <option key={f.field_name} value={f.field_name}>{f.field_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Y Field (Measure)</label>
            <select
              value={yField}
              onChange={(e) => setYField(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            >
              <option value="">Select...</option>
              {measures.map((f: any) => (
                <option key={f.field_name} value={f.field_name}>{f.field_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Aggregation</label>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            >
              <option value="SUM">SUM</option>
              <option value="AVG">AVG</option>
              <option value="COUNT">COUNT</option>
              <option value="MIN">MIN</option>
              <option value="MAX">MAX</option>
              <option value="COUNT_DISTINCT">COUNT DISTINCT</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated if empty"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Existing Metric</label>
              <select
                value={metricId}
                onChange={(e) => setMetricId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              >
                <option value="">Custom KPI (define below)</option>
                {metrics.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          {!metricId && (
            <>
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Field</label>
                <select
                  value={yField}
                  onChange={(e) => setYField(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option value="">Select field...</option>
                  {fields.map((f: any) => (
                    <option key={f.field_name} value={f.field_name}>{f.field_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Aggregation</label>
                <select
                  value={aggregation}
                  onChange={(e) => setAggregation(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option value="SUM">SUM</option>
                  <option value="AVG">AVG</option>
                  <option value="COUNT">COUNT</option>
                  <option value="MIN">MIN</option>
                  <option value="MAX">MAX</option>
                  <option value="COUNT_DISTINCT">COUNT DISTINCT</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Total Revenue"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || (mode === "chart" ? !xField || !yField : !metricId && !yField)}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {submitting ? "Adding..." : mode === "chart" ? "Add Chart" : "Add KPI"}
        </button>
      </div>
    </div>
  );
}
