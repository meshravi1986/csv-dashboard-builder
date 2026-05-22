const ENV_URL = process.env.NEXT_PUBLIC_API_URL || "";
const API_URL = ENV_URL || "http://localhost:8000";

// Debug: log the actual API URL being used
if (typeof window !== "undefined") {
  console.log("[API] NEXT_PUBLIC_API_URL from env:", JSON.stringify(process.env.NEXT_PUBLIC_API_URL));
  console.log("[API] Final API_URL:", API_URL);
}

const FETCH_TIMEOUT = 30000;

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const { supabase } = await import("@/lib/supabase");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    };
  }

  private async apiFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  async uploadCSV(file: File, onProgress?: (progress: number) => void) {
    const { supabase } = await import("@/lib/supabase");
    const {
      data: { session },
    } = await supabase.auth.getSession();

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
      if (session?.access_token) {
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      }
      xhr.send(formData);
    });
  }

  async getProfile(datasetId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/profile`, { headers }, 120000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Profile fetch failed" }));
      throw new Error(err.detail || "Profile fetch failed");
    }
    return res.json();
  }

  async updateSemantics(datasetId: string, fields: any[]) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/semantics`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Semantic update failed" }));
      throw new Error(err.detail || "Semantic update failed");
    }
    return res.json();
  }

  async getSemanticSuggestions(datasetId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/semantics/suggest`, { headers }, 120000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Suggestions failed" }));
      throw new Error(err.detail || "Suggestions failed");
    }
    return res.json();
  }

  async getAllMetrics() {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/metrics/all`, { headers });
    if (!res.ok) throw new Error("Metrics fetch failed");
    return res.json();
  }

  async getChartDataFiltered(dashboardId: string, chartId: string, filters: any[]) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${dashboardId}/charts/${chartId}/data`, {
      method: "POST",
      headers,
      body: JSON.stringify({ filters }),
    });
    if (!res.ok) throw new Error("Chart data fetch failed");
    return res.json();
  }

  async getAllChartDataFiltered(dashboardId: string, filters: any[]) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${dashboardId}/data`, {
      method: "POST",
      headers,
      body: JSON.stringify({ filters }),
    });
    if (!res.ok) throw new Error("Batch chart data fetch failed");
    return res.json();
  }

  async suggestFilters(dashboardId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${dashboardId}/filters/suggest`, { headers });
    if (!res.ok) throw new Error("Filter suggestions failed");
    return res.json();
  }

  async getAvailableMetrics(datasetId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/metrics/available`, { headers });
    if (!res.ok) throw new Error("Available metrics fetch failed");
    return res.json();
  }

  async getMetrics(datasetId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/metrics`, {
      headers,
    });
    if (!res.ok) throw new Error("Metrics fetch failed");
    return res.json();
  }

  async createMetric(datasetId: string, metric: any) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/metrics`, {
      method: "POST",
      headers,
      body: JSON.stringify(metric),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Metric creation failed" }));
      throw new Error(err.detail || "Metric creation failed");
    }
    return res.json();
  }

  async updateMetric(datasetId: string, metricId: string, metric: any) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/metrics/${metricId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(metric),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Metric update failed" }));
      throw new Error(err.detail || "Metric update failed");
    }
    return res.json();
  }

  async suggestSQL(datasetId: string, description: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/metrics/suggest-sql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ description }),
    });
    if (!res.ok) throw new Error("SQL suggestion failed");
    return res.json();
  }

  async previewSQL(datasetId: string, sql: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/metrics/preview-sql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sql }),
    });
    if (!res.ok) throw new Error("SQL preview failed");
    return res.json();
  }

  async deleteMetric(datasetId: string, metricId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/metrics/${metricId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error("Metric delete failed");
    return res.json();
  }

  async generateDashboard(datasetId: string) {
    const headers = await this.getAuthHeaders();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.apiFetch(
          `${this.baseUrl}/datasets/${datasetId}/dashboard/generate`,
          { method: "POST", headers },
          120000
        );
        if (res.ok) return res.json();
        const err = await res.json().catch(() => ({ detail: "Dashboard generation failed" }));
        if (attempt < 2 && res.status >= 500) continue;
        throw new Error(err.detail || "Dashboard generation failed");
      } catch (e: any) {
        if (attempt < 2 && (e.name === "AbortError" || e.message?.includes("fetch failed") || e.message?.includes("The operation was aborted"))) continue;
        throw e;
      }
    }
  }

  async getDashboards() {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards`, { headers });
    if (!res.ok) throw new Error("Dashboards fetch failed");
    return res.json();
  }

  async getDashboard(id: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${id}`, { headers });
    if (!res.ok) throw new Error("Dashboard fetch failed");
    return res.json();
  }

  async updateDashboard(id: string, data: any) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Dashboard update failed" }));
      throw new Error(err.detail || "Dashboard update failed");
    }
    return res.json();
  }

  async getAvailableFields(dashboardId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${dashboardId}/available-fields`, { headers });
    if (!res.ok) throw new Error("Fields fetch failed");
    return res.json();
  }

  async addChart(dashboardId: string, chart: any) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${dashboardId}/charts`, {
      method: "POST",
      headers,
      body: JSON.stringify(chart),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Chart add failed" }));
      throw new Error(err.detail || "Chart add failed");
    }
    return res.json();
  }

  async deleteChart(dashboardId: string, chartId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${dashboardId}/charts/${chartId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error("Chart delete failed");
    return res.json();
  }

  async reorderCharts(dashboardId: string, chartIds: string[]) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${dashboardId}/charts/reorder`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ chart_ids: chartIds }),
    });
    if (!res.ok) throw new Error("Reorder failed");
    return res.json();
  }

  async deleteDashboard(id: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error("Dashboard delete failed");
    return res.json();
  }

  async queryParquet(datasetId: string, query: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ dataset_id: datasetId, query }),
    });
    if (!res.ok) throw new Error("Query failed");
    return res.json();
  }

  async checkColumnMatch(datasetId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/datasets/${datasetId}/column-match`, { headers });
    if (!res.ok) throw new Error("Column match check failed");
    return res.json();
  }

  async createDashboardVersion(dashboardId: string, newDatasetId: string, refreshFrequency: string, tag: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/${dashboardId}/create-version`, {
      method: "POST",
      headers,
      body: JSON.stringify({ new_dataset_id: newDatasetId, refresh_frequency: refreshFrequency, tag }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Version creation failed" }));
      throw new Error(err.detail || "Version creation failed");
    }
    return res.json();
  }

  async getDashboardVersions(versionGroupId: string) {
    const headers = await this.getAuthHeaders();
    const res = await this.apiFetch(`${this.baseUrl}/dashboards/by-group/${versionGroupId}/versions`, { headers });
    if (!res.ok) throw new Error("Versions fetch failed");
    return res.json();
  }
}

export const api = new ApiService();
