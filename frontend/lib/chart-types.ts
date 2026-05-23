export const CHART_TYPES = ["line", "bar", "kpi", "scatter", "pie"] as const;
export type ChartType = typeof CHART_TYPES[number];

export const AGG_TYPES = ["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"] as const;
export type AggType = typeof AGG_TYPES[number];
