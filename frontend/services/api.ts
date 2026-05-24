import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const FETCH_TIMEOUT = 30000;

let _cachedToken: string | null = null;
let _tokenPromise: Promise<string | null> | null = null;

async function _getToken(): Promise<string | null> {
  if (_cachedToken) return _cachedToken;
  if (_tokenPromise) return _tokenPromise;
  _tokenPromise = supabase.auth.getSession().then(({ data: { session } }) => {
    _cachedToken = session?.access_token ?? null;
    _tokenPromise = null;
    return _cachedToken;
  });
  return _tokenPromise;
}

function _clearToken() {
  _cachedToken = null;
}

async function _authHeaders(): Promise<HeadersInit> {
  const token = await _getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function _uploadAuthHeaders(): Promise<{ Authorization?: string }> {
  const token = await _getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class ApiService {
  private baseUrl: string;
  private _inflight: Map<string, Promise<any>> = new Map();

  constructor() {
    this.baseUrl = API_URL;
  }

  private _fetchKey(input: RequestInfo | URL, init?: RequestInit): string {
    const method = (init?.method as string) || "GET";
    const body = init?.body ? JSON.stringify(init.body) : "";
    return `${method}:${input}:${body}`;
  }

  private async _dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this._inflight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = fn().finally(() => this._inflight.delete(key));
    this._inflight.set(key, promise);
    return promise;
  }

  private _errMsg(detail: string, fallback: string): string {
    return detail || fallback;
  }

  private async _fetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      if (res.status === 401) _clearToken();
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  private async _request<T = any>(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT, errorMsg = "Request failed"): Promise<T> {
    const headers = await _authHeaders();
    const res = await this._fetch(url, { ...init, headers }, timeoutMs);
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({ detail: "" }))).detail;
      throw new Error(this._errMsg(detail, errorMsg));
    }
    return res.json();
  }

  private async _dedupRequest<T = any>(url: string, init?: RequestInit, timeoutMs?: number, errorMsg?: string): Promise<T> {
    return this._dedup(this._fetchKey(url, init), () => this._request<T>(url, init, timeoutMs, errorMsg));
  }

  async uploadCSV(file: File, onProgress?: (progress: number) => void) {
    const headers = await _uploadAuthHeaders();
    const formData = new FormData();
    formData.append("file", file);

    return new Promise<{ dataset_id: string; column_match?: any }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            reject(new Error(JSON.parse(xhr.responseText).detail));
          } catch {
            reject(new Error("Upload failed"));
          }
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Upload failed")));
      xhr.addEventListener("timeout", () => reject(new Error("Upload timed out after 2 minutes")));
      xhr.timeout = 120000;
      xhr.open("POST", `${this.baseUrl}/upload`);
      if (headers.Authorization) {
        xhr.setRequestHeader("Authorization", headers.Authorization);
      }
      xhr.send(formData);
    });
  }

  async getProfile(datasetId: string) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/profile`, undefined, 120000, "Profile fetch failed");
  }

  async updateSemantics(datasetId: string, fields: any[]) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/semantics`, { method: "PUT", body: JSON.stringify({ fields }) }, undefined, "Semantic update failed");
  }

  async getSemanticSuggestions(datasetId: string) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/semantics/suggest`, undefined, 120000, "Suggestions failed");
  }

  async getAllMetrics() {
    return this._request(`${this.baseUrl}/datasets/metrics/all`, undefined, undefined, "Metrics fetch failed");
  }

  async getChartDataFiltered(dashboardId: string, chartId: string, filters: any[]) {
    return this._request(`${this.baseUrl}/dashboards/${dashboardId}/charts/${chartId}/data`, { method: "POST", body: JSON.stringify({ filters }) }, undefined, "Chart data fetch failed");
  }

  async getAllChartDataFiltered(dashboardId: string, filters: any[]) {
    return this._request(`${this.baseUrl}/dashboards/${dashboardId}/data`, { method: "POST", body: JSON.stringify({ filters }) }, undefined, "Batch chart data fetch failed");
  }

  async suggestFilters(dashboardId: string) {
    return this._dedupRequest(`${this.baseUrl}/dashboards/${dashboardId}/filters/suggest`);
  }

  async getAvailableMetrics(datasetId: string) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/metrics/available`, undefined, undefined, "Available metrics fetch failed");
  }

  async getMetrics(datasetId: string) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/metrics`, undefined, undefined, "Metrics fetch failed");
  }

  async createMetric(datasetId: string, metric: any) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/metrics`, { method: "POST", body: JSON.stringify(metric) }, undefined, "Metric creation failed");
  }

  async updateMetric(datasetId: string, metricId: string, metric: any) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/metrics/${metricId}`, { method: "PUT", body: JSON.stringify(metric) }, undefined, "Metric update failed");
  }

  async suggestSQL(datasetId: string, description: string) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/metrics/suggest-sql`, { method: "POST", body: JSON.stringify({ description }) }, undefined, "SQL suggestion failed");
  }

  async previewSQL(datasetId: string, sql: string) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/metrics/preview-sql`, { method: "POST", body: JSON.stringify({ sql }) }, undefined, "SQL preview failed");
  }

  async deleteMetric(datasetId: string, metricId: string) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/metrics/${metricId}`, { method: "DELETE" }, undefined, "Metric delete failed");
  }

  async generateDashboard(datasetId: string) {
    return this._dedup(`${this.baseUrl}/gen:${datasetId}`, async () => {
      const headers = await _authHeaders();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await this._fetch(`${this.baseUrl}/datasets/${datasetId}/dashboard/generate`, { method: "POST", headers }, 120000);
          if (res.ok) return res.json();
          const err = await res.json().catch(() => ({ detail: "Dashboard generation failed" }));
          if (attempt < 2 && res.status >= 500) continue;
          throw new Error(err.detail || "Dashboard generation failed");
        } catch (e: any) {
          if (attempt < 2 && (e.name === "AbortError" || e.message?.includes("fetch failed"))) continue;
          throw e;
        }
      }
    });
  }

  async regenerateDashboard(datasetId: string, dashboardId: string) {
    const headers = await _authHeaders();
    const res = await this._fetch(`${this.baseUrl}/datasets/${datasetId}/dashboard/generate?dashboard_id=${dashboardId}`, { method: "POST", headers }, 120000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Dashboard regeneration failed" }));
      throw new Error(err.detail || "Dashboard regeneration failed");
    }
    return res.json();
  }

  async getDashboards() {
    return this._request(`${this.baseUrl}/dashboards`, undefined, undefined, "Dashboards fetch failed");
  }

  async getDashboard(id: string) {
    return this._request(`${this.baseUrl}/dashboards/${id}`, undefined, undefined, "Dashboard fetch failed");
  }

  async updateDashboard(id: string, data: any) {
    return this._request(`${this.baseUrl}/dashboards/${id}`, { method: "PUT", body: JSON.stringify(data) }, undefined, "Dashboard update failed");
  }

  async getAvailableFields(dashboardId: string) {
    return this._request(`${this.baseUrl}/dashboards/${dashboardId}/available-fields`, undefined, undefined, "Fields fetch failed");
  }

  async addChart(dashboardId: string, chart: any) {
    return this._request(`${this.baseUrl}/dashboards/${dashboardId}/charts`, { method: "POST", body: JSON.stringify(chart) }, undefined, "Chart add failed");
  }

  async deleteChart(dashboardId: string, chartId: string) {
    return this._request(`${this.baseUrl}/dashboards/${dashboardId}/charts/${chartId}`, { method: "DELETE" }, undefined, "Chart delete failed");
  }

  async reorderCharts(dashboardId: string, chartIds: string[]) {
    return this._request(`${this.baseUrl}/dashboards/${dashboardId}/charts/reorder`, { method: "PUT", body: JSON.stringify({ chart_ids: chartIds }) }, undefined, "Reorder failed");
  }

  async deleteDashboard(id: string) {
    return this._request(`${this.baseUrl}/dashboards/${id}`, { method: "DELETE" }, undefined, "Dashboard delete failed");
  }

  async checkColumnMatch(datasetId: string) {
    return this._request(`${this.baseUrl}/datasets/${datasetId}/column-match`, undefined, undefined, "Column match check failed");
  }

  async createDashboardVersion(dashboardId: string, newDatasetId: string, refreshFrequency: string, tag: string) {
    return this._request(`${this.baseUrl}/dashboards/${dashboardId}/create-version`, { method: "POST", body: JSON.stringify({ new_dataset_id: newDatasetId, refresh_frequency: refreshFrequency, tag }) }, undefined, "Version creation failed");
  }

  async getDashboardVersions(versionGroupId: string) {
    return this._request(`${this.baseUrl}/dashboards/by-group/${versionGroupId}/versions`, undefined, undefined, "Versions fetch failed");
  }

  async createTab(dashboardId: string, title: string) {
    return this._request(`${this.baseUrl}/dashboards/${dashboardId}/tabs`, { method: "POST", body: JSON.stringify({ title }) }, undefined, "Tab creation failed");
  }

  async renameTab(tabId: string, title: string) {
    return this._request(`${this.baseUrl}/dashboards/tabs/${tabId}`, { method: "PUT", body: JSON.stringify({ title }) }, undefined, "Tab rename failed");
  }

  async deleteTab(tabId: string) {
    return this._request(`${this.baseUrl}/dashboards/tabs/${tabId}`, { method: "DELETE" }, undefined, "Tab delete failed");
  }
}

export const api = new ApiService();
