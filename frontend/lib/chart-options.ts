import type { ChartSpec } from "@/types";
import type { Palette } from "@/lib/palettes";
import { formatValue } from "@/lib/formatters";

function _fmt(fmt?: string) {
  return (v: any) => formatValue(v, fmt);
}

export function getChartOption(
  chart: ChartSpec,
  palette: Palette,
  fieldFormats?: Record<string, string>,
  size?: "normal" | "large",
): any {
  const labels = chart.data?.labels || [];
  const values = chart.data?.values || [];
  const xFormat = fieldFormats?.[chart.x_field];
  const yFormat = fieldFormats?.[chart.y_field];
  const fmtX = _fmt(xFormat);
  const fmtY = _fmt(yFormat);
  const isLarge = size === "large";

  const base = {
    backgroundColor: "transparent",
    animation: false,
    grid: {
      left: isLarge ? 60 : "3%",
      right: isLarge ? 40 : "4%",
      bottom: isLarge ? 50 : "3%",
      top: isLarge ? 40 : "12%",
      containLabel: true,
    },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "rgba(255,255,255,0.95)",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      textStyle: { color: "#1e293b", fontSize: isLarge ? 14 : 12 },
    },
  };

  switch (chart.chart_type) {
    case "kpi": {
      const val = typeof values[0] === "number" ? values[0] : null;
      return {
        backgroundColor: "transparent",
        animation: false,
        grid: { show: false, left: 0, top: 0, right: 0, bottom: 0 },
        xAxis: { show: false },
        yAxis: { show: false },
        graphic: {
          type: "text",
          left: "center",
          top: "center",
          style: {
            text: val !== null ? formatValue(val, yFormat) : "\u2014",
            fontSize: isLarge ? 48 : 36,
            fontWeight: 600,
            fill: val !== null ? palette.colors[0] : "#94a3b8",
          },
        },
      };
    }

    case "line":
      return {
        ...base,
        xAxis: {
          type: "category" as const,
          data: labels,
          axisLine: { lineStyle: { color: "#e2e8f0" } },
          axisLabel: { color: "#64748b", fontSize: isLarge ? 13 : 11, formatter: fmtX },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value" as const,
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLabel: { color: "#64748b", fontSize: isLarge ? 13 : 11, formatter: fmtY },
        },
        series: [
          {
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: isLarge ? 8 : 6,
            lineStyle: { width: isLarge ? 3 : 2, color: palette.colors[0] },
            itemStyle: { color: palette.colors[0] },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: palette.fill(0.1) },
                  { offset: 1, color: palette.fill(0.01) },
                ],
              },
            },
            data: values,
          },
        ],
      };

    case "bar":
      return {
        ...base,
        xAxis: {
          type: "category" as const,
          data: labels,
          axisLine: { lineStyle: { color: "#e2e8f0" } },
          axisLabel: { color: "#64748b", fontSize: isLarge ? 13 : 11, rotate: 45, formatter: fmtX },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value" as const,
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLabel: { color: "#64748b", fontSize: isLarge ? 13 : 11, formatter: fmtY },
        },
        series: [
          {
            type: "bar",
            barWidth: "60%",
            itemStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: palette.colors[0] },
                  { offset: 1, color: palette.colors[1] || palette.colors[0] },
                ],
              },
              borderRadius: [2, 2, 0, 0],
            },
            data: values,
          },
        ],
      };

    case "pie":
      return {
        backgroundColor: "transparent",
        animation: false,
        tooltip: {
          trigger: "item" as const,
          backgroundColor: "rgba(255,255,255,0.95)",
          borderColor: "#e2e8f0",
          borderWidth: 1,
          textStyle: { color: "#1e293b", fontSize: isLarge ? 14 : 12 },
          formatter: "{b}: {c} ({d}%)",
        },
        series: [
          {
            type: "pie",
            radius: ["35%", "65%"],
            center: ["50%", "50%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 4,
              borderColor: "#fff",
              borderWidth: 2,
            },
            color: palette.colors,
            label: {
              show: true,
              formatter: "{b}\n{d}%",
              fontSize: isLarge ? 14 : 11,
              color: "#475569",
            },
            emphasis: {
              label: { show: true, fontSize: isLarge ? 16 : 14, fontWeight: 700 },
              itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.2)" },
            },
            data: labels.map((label, i) => ({
              name: label,
              value: typeof values[i] === "number" ? values[i] : 0,
            })),
          },
        ],
      };

    case "scatter":
      return {
        ...base,
        tooltip: {
          trigger: "item" as const,
          backgroundColor: "rgba(255,255,255,0.95)",
          borderColor: "#e2e8f0",
          borderWidth: 1,
          textStyle: { color: "#1e293b", fontSize: isLarge ? 14 : 12 },
          formatter: (p: any) =>
            `${chart.x_field}: ${formatValue(p.value?.x ?? p.value?.[0], xFormat)}, ${chart.y_field}: ${formatValue(p.value?.y ?? p.value?.[1], yFormat)}`,
        },
        xAxis: {
          type: "value" as const,
          name: chart.x_field,
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLabel: { color: "#64748b", fontSize: isLarge ? 13 : 11, formatter: fmtX },
        },
        yAxis: {
          type: "value" as const,
          name: chart.y_field,
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLabel: { color: "#64748b", fontSize: isLarge ? 13 : 11, formatter: fmtY },
        },
        series: [
          {
            type: "scatter",
            symbolSize: isLarge ? 12 : 10,
            itemStyle: {
              color: {
                type: "radial",
                x: 0.5,
                y: 0.5,
                r: 0.5,
                colorStops: [
                  { offset: 0, color: palette.fill(0.6) },
                  { offset: 1, color: palette.fill(0.1) },
                ],
              },
            },
            data: values,
          },
        ],
      };

    default:
      return base;
  }
}
