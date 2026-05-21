import uuid
import json
from datetime import datetime
import httpx
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.api import DashboardResponse, DashboardListResponse, DashboardUpdate, ChartCreateRequest
from app.utils.auth import get_current_user
from app.utils.supabase import get_supabase
from app.services.dashboard import build_dashboard
from app.services.upload import get_parquet_path
from app.engine.visualization import query_chart_data
from app.config import settings

router = APIRouter(prefix="/api/v1", tags=["dashboards"])

SUPABASE_REST_URL = settings.supabase_url.rstrip("/") + "/rest/v1"


def _rest_headers():
    return {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


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

    print(f"Semantic fields: {semantic_fields}", flush=True)

    metrics_result = supabase.table("metrics").select("*").eq("dataset_id", dataset_id).execute()
    user_metrics = metrics_result.data or []
    print(f"User-defined metrics: {len(user_metrics)}", flush=True)
    for m in user_metrics:
        print(f"  Metric: name={m.get('name')}, formula={m.get('formula')}, field_name={m.get('field_name')}", flush=True)

    parquet_path = get_parquet_path(dataset["parquet_path"])
    dashboard = build_dashboard(dataset_id, user["id"], semantic_fields, parquet_path, metrics=user_metrics)

    print(f"Dashboard built: {dashboard['title']} with {len(dashboard['charts'])} charts", flush=True)
    for c in dashboard["charts"]:
        print(f"  Chart: type={c['chart_type']}, y={c['y_field']}, formula={c.get('formula')}", flush=True)

    # Delete existing dashboard for this dataset
    existing = supabase.table("dashboards").select("*").eq("dataset_id", dataset_id).execute()
    if existing.data:
        for d in existing.data:
            supabase.table("chart_specs").delete().eq("dashboard_id", d["id"]).execute()
        supabase.table("dashboards").delete().eq("id", existing.data[0]["id"]).execute()

    db_dashboard_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    headers = _rest_headers()

    def _post_json(url: str, payload: dict, label: str):
        with httpx.Client(timeout=15.0) as client:
            for attempt in range(3):
                try:
                    resp = client.post(url, headers=headers, json=payload)
                    if resp.status_code < 400:
                        return resp
                    if resp.status_code >= 500 and attempt < 2:
                        continue
                    raise HTTPException(status_code=500, detail=f"{label} failed: {resp.text}")
                except httpx.TimeoutException:
                    if attempt < 2:
                        continue
                    raise HTTPException(status_code=500, detail=f"{label} timed out")

    dash_payload = {
        "id": db_dashboard_id,
        "user_id": user["id"],
        "dataset_id": dataset_id,
        "title": dashboard["title"],
        "description": dashboard.get("description"),
        "created_at": now,
        "updated_at": now,
    }
    _post_json(f"{SUPABASE_REST_URL}/dashboards", dash_payload, "Dashboard insert")

    for chart in dashboard["charts"]:
        chart_payload = {
            "id": str(uuid.uuid4()),
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
        }
        _post_json(f"{SUPABASE_REST_URL}/chart_specs", chart_payload, "Chart insert")

    dashboard["id"] = db_dashboard_id
    for c in dashboard["charts"]:
        c["dashboard_id"] = db_dashboard_id

    supabase.table("datasets").update({"status": "ready", "updated_at": now}).eq("id", dataset_id).execute()

    return dashboard


@router.get("/dashboards")
def list_dashboards(
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    result = supabase.table("dashboards").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()

    dashboards = []
    for d in result.data:
        charts_result = supabase.table("chart_specs").select("*").eq("dashboard_id", d["id"]).order("order").execute()
        dashboards.append({
            **d,
            "charts": charts_result.data,
        })

    return {"dashboards": dashboards}


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
