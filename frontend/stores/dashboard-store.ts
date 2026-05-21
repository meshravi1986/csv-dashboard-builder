import { create } from "zustand";
import type { Dashboard, ChartSpec } from "@/types";

interface DashboardStore {
  dashboards: Dashboard[];
  currentDashboard: Dashboard | null;
  loading: boolean;
  setDashboards: (dashboards: Dashboard[]) => void;
  setCurrentDashboard: (dashboard: Dashboard | null) => void;
  setLoading: (loading: boolean) => void;
  updateChart: (chartId: string, updates: Partial<ChartSpec>) => void;
  reorderCharts: (charts: ChartSpec[]) => void;
  addDashboard: (dashboard: Dashboard) => void;
  removeDashboard: (id: string) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  dashboards: [],
  currentDashboard: null,
  loading: false,
  setDashboards: (dashboards) => set({ dashboards }),
  setCurrentDashboard: (dashboard) => set({ currentDashboard: dashboard }),
  setLoading: (loading) => set({ loading }),
  updateChart: (chartId, updates) =>
    set((state) => {
      if (!state.currentDashboard) return state;
      return {
        currentDashboard: {
          ...state.currentDashboard,
          charts: state.currentDashboard.charts.map((c) =>
            c.id === chartId ? { ...c, ...updates } : c
          ),
        },
      };
    }),
  reorderCharts: (charts) =>
    set((state) => {
      if (!state.currentDashboard) return state;
      return {
        currentDashboard: {
          ...state.currentDashboard,
          charts,
        },
      };
    }),
  addDashboard: (dashboard) =>
    set((state) => ({
      dashboards: [...state.dashboards, dashboard],
    })),
  removeDashboard: (id) =>
    set((state) => ({
      dashboards: state.dashboards.filter((d) => d.id !== id),
    })),
}));
