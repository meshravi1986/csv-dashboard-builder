from fastapi import APIRouter, Depends, HTTPException
from app.schemas.api import (
    DatasetProfileResponse,
    MetricResponse,
    MetricCreate,
    SemanticUpdateRequest,
    SemanticSuggestResponse,
    SemanticField,
    SuggestSQLRequest,
    SuggestSQLResponse,
    PreviewSQLRequest,
    PreviewSQLResponse,
)
from app.utils.auth import get_current_user
from app.utils.supabase import get_supabase
from app.api.dashboards import get_dataset
from app.engine.profiling import profile_dataset
from app.services.upload import get_parquet_path
from app.services.semantic import get_ai_semantic_suggestions
from app.utils.duckdb import get_duckdb
import json
import re
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/v1/datasets", tags=["datasets"])


@router.get("/ping")
def ping():
    print("PING ENDPOINT CALLED", flush=True)
    return {"status": "ok"}


@router.get("/{dataset_id}/profile", response_model=DatasetProfileResponse)
def get_dataset_profile(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    dataset = get_dataset(dataset_id, user["id"])
    parquet_path = get_parquet_path(dataset["parquet_path"])
    profile = profile_dataset(parquet_path)

    supabase = get_supabase()
    supabase.table("datasets").update({"status": "profiled", "updated_at": datetime.utcnow().isoformat()}).eq("id", dataset_id).execute()

    return {
        "dataset_id": dataset_id,
        "field_count": profile["field_count"],
        "row_count": profile["row_count"],
        "total_null_cells": profile["total_null_cells"],
        "fields": profile["fields"],
    }


@router.get("/{dataset_id}/semantics/suggest", response_model=SemanticSuggestResponse)
def suggest_semantics(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    dataset = get_dataset(dataset_id, user["id"])
    parquet_path = get_parquet_path(dataset["parquet_path"])
    profile = profile_dataset(parquet_path)

    ai_suggestions = get_ai_semantic_suggestions(profile)

    fields = []
    for field in profile["fields"]:
        sf = SemanticField(
            field_name=field["field_name"],
            role="measure" if field["detected_type"] == "numeric" else "date" if field["detected_type"] == "date" else "dimension",
            aggregation="SUM" if field["detected_type"] == "numeric" else None,
        )
        if ai_suggestions:
            match = next((s for s in ai_suggestions if s.get("field_name") == field["field_name"]), None)
            if match:
                sf.suggested_role = match.get("suggested_role")
                sf.suggested_aggregation = match.get("suggested_aggregation")
        fields.append(sf)

    return SemanticSuggestResponse(fields=fields)


@router.put("/{dataset_id}/semantics")
def update_semantics(
    dataset_id: str,
    request: SemanticUpdateRequest,
    user: dict = Depends(get_current_user),
):
    dataset = get_dataset(dataset_id, user["id"])
    supabase = get_supabase()

    existing = supabase.table("semantic_fields").select("*").eq("dataset_id", dataset_id).execute()
    if existing.data:
        supabase.table("semantic_fields").delete().eq("dataset_id", dataset_id).execute()

    now = datetime.utcnow().isoformat()
    for field in request.fields:
        supabase.table("semantic_fields").insert({
            "id": str(uuid.uuid4()),
            "dataset_id": dataset_id,
            "field_name": field.field_name,
            "role": field.role,
            "aggregation": field.aggregation,
            "formatting": field.formatting,
            "created_at": now,
            "updated_at": now,
        }).execute()

    supabase.table("datasets").update({"status": "semantic", "updated_at": now}).eq("id", dataset_id).execute()

    return {"status": "success"}


@router.post("/{dataset_id}/metrics/suggest-sql", response_model=SuggestSQLResponse)
def suggest_metric_sql(
    dataset_id: str,
    request: SuggestSQLRequest,
    user: dict = Depends(get_current_user),
):
    from app.services.metric_sql import suggest_sql

    dataset = get_dataset(dataset_id, user["id"])
    parquet_path = get_parquet_path(dataset["parquet_path"])
    profile = profile_dataset(parquet_path)
    sql = suggest_sql(profile, request.description)
    if not sql:
        raise HTTPException(status_code=500, detail="Failed to generate SQL")
    return {"sql": sql}


@router.post("/{dataset_id}/metrics/preview-sql", response_model=PreviewSQLResponse)
def preview_metric_sql(
    dataset_id: str,
    request: PreviewSQLRequest,
    user: dict = Depends(get_current_user),
):
    from app.utils.duckdb import get_duckdb

    dataset = get_dataset(dataset_id, user["id"])
    parquet_path = get_parquet_path(dataset["parquet_path"])

    try:
        with get_duckdb() as conn:
            sql = request.sql.strip()
            if sql.upper().startswith("SELECT"):
                result = conn.execute(sql).fetchone()
            else:
                sql = f"SELECT {sql} as value FROM '{parquet_path}'"
                result = conn.execute(sql).fetchone()
            val = float(result[0]) if result and result[0] is not None else None
            return {"value": val, "error": None}
    except Exception as e:
        return {"value": None, "error": str(e)}


@router.get("/metrics/all")
def get_all_metrics(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("metrics").select("*").eq("user_id", user["id"]).execute()
    metrics = result.data or []
    dataset_ids = list(set(m["dataset_id"] for m in metrics))
    if dataset_ids:
        datasets_result = supabase.table("datasets").select("id,name").in_("id", dataset_ids).execute()
        dataset_map = {d["id"]: d["name"] for d in (datasets_result.data or [])}
        for m in metrics:
            m["dataset_name"] = dataset_map.get(m["dataset_id"], "Unknown")
    return {"metrics": metrics}


def _extract_metric_fields(metric: dict) -> list[str]:
    fields = []
    if metric.get("field_name"):
        fields.append(metric["field_name"])
    if metric.get("formula"):
        quoted = re.findall(r'"([^"]+)"', metric["formula"])
        fields.extend(quoted)
        if not quoted:
            for m in re.finditer(r'(\w+)\(([^)]+)\)', metric["formula"]):
                field = m.group(2).strip()
                if field and field.upper() not in ("CASE", "WHEN", "THEN", "ELSE", "END", "NULL", "TRUE", "FALSE"):
                    fields.append(field)
    return list(set(fields))


@router.get("/{dataset_id}/metrics/available")
def get_available_metrics(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    dataset = get_dataset(dataset_id, user["id"])
    parquet_path = get_parquet_path(dataset["parquet_path"])

    with get_duckdb() as conn:
        cols = conn.execute(f"SELECT column_name FROM (DESCRIBE SELECT * FROM '{parquet_path}')").fetchall()
        current_fields = {c[0] for c in cols}

    supabase = get_supabase()
    metrics_result = supabase.table("metrics").select("*").eq("user_id", user["id"]).neq("dataset_id", dataset_id).execute()
    all_metrics = metrics_result.data or []

    dataset_ids = list(set(m["dataset_id"] for m in all_metrics))
    dataset_map = {}
    if dataset_ids:
        ds_result = supabase.table("datasets").select("id,name").in_("id", dataset_ids).execute()
        dataset_map = {d["id"]: d["name"] for d in (ds_result.data or [])}

    available = []
    for m in all_metrics:
        required = _extract_metric_fields(m)
        if required and all(f in current_fields for f in required):
            available.append({
                **m,
                "required_fields": required,
                "source_dataset_name": dataset_map.get(m["dataset_id"], "Unknown"),
            })

    return {"metrics": available}


@router.get("/{dataset_id}/metrics")
def get_metrics(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    dataset = get_dataset(dataset_id, user["id"])
    supabase = get_supabase()
    result = supabase.table("metrics").select("*").eq("dataset_id", dataset_id).execute()
    return {"metrics": result.data}


@router.post("/{dataset_id}/metrics", response_model=MetricResponse)
def create_metric(
    dataset_id: str,
    metric: MetricCreate,
    user: dict = Depends(get_current_user),
):
    dataset = get_dataset(dataset_id, user["id"])
    supabase = get_supabase()

    metric_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    if metric.formula:
        expression = metric.formula
    else:
        expression = f"{metric.aggregation}({metric.field_name})"

    data = {
        "id": metric_id,
        "dataset_id": dataset_id,
        "user_id": user["id"],
        "name": metric.name,
        "expression": expression,
        "aggregation": metric.aggregation,
        "field_name": metric.field_name or "",
        "formula": metric.formula,
        "created_at": now,
        "updated_at": now,
    }

    supabase.table("metrics").insert(data).execute()

    return {**data, "created_at": now, "updated_at": now}


@router.put("/{dataset_id}/metrics/{metric_id}", response_model=MetricResponse)
def update_metric(
    dataset_id: str,
    metric_id: str,
    metric: MetricCreate,
    user: dict = Depends(get_current_user),
):
    print(f"UPDATE METRIC: name={metric.name}, formula={metric.formula!r}, field_name={metric.field_name!r}, aggregation={metric.aggregation!r}", flush=True)

    dataset = get_dataset(dataset_id, user["id"])
    supabase = get_supabase()
    now = datetime.utcnow().isoformat()

    if metric.formula:
        expression = metric.formula
    else:
        expression = f"{metric.aggregation}({metric.field_name})"

    data = {
        "name": metric.name,
        "expression": expression,
        "aggregation": metric.aggregation,
        "field_name": metric.field_name or "",
        "formula": metric.formula,
        "updated_at": now,
    }

    supabase.table("metrics").update(data).eq("id", metric_id).eq("dataset_id", dataset_id).execute()
    result = supabase.table("metrics").select("*").eq("id", metric_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Metric not found")
    return result.data[0]


@router.delete("/{dataset_id}/metrics/{metric_id}")
def delete_metric(
    dataset_id: str,
    metric_id: str,
    user: dict = Depends(get_current_user),
):
    dataset = get_dataset(dataset_id, user["id"])
    supabase = get_supabase()
    supabase.table("metrics").delete().eq("id", metric_id).eq("dataset_id", dataset_id).execute()
    return {"status": "success"}
