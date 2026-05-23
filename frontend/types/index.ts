export interface Dataset {
  id: string;
  user_id: string;
  name: string;
  original_filename: string;
  parquet_path: string;
  row_count: number;
  column_count: number;
  file_size: number;
  status: "uploaded" | "profiled" | "semantic" | "ready";
  created_at: string;
  updated_at: string;
}

export interface FieldProfile {
  field_name: string;
  detected_type: "numeric" | "string" | "date" | "boolean" | "unknown";
  null_count: number;
  null_percent: number;
  cardinality: number;
  sample_values: string[];
  is_date: boolean;
  min?: number | string;
  max?: number | string;
  mean?: number;
}

export interface DatasetProfile {
  dataset_id: string;
  field_count: number;
  row_count: number;
  total_null_cells: number;
  fields: FieldProfile[];
}

export interface SemanticField {
  field_name: string;
  role: "dimension" | "measure" | "date";
  aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "COUNT_DISTINCT" | null;
  formatting?: string;
  description?: string;
  suggested_role?: "dimension" | "measure" | "date" | null;
  suggested_aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "COUNT_DISTINCT" | null;
}

export interface Metric {
  id: string;
  dataset_id: string;
  user_id: string;
  name: string;
  expression: string;
  aggregation: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "COUNT_DISTINCT";
  field_name: string;
  formula?: string;
  created_at: string;
  updated_at: string;
}

export interface ChartSpec {
  id: string;
  dashboard_id: string;
  chart_type: "line" | "bar" | "kpi" | "scatter" | "pie";
  title: string;
  x_field: string;
  y_field: string;
  aggregation: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "COUNT_DISTINCT";
  x_role: "dimension" | "date" | "measure";
  y_role: "measure";
  semantic_reasoning: string;
  chart_reasoning: string;
  aggregation_reasoning: string;
  order: number;
  width: "full" | "half" | "quarter";
  formula?: string;
  chart_score?: number;
  score_reasons?: string[];
  suppression_reason?: string;
  duplicate_of_chart_id?: string;
  data?: {
    labels: string[];
    values: (number | { x: number; y: number })[];
  };
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  id: string;
  user_id: string;
  dataset_id: string;
  title: string;
  description?: string;
  charts: ChartSpec[];
  tabs?: { id: string; title: string; order: number }[];
  field_formats?: Record<string, string>;
  color_scheme?: string;
  created_at: string;
  updated_at: string;
}

export interface UploadState {
  file: File | null;
  progress: number;
  status: "idle" | "uploading" | "processing" | "profiling" | "complete" | "error";
  error?: string;
  dataset_id?: string;
}

export interface ProfilingState {
  loading: boolean;
  profile: DatasetProfile | null;
  error?: string;
}

export interface SemanticState {
  fields: SemanticField[];
  confirmed: boolean;
  loading: boolean;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: "success" | "error";
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}
