import uuid
import json
import re
from datetime import datetime, timedelta
import httpx
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.api import (
    DashboardResponse, DashboardListResponse, DashboardUpdate, ChartCreateRequest,
    FilterSuggestResponse, DimensionFilterConfig, DateFilterConfig, DatePreset,
    ChartDataRequest, VersionCreateRequest, ColumnMatchResult, VersionInfo,
)
from app.utils.auth import get_current_user
from app.utils.supabase import get_supabase
from app.utils.duckdb import get_duckdb
from app.services.dashboard import build_dashboard
from app.services.upload import get_parquet_path, get_dataset_columns
from app.engine.visualization import query_chart_data, query_chart_data_batch
from app.config import settings

from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["dashboards"])

SUPABASE_REST_URL = settings.supabase_url.rstrip("/") + "/rest/v1"


class ReorderRequest(BaseModel):
    chart_ids: list[str]


def _rest_headers():
    return {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _has_versioning_columns(supabase) -> bool:
    """Check if the dashboards table has versioning columns."""
    try:
        supabase.table("dashboards").select("version_group_id").limit(1).execute()
        return True
    except Exception:
        return False


def get_dataset(dataset_id: str, user_id: str):
    supabase = get_supabase()
    result = supabase.table("datasets").select("*").eq("id", dataset_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return result.data[0]


@router.post("/datasets/{dataset_id}/dashboard/generate")
def generate_dashboard(
    dataset_id: str,
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
    now = datetime.utcnow().isoformat()

    headers = _rest_headers()

    def _post_json(url: str, payload: dict, label: str):
        with httpx.Client(timeout=15.0) as client:
            for attempt in range(2):
                try:
                    resp = client.post(url, headers=headers, json=payload)
                    if resp.status_code < 400:
                        return resp
                    raise HTTPException(status_code=500, detail=f"{label} failed: {resp.text}")
                except httpx.TimeoutException:
                    if attempt < 1:
                        continue
                    raise HTTPException(status_code=500, detail=f"{label} timed out")

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
    _post_json(f"{SUPABASE_REST_URL}/dashboards", dash_payload, "Dashboard insert")

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
            "created_at": now,
            "updated_at": now,
        })
    if chart_payloads:
        _post_json(f"{SUPABASE_REST_URL}/chart_specs", chart_payloads, "Chart batch insert")

    dashboard["id"] = db_dashboard_id
    if has_versioning:
        dashboard["version_group_id"] = db_dashboard_id
        dashboard["version_number"] = 1

    supabase.table("datasets").update({"status": "ready", "updated_at": now}).eq("id", dataset_id).execute()

    print(f"[generate_dashboard] Done at {time_mod.time() - t0:.1f}s", flush=True)
    return dashboard


@router.get("/dashboards")
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

    dashboards = []
    for vgid, d in groups.items():
        charts_result = supabase.table("chart_specs").select("*").eq("dashboard_id", d["id"]).order("order").execute()
        dashboards.append({
            **d,
            "charts": charts_result.data,
            "version_count": version_counts.get(vgid, 1),
            "version_group_id": vgid,
            "latest_tag": version_tags.get(vgid),
        })

    return {"dashboards": dashboards}


@router.get("/dashboards/by-group/{version_group_id}/versions")
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

    versions = []
    for d in result.data:
        charts_result = supabase.table("chart_specs").select("*").eq("dashboard_id", d["id"]).order("order").execute()
        versions.append({
            **d,
            "charts": charts_result.data,
            "charts_count": len(charts_result.data),
        })

    return {"versions": versions}


@router.post("/dashboards/{dashboard_id}/create-version")
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

    def _post_json(url: str, payload: dict, label: str):
        with httpx.Client(timeout=15.0) as client:
            for attempt in range(2):
                try:
                    resp = client.post(url, headers=headers, json=payload)
                    if resp.status_code < 400:
                        return resp
                    raise HTTPException(status_code=500, detail=f"{label} failed: {resp.text}")
                except httpx.TimeoutException:
                    if attempt < 1:
                        continue
                    raise HTTPException(status_code=500, detail=f"{label} timed out")

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

    # Copy semantics from source dataset to new dataset
    semantic_result = supabase.table("semantic_fields").select("*").eq("dataset_id", source_dataset_id).execute()
    for sf in semantic_result.data:
        supabase.table("semantic_fields").insert({
            "dataset_id": new_dataset_id,
            "field_name": sf["field_name"],
            "role": sf["role"],
            "aggregation": sf.get("aggregation"),
            "formatting": sf.get("formatting"),
            "description": sf.get("description"),
        }).execute()

    # Copy metrics from source dataset to new dataset
    metrics_result = supabase.table("metrics").select("*").eq("dataset_id", source_dataset_id).execute()
    for m in metrics_result.data:
        supabase.table("metrics").insert({
            "dataset_id": new_dataset_id,
            "user_id": user["id"],
            "name": m["name"],
            "expression": m["expression"],
            "aggregation": m["aggregation"],
            "field_name": m["field_name"],
            "formula": m.get("formula"),
        }).execute()

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
    _post_json(f"{SUPABASE_REST_URL}/dashboards", dash_payload, "Dashboard insert")

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
        _post_json(f"{SUPABASE_REST_URL}/chart_specs", chart_payloads, "Chart batch insert")

    supabase.table("datasets").update({"status": "ready", "updated_at": now}).eq("id", new_dataset_id).execute()

    return {
        "id": new_dash_id,
        "version_group_id": version_group_id,
        "version_number": next_vn,
        "tag": req.tag,
        "refresh_frequency": req.refresh_frequency,
    }


@router.get("/datasets/{dataset_id}/column-match")
def check_column_match(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    """Check if current dataset's columns match any existing dashboard's dataset columns."""
    print(f"[column-match] Starting for dataset {dataset_id}", flush=True)
    supabase = get_supabase()

    # Get current dataset columns from DB (fast) or parquet schema (fallback)
    current_cols = get_dataset_columns(dataset_id, supabase)
    if current_cols is None:
        print(f"[column-match] Could not get columns for {dataset_id}", flush=True)
        return {"matches": []}
    print(f"[column-match] Current columns: {sorted(current_cols)}", flush=True)

    # Find all dashboards by this user that have datasets with matching columns
    dashboards = supabase.table("dashboards").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    print(f"[column-match] Found {len(dashboards.data)} user dashboards", flush=True)

    matches = []
    seen_datasets = set()
    for d in dashboards.data:
        ds_id = d.get("dataset_id")
        if not ds_id or ds_id == dataset_id or ds_id in seen_datasets:
            continue
        seen_datasets.add(ds_id)

        try:
            other_cols = get_dataset_columns(ds_id, supabase)
            if other_cols is None:
                continue

            if current_cols == other_cols:
                ds_name = ""
                try:
                    ds_result = supabase.table("datasets").select("name").eq("id", ds_id).execute()
                    if ds_result.data:
                        ds_name = ds_result.data[0].get("name", "")
                except Exception:
                    pass
                vgid = d.get("version_group_id") or d["id"]
                print(f"[column-match] MATCH! Dashboard '{d['title']}' ({d['id']})", flush=True)
                matches.append({
                    "dashboard_id": d["id"],
                    "dashboard_title": d["title"],
                    "dataset_id": ds_id,
                    "dataset_name": ds_name,
                    "version_group_id": vgid,
                    "version_number": d.get("version_number") or 1,
                })
        except Exception as e:
            print(f"[column-match] Error checking dataset {ds_id}: {e}", flush=True)
            continue

    print(f"[column-match] Returning {len(matches)} matches", flush=True)
    return {"matches": matches}


@router.get("/dashboards/{dashboard_id}")
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

    dataset = supabase.table("datasets").select("parquet_path").eq("id", dashboard["dataset_id"]).execute()
    parquet_path = get_parquet_path(dataset.data[0]["parquet_path"]) if dataset.data else ""

    charts = []
    for chart in charts_result.data:
        chart_data = query_chart_data(chart, parquet_path) if parquet_path else {"labels": [], "values": []}
        chart["data"] = chart_data
        charts.append(chart)

    dashboard["charts"] = charts
    return dashboard


@router.put("/dashboards/{dashboard_id}", response_model=DashboardResponse)
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
        for chart in update.charts:
            supabase.table("chart_specs").insert({
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
            }).execute()

    return get_dashboard(dashboard_id, user)


@router.delete("/dashboards/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    result = supabase.table("dashboards").select("*").eq("id", dashboard_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    supabase.table("chart_specs").delete().eq("dashboard_id", dashboard_id).execute()
    supabase.table("dashboards").delete().eq("id", dashboard_id).execute()

    return {"status": "success"}


@router.get("/dashboards/{dashboard_id}/available-fields")
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


@router.get("/dashboards/{dashboard_id}/filters/suggest", response_model=FilterSuggestResponse)
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
                row = conn.execute(f'SELECT MIN("{field_name}"), MAX("{field_name}") FROM \'{parquet_path}\'').fetchone()
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

            cardinality = conn.execute(f'SELECT COUNT(DISTINCT "{field_name}") FROM \'{parquet_path}\'').fetchone()[0]
            if cardinality > 500:
                continue

            limit = min(cardinality, 500)
            rows = conn.execute(f'SELECT DISTINCT "{field_name}" FROM \'{parquet_path}\' WHERE "{field_name}" IS NOT NULL ORDER BY "{field_name}" LIMIT {limit}').fetchall()
            values = [{"label": str(r[0]), "value": str(r[0])} for r in rows]

            suggestions.append(DimensionFilterConfig(
                field_name=field_name,
                label=field_name.replace("_", " ").title(),
                values=values,
                cardinality=cardinality,
            ))

        suggestions.sort(key=lambda f: (0 if f.field_name.lower() in _PRIORITY_FIELDS else 1, getattr(f, 'cardinality', 999)))
        suggestions = suggestions[:15]

    return {"filters": suggestions}


@router.post("/dashboards/{dashboard_id}/charts")
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
    title = chart.title or f"{chart.aggregation}({chart.y_field}) by {chart.x_field}" if chart.x_field else f"{chart.aggregation}({chart.y_field})"

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
        "created_at": now,
        "updated_at": now,
    }

    headers = _rest_headers()
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(f"{SUPABASE_REST_URL}/chart_specs", headers=headers, json=chart_payload)
        if resp.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Chart insert failed: {resp.text}")

    return {**chart_payload, "data": chart_data}


@router.delete("/dashboards/{dashboard_id}/charts/{chart_id}")
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


@router.post("/dashboards/{dashboard_id}/charts/{chart_id}/data")
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

    filters_dict = {}
    for f in request.filters:
        fd = {"type": f.type}
        if f.type == "dimension":
            fd["values"] = f.values or []
        elif f.type == "date":
            fd["start"] = f.start or ""
            fd["end"] = f.end or ""
        filters_dict[f.field_name] = fd

    chart_data = query_chart_data(chart_result.data[0], parquet_path, filters=filters_dict or None)
    return chart_data


@router.post("/dashboards/{dashboard_id}/data")
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

    filters_dict = {}
    for f in request.filters:
        fd = {"type": f.type}
        if f.type == "dimension":
            fd["values"] = f.values or []
        elif f.type == "date":
            fd["start"] = f.start or ""
            fd["end"] = f.end or ""
        filters_dict[f.field_name] = fd

    all_data = query_chart_data_batch(chart_specs, parquet_path, filters=filters_dict or None)
    return {chart["id"]: data for chart, data in zip(chart_specs, all_data)}


@router.put("/dashboards/{dashboard_id}/charts/reorder")
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
