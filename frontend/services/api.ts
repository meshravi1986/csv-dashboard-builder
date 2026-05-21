const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_URL}/api/v1`;
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

  async uploadCSV(file: File, onProgress?: (progress: number) => void) {
    const { supabase } = await import("@/lib/supabase");
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const formData = new FormData();
    formData.append("file", file);

    return new Promise<{ dataset_id: string }>((resolve, reject) => {
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
      xhr.open("POST", `${this.baseUrl}/upload`);
      if (session?.access_token) {
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      }
      xhr.send(formData);
    });
  }

  async getProfile(datasetId: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/datasets/${datasetId}/profile`, {
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Profile fetch failed" }));
      throw new Error(err.detail || "Profile fetch failed");
    }
    return res.json();
  }

  async updateSemantics(datasetId: string, fields: any[]) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/datasets/${datasetId}/semantics`, {
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
    const res = await fetch(
      `${this.baseUrl}/datasets/${datasetId}/semantics/suggest`,
      { headers }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Suggestions failed" }));
      throw new Error(err.detail || "Suggestions failed");
    }
    return res.json();
  }

  async getMetrics(datasetId: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/datasets/${datasetId}/metrics`, {
      headers,
    });
    if (!res.ok) throw new Error("Metrics fetch failed");
    return res.json();
  }

  async createMetric(datasetId: string, metric: any) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/datasets/${datasetId}/metrics`, {
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
    const res = await fetch(`${this.baseUrl}/datasets/${datasetId}/metrics/${metricId}`, {
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
    const res = await fetch(`${this.baseUrl}/datasets/${datasetId}/metrics/suggest-sql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ description }),
    });
    if (!res.ok) throw new Error("SQL suggestion failed");
    return res.json();
  }

  async previewSQL(datasetId: string, sql: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/datasets/${datasetId}/metrics/preview-sql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sql }),
    });
    if (!res.ok) throw new Error("SQL preview failed");
    return res.json();
  }

  async deleteMetric(datasetId: string, metricId: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/datasets/${datasetId}/metrics/${metricId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error("Metric delete failed");
    return res.json();
  }

  async generateDashboard(datasetId: string) {
    const headers = await this.getAuthHeaders();
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const res = await fetch(
          `${this.baseUrl}/datasets/${datasetId}/dashboard/generate`,
          {
            method: "POST",
            headers,
            signal: controller.signal,
          }
        );
        if (res.ok) return res.json();
        const err = await res.json().catch(() => ({ detail: "Dashboard generation failed" }));
        if (attempt < 2 && res.status >= 500) continue;
        throw new Error(err.detail || "Dashboard generation failed");
      } catch (e: any) {
        if (attempt < 2 && (e.name === "AbortError" || e.message?.includes("fetch failed"))) continue;
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  async getDashboards() {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/dashboards`, { headers });
    if (!res.ok) throw new Error("Dashboards fetch failed");
    return res.json();
  }

  async getDashboard(id: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/dashboards/${id}`, { headers });
    if (!res.ok) throw new Error("Dashboard fetch failed");
    return res.json();
  }

  async updateDashboard(id: string, data: any) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/dashboards/${id}`, {
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
    const res = await fetch(`${this.baseUrl}/dashboards/${dashboardId}/available-fields`, { headers });
    if (!res.ok) throw new Error("Fields fetch failed");
    return res.json();
  }

  async addChart(dashboardId: string, chart: any) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/dashboards/${dashboardId}/charts`, {
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
    const res = await fetch(`${this.baseUrl}/dashboards/${dashboardId}/charts/${chartId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error("Chart delete failed");
    return res.json();
  }

  async deleteDashboard(id: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/dashboards/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error("Dashboard delete failed");
    return res.json();
  }

  async queryParquet(datasetId: string, query: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ dataset_id: datasetId, query }),
    });
    if (!res.ok) throw new Error("Query failed");
    return res.json();
  }
}

export const api = new ApiService();
