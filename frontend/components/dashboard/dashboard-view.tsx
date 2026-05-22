"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ChartCard } from "./chart-card";
import type { ChartSpec } from "@/types";
import { api } from "@/services/api";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DashboardViewProps {
  dashboard: {
    id?: string;
    title: string;
    description?: string;
    color_scheme?: string;
    charts: ChartSpec[];
  };
  onRefresh?: () => void;
}

function SortableChartCard({ chart, onDelete, colorScheme }: { chart: ChartSpec; onDelete: (id: string) => void; colorScheme?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chart.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="relative group">
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-1.5 top-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1 rounded hover:bg-slate-100"
        >
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        <ChartCard chart={chart} onDelete={onDelete} colorScheme={colorScheme} />
      </div>
    </div>
  );
}

export function DashboardView({ dashboard, onRefresh }: DashboardViewProps) {
  const [charts, setCharts] = useState<ChartSpec[]>(dashboard.charts);
  const initializedRef = useRef(false);
  const dashboardIdRef = useRef(dashboard.id);

  useEffect(() => {
    if (dashboard.id !== dashboardIdRef.current) {
      dashboardIdRef.current = dashboard.id;
      initializedRef.current = false;
    }
    if (!initializedRef.current) {
      setCharts(dashboard.charts);
      initializedRef.current = true;
    }
  }, [dashboard.charts, dashboard.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const otherCharts = charts.filter((c) => c.chart_type !== "kpi").sort((a, b) => a.order - b.order);
  const kpiCards = charts.filter((c) => c.chart_type === "kpi").sort((a, b) => a.order - b.order);
  const fullWidthCharts = otherCharts.filter((c) => c.width === "full");
  const halfWidthCharts = otherCharts.filter((c) => c.width === "half");

  const handleDeleteChart = useCallback(async (chartId: string) => {
    if (!dashboard.id) return;
    if (!confirm("Remove this chart from the dashboard?")) return;
    try {
      await api.deleteChart(dashboard.id, chartId);
      setCharts((prev) => prev.filter((c) => c.id !== chartId));
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  }, [dashboard.id, onRefresh]);

  const persistOrder = useCallback(async (reorderedCharts: ChartSpec[]) => {
    if (!dashboard.id) return;
    try {
      await api.reorderCharts(dashboard.id, reorderedCharts.map((c) => c.id));
    } catch (err) {
      console.error(err);
    }
  }, [dashboard.id]);

  const handleGroupDragEnd = (groupCharts: ChartSpec[]) => async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groupCharts.findIndex((c) => c.id === active.id);
    const newIndex = groupCharts.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const moved = arrayMove(groupCharts, oldIndex, newIndex);
    const updated = moved.map((c, i) => ({ ...c, order: i }));

    setCharts((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      for (const c of updated) map.set(c.id, c);
      return Array.from(map.values());
    });

    await persistOrder(updated);
  };

  const renderSortableGroup = (title: string | null, groupCharts: ChartSpec[], className: string) => {
    if (groupCharts.length === 0) return null;
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleGroupDragEnd(groupCharts)}
      >
        <SortableContext items={groupCharts.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {title && <h3 className="text-sm font-medium text-slate-700 mb-3">{title}</h3>}
          <div className={className}>
            {groupCharts.map((chart) => (
              <SortableChartCard key={chart.id} chart={chart} onDelete={handleDeleteChart} colorScheme={dashboard.color_scheme} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  };

  if (charts.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
        <p className="text-sm text-slate-400">No charts generated</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderSortableGroup(null, kpiCards, "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4")}
      {renderSortableGroup("Full Width", fullWidthCharts, "space-y-4")}
      {renderSortableGroup("Half Width", halfWidthCharts, "grid grid-cols-1 lg:grid-cols-2 gap-4")}
    </div>
  );
}
