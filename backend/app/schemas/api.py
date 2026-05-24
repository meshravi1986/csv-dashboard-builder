from pydantic import BaseModel, Field
from typing import List, Optional, Any, Literal, Dict
from datetime import datetime


AGGREGATION_TYPES = Literal["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"]


class UploadResponse(BaseModel):
    dataset_id: str
    filename: str
    row_count: int
    column_count: int
    column_match: Optional[dict] = None


class FieldProfile(BaseModel):
    field_name: str
    detected_type: str
    null_count: int
    null_percent: float
    cardinality: int
    sample_values: List[str]
    is_date: bool
    min: Optional[Any] = None
    max: Optional[Any] = None
    mean: Optional[float] = None
    std: Optional[float] = None


class DatasetProfileResponse(BaseModel):
    dataset_id: str
    field_count: int
    row_count: int
    total_null_cells: int
    fields: List[FieldProfile]


class SemanticField(BaseModel):
    field_name: str
    role: Literal["dimension", "measure", "date"]
    aggregation: Optional[AGGREGATION_TYPES] = None
    formatting: Optional[str] = None
    description: Optional[str] = None
    suggested_role: Optional[Literal["dimension", "measure", "date"]] = None
    suggested_aggregation: Optional[AGGREGATION_TYPES] = None
    semantic_tags: List[str] = []


class SemanticUpdateRequest(BaseModel):
    fields: List[SemanticField]


class SemanticSuggestResponse(BaseModel):
    fields: List[SemanticField]


class MetricCreate(BaseModel):
    name: str = Field(..., min_length=1)
    field_name: str = ""
    aggregation: AGGREGATION_TYPES = "SUM"
    formula: Optional[str] = None


class MetricResponse(BaseModel):
    id: str
    dataset_id: str
    user_id: str
    name: str
    expression: str
    aggregation: str
    field_name: str
    formula: Optional[str] = None
    created_at: str
    updated_at: str


class TabResponse(BaseModel):
    id: str
    dashboard_id: str
    title: str
    order: int
    created_at: str


class TabCreate(BaseModel):
    title: str = "New Tab"


class TabUpdate(BaseModel):
    title: str


class ChartCreateRequest(BaseModel):
    chart_type: Literal["line", "bar", "kpi", "scatter", "pie"]
    x_field: str = ""
    y_field: str = ""
    aggregation: AGGREGATION_TYPES = "SUM"
    title: Optional[str] = None
    formula: Optional[str] = None
    tab_id: Optional[str] = None


class ChartData(BaseModel):
    labels: List[str] = []
    values: List[Any] = []


class ChartSpec(BaseModel):
    id: str
    dashboard_id: str
    chart_type: Literal["line", "bar", "kpi", "scatter", "pie"]
    title: str
    x_field: str
    y_field: str
    aggregation: AGGREGATION_TYPES
    x_role: Literal["dimension", "date", "measure"]
    y_role: Literal["measure"]
    semantic_reasoning: str
    chart_reasoning: str
    aggregation_reasoning: str
    order: int
    width: Literal["full", "half"]
    chart_score: Optional[int] = None
    score_reasons: Optional[List[str]] = None
    suppression_reason: Optional[str] = None
    duplicate_of_chart_id: Optional[str] = None
    data: Optional[ChartData] = None
    tab_id: Optional[str] = None
    created_at: str
    updated_at: str


class DashboardResponse(BaseModel):
    id: str
    dataset_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    charts: List[ChartSpec]
    tabs: List[TabResponse] = []
    field_formats: Dict[str, str] = {}
    created_at: str
    updated_at: str


class DashboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    color_scheme: Optional[str] = None
    charts: Optional[List[ChartSpec]] = None


class VersionCreateRequest(BaseModel):
    new_dataset_id: str
    refresh_frequency: str = "Adhoc"
    tag: str = ""

class SuggestSQLRequest(BaseModel):
    description: str


class SuggestSQLResponse(BaseModel):
    sql: str


class PreviewSQLRequest(BaseModel):
    sql: str


class PreviewSQLResponse(BaseModel):
    value: Optional[Any] = None
    error: Optional[str] = None


class DatePreset(BaseModel):
    label: str
    start: str
    end: str


class DimensionFilterConfig(BaseModel):
    field_name: str
    label: str
    type: Literal["dimension"] = "dimension"
    values: List[dict]
    cardinality: int


class DateFilterConfig(BaseModel):
    field_name: str
    label: str
    type: Literal["date"] = "date"
    min_date: str
    max_date: str
    presets: List[DatePreset]


class FilterSuggestResponse(BaseModel):
    filters: List[DimensionFilterConfig | DateFilterConfig]


class ActiveFilter(BaseModel):
    field_name: str
    type: Literal["dimension", "date"]
    values: Optional[List[str]] = None
    start: Optional[str] = None
    end: Optional[str] = None


class ChartDataRequest(BaseModel):
    filters: List[ActiveFilter] = []
