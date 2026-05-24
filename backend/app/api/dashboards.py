import uuid
import json
import re
from datetime import datetime, timedelta
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.schemas.api import (
    DashboardResponse, DashboardUpdate, ChartCreateRequest,
    FilterSuggestResponse, DimensionFilterConfig, DateFilterConfig, DatePreset,
    ChartDataRequest, ActiveFilter, VersionCreateRequest,
    TabCreate, TabUpdate, TabResponse,
)
from app.utils.auth import get_current_user
from app.utils.supabase import get_supabase
from app.utils.duckdb import get_duckdb
from app.services.dashboard import build_dashboard
from app.services.upload import get_parquet_path, get_dataset_columns, get_dataset, find_matching_dashboards
from app.engine.visualization import query_chart_data, query_chart_data_batch
from app.config import settings

from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/dashboards", tags=["dashboards"])
datasets_router = APIRouter(prefix="/api/v1/datasets", tags=["dashboards"])

SUPABASE_REST_URL = settings.supabase_url.rstrip("/") + "/rest/v1"

_MAX_FILTER_CARDINALITY = 500
_MAX_FILTER_SUGGESTIONS = 15

class ReorderRequest(BaseModel):
    chart_ids: list[str]


def _rest_headers():
    return {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _supabase_post(url: str, payload: dict, label: str, headers: dict):
    with httpx.Client(timeout=15.0) as client:
        for attempt in range(2):
            try:
                resp = client.post(url, headers=headers, json=payload)
                if resp.status_code < 400:
                    return resp
                print(f"[{label}] Supabase API error (status {resp.status_code})", flush=True)
                raise HTTPException(status_code=500, detail=f"{label} failed")
            except httpx.TimeoutException:
                if attempt < 1:
                    continue
                raise HTTPException(status_code=500, detail=f"{label} timed out")


_HAS_VERSIONING: bool | None = None


def _has_versioning_columns(supabase) -> bool:
    global _HAS_VERSIONING
    if _HAS_VERSIONING is not None:
        return _HAS_VERSIONING
    try:
        supabase.table("dashboards").select("version_group_id").limit(1).execute()
        _HAS_VERSIONING = True
    except Exception:
        _HAS_VERSIONING = False
    return _HAS_VERSIONING


def _build_filters_dict(filters: list[ActiveFilter]) -> dict:
    fd = {}
    for f in filters:
        entry = {"type": f.type}
        if f.type == "dimension":
            entry["values"] = f.values or []
        elif f.type == "date":
            entry["start"] = f.start or ""
            entry["end"] = f.end or ""
        fd[f.field_name] = entry
    return fd or None


@datasets_router.post("/{dataset_id}/dashboard/generate")
def generate_dashboard(
    dataset_id: str,
    dashboard_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    import time as time_mod
    t0 = time_mod.time()
    print(f"[generate_dashboard] Starting for dataset {dataset_id}", flush=True)

    dataset = get_dataset(dataset_id, user["id"])
    supabase = get_supabase()

    semantic_result = supabase.table("semantic_fields").select("*").eq("dataset_id", dataset_id).execute()
    if not semantic_result.data:
        raise HTTPException(status_code=400, detail="Semantic fields not defined. Please confirm semantics first.")

    semantic_fields = [
        {
            "field_name": f["field_name"],
            "role": f["role"],
            "aggregation": f.get("aggregation"),
        }
        for f in semantic_result.data
    ]

    metrics_result = supabase.table("metrics").select("*").eq("dataset_id", dataset_id).execute()
    user_metrics = metrics_result.data or []

    parquet_path = get_parquet_path(dataset["parquet_path"])
    print(f"[generate_dashboard] Parquet ready at {time_mod.time() - t0:.1f}s", flush=True)

    dashboard = build_dashboard(dataset_id, user["id"], semantic_fields, parquet_path, metrics=user_metrics)
    print(f"[generate_dashboard] Dashboard built ({len(dashboard['charts'])} charts) at {time_mod.time() - t0:.1f}s", flush=True)

    has_versioning = _has_versioning_columns(supabase)
    now = datetime.utcnow().isoformat()
    headers = _rest_headers()

    if dashboard_id:
        # Regenerate in-place: verify dashboard exists, delete old charts, reuse dashboard_id
        dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
        if not dash_result.data:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        supabase.table("chart_specs").delete().eq("dashboard_id", dashboard_id).execute()
        supabase.table("dashboard_tabs").delete().eq("dashboard_id", dashboard_id).execute()
        db_dashboard_id = dashboard_id
        supabase.table("dashboards").update({"title": dashboard["title"], "description": dashboard.get("description"), "updated_at": now}).eq("id", dashboard_id).execute()
    else:
        # Delete existing dashboard for this dataset (non-versioned only)
        existing = supabase.table("dashboards").select("*").eq("dataset_id", dataset_id).execute()
        existing_data = existing.data or []
        if existing_data:
            if has_versioning:
                existing_data = [d for d in existing_data if d.get("version_group_id") is None]
            if existing_data:
                for d in existing_data:
                    supabase.table("chart_specs").delete().eq("dashboard_id", d["id"]).execute()
                supabase.table("dashboards").delete().eq("id", existing_data[0]["id"]).execute()

        db_dashboard_id = str(uuid.uuid4())
        dash_payload = {
            "id": db_dashboard_id,
            "user_id": user["id"],
            "dataset_id": dataset_id,
            "title": dashboard["title"],
            "description": dashboard.get("description"),
            "refresh_frequency": "Adhoc",
            "created_at": now,
            "updated_at": now,
        }
        if has_versioning:
            dash_payload["version_group_id"] = db_dashboard_id
            dash_payload["version_number"] = 1
        _supabase_post(f"{SUPABASE_REST_URL}/dashboards", dash_payload, "Dashboard insert", headers)

    # Insert default tab
    tab_payloads = []
    for tab in dashboard.get("tabs", []):
        tab_payload = {
            "id": tab["id"],
            "dashboard_id": db_dashboard_id,
            "title": tab["title"],
            "order": tab["order"],
            "created_at": now,
        }
        tab_payloads.append(tab_payload)
    if tab_payloads:
        _supabase_post(f"{SUPABASE_REST_URL}/dashboard_tabs", tab_payloads, "Tab batch insert", headers)

    # Batch insert all charts in a single POST
    chart_payloads = []
    for chart in dashboard["charts"]:
        chart_id = str(uuid.uuid4())
        chart["id"] = chart_id
        chart["dashboard_id"] = db_dashboard_id
        chart_payloads.append({
            "id": chart_id,
            "dashboard_id": db_dashboard_id,
            "chart_type": chart["chart_type"],
            "title": chart["title"],
            "x_field": chart["x_field"],
            "y_field": chart["y_field"],
            "aggregation": chart["aggregation"],
            "x_role": chart["x_role"],
            "y_role": chart["y_role"],
            "semantic_reasoning": chart["semantic_reasoning"],
            "chart_reasoning": chart["chart_reasoning"],
            "aggregation_reasoning": chart["aggregation_reasoning"],
            "order": chart["order"],
            "width": chart["width"],
            "formula": chart.get("formula"),
            "tab_id": chart.get("tab_id"),
            "created_at": now,
            "updated_at": now,
        })
    if chart_payloads:
        _supabase_post(f"{SUPABASE_REST_URL}/chart_specs", chart_payloads, "Chart batch insert", headers)

    dashboard["id"] = db_dashboard_id
    if has_versioning:
        dashboard["version_group_id"] = db_dashboard_id
        dashboard["version_number"] = 1

    supabase.table("datasets").update({"status": "ready", "updated_at": now}).eq("id", dataset_id).execute()

    print(f"[generate_dashboard] Done at {time_mod.time() - t0:.1f}s", flush=True)
    return dashboard


@router.get("")
def list_dashboards(
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    result = supabase.table("dashboards").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()

    # Group by version_group_id, keep only latest version per group
    groups: dict[str, dict] = {}
    version_counts: dict[str, int] = {}
    version_tags: dict[str, str] = {}

    for d in result.data:
        vgid = d.get("version_group_id") or d["id"]
        if vgid not in groups or (d.get("version_number") or 1) > (groups[vgid].get("version_number") or 0):
            groups[vgid] = d
        version_counts[vgid] = version_counts.get(vgid, 0) + 1
        # Track the latest tag
        if d.get("tag"):
            if vgid not in version_tags or (d.get("version_number") or 1) >= version_tags.get(vgid + "_vn", 0):
                version_tags[vgid] = d["tag"]
                version_tags[vgid + "_vn"] = d.get("version_number") or 1

    # Batch-fetch all chart_specs for all dashboards
    all_ids = list({d["id"] for d in groups.values()})
    all_charts = {}
    if all_ids:
        from postgrest import AioHttpClient as _  # ensure sync
        for chunk in [all_ids[i:i+20] for i in range(0, len(all_ids), 20)]:
            chunk_result = supabase.table("chart_specs").select("*").in_("dashboard_id", chunk).order("order").execute()
            for c in (chunk_result.data or []):
                all_charts.setdefault(c["dashboard_id"], []).append(c)

    dashboards = []
    for vgid, d in groups.items():
        dashboards.append({
            **d,
            "charts": all_charts.get(d["id"], []),
            "version_count": version_counts.get(vgid, 1),
            "version_group_id": vgid,
            "latest_tag": version_tags.get(vgid),
        })

    return {"dashboards": dashboards}


@router.get("/by-group/{version_group_id}/versions")
def list_dashboard_versions(
    version_group_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    if not _has_versioning_columns(supabase):
        raise HTTPException(status_code=400, detail="Versioning not enabled. Run the database migration first (see docs/schema.sql).")
    result = supabase.table("dashboards").select("*").eq("version_group_id", version_group_id).eq("user_id", user["id"]).order("version_number", desc=True).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No versions found")

    all_ids = [d["id"] for d in result.data]
    all_charts = {}
    if all_ids:
        for chunk in [all_ids[i:i+20] for i in range(0, len(all_ids), 20)]:
            chunk_result = supabase.table("chart_specs").select("*").in_("dashboard_id", chunk).order("order").execute()
            for c in (chunk_result.data or []):
                all_charts.setdefault(c["dashboard_id"], []).append(c)

    versions = []
    for d in result.data:
        versions.append({
            **d,
            "charts": all_charts.get(d["id"], []),
            "charts_count": len(all_charts.get(d["id"], [])),
        })

    return {"versions": versions}


@router.post("/{dashboard_id}/create-version")
def create_dashboard_version(
    dashboard_id: str,
    req: VersionCreateRequest,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    if not _has_versioning_columns(supabase):
        raise HTTPException(status_code=400, detail="Versioning not enabled. Run the database migration first (see docs/schema.sql).")
    now = datetime.utcnow().isoformat()
    headers = _rest_headers()

    # Get source dashboard
    source = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not source.data:
        raise HTTPException(status_code=404, detail="Source dashboard not found")
    source = source.data[0]

    source_dataset_id = source["dataset_id"]
    new_dataset_id = req.new_dataset_id
    version_group_id = source.get("version_group_id") or source["id"]

    # Verify new dataset exists
    get_dataset(new_dataset_id, user["id"])

    # Get max version number in group
    max_vn = supabase.table("dashboards").select("version_number").eq("version_group_id", version_group_id).eq("user_id", user["id"]).order("version_number", desc=True).limit(1).execute()
    next_vn = (max_vn.data[0]["version_number"] + 1) if max_vn.data else 2

    # Copy semantics from source dataset to new dataset (batch insert)
    semantic_result = supabase.table("semantic_fields").select("*").eq("dataset_id", source_dataset_id).execute()
    if semantic_result.data:
        sem_rows = [
            {
                "id": str(uuid.uuid4()),
                "dataset_id": new_dataset_id,
                "field_name": sf["field_name"],
                "role": sf["role"],
                "aggregation": sf.get("aggregation"),
                "formatting": sf.get("formatting"),
                "description": sf.get("description"),
            }
            for sf in semantic_result.data
        ]
        supabase.table("semantic_fields").insert(sem_rows).execute()

    # Copy metrics from source dataset to new dataset (batch insert)
    metrics_result = supabase.table("metrics").select("*").eq("dataset_id", source_dataset_id).execute()
    if metrics_result.data:
        met_rows = [
            {
                "id": str(uuid.uuid4()),
                "dataset_id": new_dataset_id,
                "user_id": user["id"],
                "name": m["name"],
                "expression": m["expression"],
                "aggregation": m["aggregation"],
                "field_name": m["field_name"],
                "formula": m.get("formula"),
            }
            for m in metrics_result.data
        ]
        supabase.table("metrics").insert(met_rows).execute()

    # Create new dashboard
    new_dash_id = str(uuid.uuid4())
    dash_payload = {
        "id": new_dash_id,
        "user_id": user["id"],
        "dataset_id": new_dataset_id,
        "title": source["title"],
        "description": source.get("description"),
        "version_group_id": version_group_id,
        "version_number": next_vn,
        "tag": req.tag,
        "refresh_frequency": req.refresh_frequency,
        "created_at": now,
        "updated_at": now,
    }
    _supabase_post(f"{SUPABASE_REST_URL}/dashboards", dash_payload, "Dashboard insert", headers)

    # Copy chart_specs from source dashboard
    chart_specs = supabase.table("chart_specs").select("*").eq("dashboard_id", dashboard_id).order("order").execute()
    chart_payloads = []
    for cs in chart_specs.data:
        chart_payloads.append({
            "id": str(uuid.uuid4()),
            "dashboard_id": new_dash_id,
            "chart_type": cs["chart_type"],
            "title": cs["title"],
            "x_field": cs["x_field"],
            "y_field": cs["y_field"],
            "aggregation": cs["aggregation"],
            "formula": cs.get("formula"),
            "x_role": cs["x_role"],
            "y_role": cs["y_role"],
            "semantic_reasoning": cs["semantic_reasoning"],
            "chart_reasoning": cs["chart_reasoning"],
            "aggregation_reasoning": cs["aggregation_reasoning"],
            "order": cs["order"],
            "width": cs["width"],
            "created_at": now,
            "updated_at": now,
        })
    if chart_payloads:
        _supabase_post(f"{SUPABASE_REST_URL}/chart_specs", chart_payloads, "Chart batch insert", headers)

    supabase.table("datasets").update({"status": "ready", "updated_at": now}).eq("id", new_dataset_id).execute()

    return {
        "id": new_dash_id,
        "version_group_id": version_group_id,
        "version_number": next_vn,
        "tag": req.tag,
        "refresh_frequency": req.refresh_frequency,
    }


@datasets_router.get("/{dataset_id}/column-match")
def check_column_match(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    current_cols = get_dataset_columns(dataset_id, supabase)
    if current_cols is None:
        return {"matches": []}
    matches = find_matching_dashboards(current_cols, user["id"], supabase, exclude_dataset_id=dataset_id)
    return {"matches": matches}


@router.get("/{dashboard_id}")
def get_dashboard(
    dashboard_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    dashboard = result.data[0]
    charts_result = supabase.table("chart_specs").select("*").eq("dashboard_id", dashboard_id).order("order").execute()

    tabs_result = supabase.table("dashboard_tabs").select("*").eq("dashboard_id", dashboard_id).order("order").execute()

    dataset = supabase.table("datasets").select("parquet_path").eq("id", dashboard["dataset_id"]).execute()
    parquet_path = get_parquet_path(dataset.data[0]["parquet_path"]) if dataset.data else ""

    if parquet_path and charts_result.data:
        chart_data_list = query_chart_data_batch(charts_result.data, parquet_path)
    else:
        chart_data_list = [{"labels": [], "values": []} for _ in charts_result.data]
    charts = []
    for chart, chart_data in zip(charts_result.data, chart_data_list):
        chart["data"] = chart_data
        charts.append(chart)

    semantic_result = supabase.table("semantic_fields").select("field_name,formatting").eq("dataset_id", dashboard["dataset_id"]).execute()
    field_formats = {}
    for sf in (semantic_result.data or []):
        if sf.get("formatting"):
            field_formats[sf["field_name"]] = sf["formatting"]

    dashboard["charts"] = charts
    dashboard["tabs"] = tabs_result.data or []
    dashboard["field_formats"] = field_formats
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: str,
    update: DashboardUpdate,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    now = datetime.utcnow().isoformat()
    update_data = {"updated_at": now}
    if update.title is not None:
        update_data["title"] = update.title
    if update.description is not None:
        update_data["description"] = update.description
    if update.color_scheme is not None:
        update_data["color_scheme"] = update.color_scheme

    supabase.table("dashboards").update(update_data).eq("id", dashboard_id).execute()

    if update.charts is not None:
        supabase.table("chart_specs").delete().eq("dashboard_id", dashboard_id).execute()
        chart_payloads = [
            {
                "id": chart.id,
                "dashboard_id": dashboard_id,
                "chart_type": chart.chart_type,
                "title": chart.title,
                "x_field": chart.x_field,
                "y_field": chart.y_field,
                "aggregation": chart.aggregation,
                "formula": getattr(chart, "formula", None),
                "x_role": chart.x_role,
                "y_role": chart.y_role,
                "semantic_reasoning": chart.semantic_reasoning,
                "chart_reasoning": chart.chart_reasoning,
                "aggregation_reasoning": chart.aggregation_reasoning,
                "order": chart.order,
                "width": chart.width,
                "created_at": now,
                "updated_at": now,
            }
            for chart in update.charts
        ]
        if chart_payloads:
            supabase.table("chart_specs").insert(chart_payloads).execute()

    return get_dashboard(dashboard_id, user)


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    dash = result.data[0]

    # If part of a version group, delete ALL versions in the group
    vgid = dash.get("version_group_id")
    if vgid:
        all_versions = supabase.table("dashboards").select("id").eq("version_group_id", vgid).eq("user_id", user["id"]).execute()
        ids = [d["id"] for d in all_versions.data]
    else:
        ids = [dashboard_id]

    for did in ids:
        supabase.table("chart_specs").delete().eq("dashboard_id", did).execute()
        supabase.table("dashboards").delete().eq("id", did).execute()

    return {"status": "success", "deleted": len(ids)}


@router.get("/{dashboard_id}/available-fields")
def get_available_fields(
    dashboard_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    dataset_id = dash_result.data[0]["dataset_id"]

    semantic_result = supabase.table("semantic_fields").select("*").eq("dataset_id", dataset_id).execute()
    metrics_result = supabase.table("metrics").select("*").eq("dataset_id", dataset_id).execute()

    return {
        "fields": [
            {"field_name": f["field_name"], "role": f["role"], "aggregation": f.get("aggregation")}
            for f in semantic_result.data
        ],
        "metrics": [
            {"id": m["id"], "name": m["name"], "field_name": m["field_name"], "aggregation": m["aggregation"], "formula": m.get("formula")}
            for m in metrics_result.data
        ],
    }


_IDENTIFIER_PATTERN = re.compile(r'^.*_id$|^.*_code$|^.*_uuid$|^id$|^uuid$|^.*_number$|^.*_key$|^.*_sid$', re.IGNORECASE)
_TEXT_BLOB_PATTERN = re.compile(r'^.*comment.*$|^.*description.*$|^.*note.*$|^.*text.*$|^.*remark.*$', re.IGNORECASE)
_PRIORITY_FIELDS = {"region", "category", "status", "segment", "channel", "department", "country", "city", "state", "product", "type", "method", "payment", "shipping", "division", "class"}


def _generate_date_presets(min_date: str, max_date: str) -> list[DatePreset]:
    try:
        min_dt = datetime.strptime(min_date[:10], "%Y-%m-%d")
        max_dt = datetime.strptime(max_date[:10], "%Y-%m-%d")
    except ValueError:
        return [DatePreset(label="Full Range", start=min_date[:10], end=max_date[:10])]

    span_days = (max_dt - min_dt).days
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    presets = []
    full_end = max_dt.strftime("%Y-%m-%d")

    presets.append(DatePreset(label="Full Range", start=min_dt.strftime("%Y-%m-%d"), end=full_end))

    def add_preset(label: str, start: datetime):
        s = start.strftime("%Y-%m-%d")
        if s >= min_dt.strftime("%Y-%m-%d"):
            presets.append(DatePreset(label=label, start=s, end=today.strftime("%Y-%m-%d")))

    if span_days <= 30:
        for label, days in [("Last 7 Days", 7), ("Last 14 Days", 14)]:
            add_preset(label, today - timedelta(days=days))
    elif span_days <= 90:
        for label, days in [("Last 7 Days", 7), ("Last 30 Days", 30), ("Last 90 Days", 90)]:
            add_preset(label, today - timedelta(days=days))
    elif span_days <= 365:
        add_preset("Last 30 Days", today - timedelta(days=30))
        add_preset("Last 90 Days", today - timedelta(days=90))
        quarter_start = today.replace(day=1, month=((today.month - 1) // 3) * 3 + 1)
        add_preset("This Quarter", quarter_start)
        add_preset("Year To Date", today.replace(month=1, day=1))
    else:
        add_preset("Last 30 Days", today - timedelta(days=30))
        add_preset("Last 90 Days", today - timedelta(days=90))
        quarter_start = today.replace(day=1, month=((today.month - 1) // 3) * 3 + 1)
        add_preset("This Quarter", quarter_start)
        add_preset("Year To Date", today.replace(month=1, day=1))
        add_preset("This Year", today.replace(month=1, day=1))

    presets.append(DatePreset(label="Custom Range", start="", end=""))
    return presets


@router.get("/{dashboard_id}/filters/suggest", response_model=FilterSuggestResponse)
def suggest_filters(
    dashboard_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    dataset_id = dash_result.data[0]["dataset_id"]
    dataset = supabase.table("datasets").select("parquet_path").eq("id", dataset_id).execute()
    if not dataset.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    parquet_path = get_parquet_path(dataset.data[0]["parquet_path"])
    semantic_result = supabase.table("semantic_fields").select("*").eq("dataset_id", dataset_id).execute()

    with get_duckdb() as conn:
        suggestions = []

        for sf in semantic_result.data:
            field_name = sf["field_name"]
            role = sf["role"]

            if role == "measure":
                continue

            if role == "date":
                q_field = safe_quote_ident(field_name)
                row = conn.execute(f'SELECT MIN({q_field}), MAX({q_field}) FROM read_parquet(?)', [parquet_path]).fetchone()
                min_date, max_date = row
                if not min_date or not max_date:
                    continue
                min_str = str(min_date)[:10]
                max_str = str(max_date)[:10]
                suggestions.append(DateFilterConfig(
                    field_name=field_name,
                    label=field_name.replace("_", " ").title(),
                    min_date=min_str,
                    max_date=max_str,
                    presets=_generate_date_presets(min_str, max_str),
                ))
                continue

            # dimension
            if _IDENTIFIER_PATTERN.match(field_name):
                continue
            if _TEXT_BLOB_PATTERN.match(field_name):
                continue

            q_field = safe_quote_ident(field_name)
            cardinality = conn.execute(f'SELECT COUNT(DISTINCT {q_field}) FROM read_parquet(?)', [parquet_path]).fetchone()[0]
            if cardinality > _MAX_FILTER_CARDINALITY:
                continue

            limit = min(cardinality, 500)
            rows = conn.execute(f'SELECT DISTINCT {q_field} FROM read_parquet(?) WHERE {q_field} IS NOT NULL ORDER BY {q_field} LIMIT ?', [parquet_path, limit]).fetchall()
            values = [{"label": str(r[0]), "value": str(r[0])} for r in rows]

            suggestions.append(DimensionFilterConfig(
                field_name=field_name,
                label=field_name.replace("_", " ").title(),
                values=values,
                cardinality=cardinality,
            ))

        suggestions.sort(key=lambda f: (0 if f.field_name.lower() in _PRIORITY_FIELDS else 1, getattr(f, 'cardinality', 999)))
        suggestions = suggestions[:_MAX_FILTER_SUGGESTIONS]

    return {"filters": suggestions}


@router.post("/{dashboard_id}/charts")
def add_chart(
    dashboard_id: str,
    chart: ChartCreateRequest,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    dataset_id = dash_result.data[0]["dataset_id"]
    dataset = supabase.table("datasets").select("parquet_path").eq("id", dataset_id).execute()
    parquet_path = get_parquet_path(dataset.data[0]["parquet_path"]) if dataset.data else ""

    existing = supabase.table("chart_specs").select("order").eq("dashboard_id", dashboard_id).order("order", desc=True).limit(1).execute()
    next_order = (existing.data[0]["order"] + 1) if existing.data else 0

    x_role = "dimension"
    y_role = "measure"
    if chart.chart_type == "line":
        x_role = "date"
    elif chart.chart_type == "kpi":
        x_role = "dimension"
    elif chart.chart_type == "scatter":
        x_role = "measure"

    width = "half"
    default_title = f"{chart.aggregation}({chart.y_field}) by {chart.x_field}" if chart.x_field else f"{chart.aggregation}({chart.y_field})"
    title = chart.title or default_title

    now = datetime.utcnow().isoformat()
    chart_id = str(uuid.uuid4())

    spec = {
        "chart_type": chart.chart_type,
        "x_field": chart.x_field,
        "y_field": chart.y_field,
        "aggregation": chart.aggregation,
        "formula": chart.formula,
        "x_role": x_role,
        "y_role": y_role,
        "title": title,
        "order": next_order,
        "width": width,
        "semantic_reasoning": "User-added chart",
        "chart_reasoning": "Manually added by user",
        "aggregation_reasoning": f"{chart.aggregation} applied to {chart.formula or chart.y_field}",
    }
    chart_data = query_chart_data(spec, parquet_path) if parquet_path else {"labels": [], "values": []}

    chart_payload = {
        "id": chart_id,
        "dashboard_id": dashboard_id,
        "chart_type": chart.chart_type,
        "title": title,
        "x_field": chart.x_field,
        "y_field": chart.y_field,
        "aggregation": chart.aggregation,
        "formula": chart.formula,
        "x_role": x_role,
        "y_role": y_role,
        "semantic_reasoning": spec["semantic_reasoning"],
        "chart_reasoning": spec["chart_reasoning"],
        "aggregation_reasoning": spec["aggregation_reasoning"],
        "order": next_order,
        "width": width,
        "tab_id": chart.tab_id,
        "created_at": now,
        "updated_at": now,
    }

    headers = _rest_headers()
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(f"{SUPABASE_REST_URL}/chart_specs", headers=headers, json=chart_payload)
        if resp.status_code >= 400:
            raise HTTPException(status_code=500, detail="Chart insert failed")

    return {**chart_payload, "data": chart_data}


@router.delete("/{dashboard_id}/charts/{chart_id}")
def delete_chart(
    dashboard_id: str,
    chart_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    supabase.table("chart_specs").delete().eq("id", chart_id).eq("dashboard_id", dashboard_id).execute()
    return {"status": "success"}


@router.post("/{dashboard_id}/charts/{chart_id}/data")
def get_chart_data_filtered(
    dashboard_id: str,
    chart_id: str,
    request: ChartDataRequest,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    chart_result = supabase.table("chart_specs").select("*").eq("id", chart_id).eq("dashboard_id", dashboard_id).execute()
    if not chart_result.data:
        raise HTTPException(status_code=404, detail="Chart not found")

    dataset = supabase.table("datasets").select("parquet_path").eq("id", dash_result.data[0]["dataset_id"]).execute()
    parquet_path = get_parquet_path(dataset.data[0]["parquet_path"]) if dataset.data else ""

    chart_data = query_chart_data(chart_result.data[0], parquet_path, filters=_build_filters_dict(request.filters))
    return chart_data


@router.post("/{dashboard_id}/data")
def get_dashboard_data_filtered(
    dashboard_id: str,
    request: ChartDataRequest,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    charts_result = supabase.table("chart_specs").select("*").eq("dashboard_id", dashboard_id).order("order").execute()
    chart_specs = charts_result.data or []

    dataset = supabase.table("datasets").select("parquet_path").eq("id", dash_result.data[0]["dataset_id"]).execute()
    parquet_path = get_parquet_path(dataset.data[0]["parquet_path"]) if dataset.data else ""

    all_data = query_chart_data_batch(chart_specs, parquet_path, filters=_build_filters_dict(request.filters))
    return {chart["id"]: data for chart, data in zip(chart_specs, all_data)}


@router.put("/{dashboard_id}/charts/reorder")
def reorder_charts(
    dashboard_id: str,
    request: ReorderRequest,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    now = datetime.utcnow().isoformat()
    for idx, chart_id in enumerate(request.chart_ids):
        supabase.table("chart_specs").update({"order": idx, "updated_at": now}).eq("id", chart_id).eq("dashboard_id", dashboard_id).execute()

    return {"status": "success"}


@router.post("/{dashboard_id}/tabs", response_model=TabResponse)
def create_tab(
    dashboard_id: str,
    body: TabCreate,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    dash_result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    existing = supabase.table("dashboard_tabs").select("order").eq("dashboard_id", dashboard_id).order("order", desc=True).limit(1).execute()
    next_order = (existing.data[0]["order"] + 1) if existing.data else 0

    tab_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    payload = {
        "id": tab_id,
        "dashboard_id": dashboard_id,
        "title": body.title,
        "order": next_order,
        "created_at": now,
    }
    headers = _rest_headers()
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(f"{SUPABASE_REST_URL}/dashboard_tabs", headers=headers, json=payload)
        if resp.status_code >= 400:
            raise HTTPException(status_code=500, detail="Tab insert failed")
    return payload


@router.put("/tabs/{tab_id}", response_model=TabResponse)
def rename_tab(
    tab_id: str,
    body: TabUpdate,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    tab_result = supabase.table("dashboard_tabs").select("*").eq("id", tab_id).execute()
    if not tab_result.data:
        raise HTTPException(status_code=404, detail="Tab not found")

    dash_id = tab_result.data[0]["dashboard_id"]
    dash_result = supabase.table("dashboards").select("id").eq("id", dash_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Tab not found")

    supabase.table("dashboard_tabs").update({"title": body.title}).eq("id", tab_id).execute()
    tab_result.data[0]["title"] = body.title
    return tab_result.data[0]


@router.delete("/tabs/{tab_id}")
def delete_tab(
    tab_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    tab_result = supabase.table("dashboard_tabs").select("*").eq("id", tab_id).execute()
    if not tab_result.data:
        raise HTTPException(status_code=404, detail="Tab not found")

    dash_id = tab_result.data[0]["dashboard_id"]
    dash_result = supabase.table("dashboards").select("id").eq("id", dash_id).eq("user_id", user["id"]).execute()
    if not dash_result.data:
        raise HTTPException(status_code=404, detail="Tab not found")

    supabase.table("chart_specs").delete().eq("tab_id", tab_id).execute()
    supabase.table("dashboard_tabs").delete().eq("id", tab_id).execute()
    return {"status": "success"}
