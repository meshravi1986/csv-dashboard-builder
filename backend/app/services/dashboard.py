import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from openai import OpenAI
from app.config import settings
from app.prompts.chart import CHART_TITLE_PROMPT, DASHBOARD_COMPOSITION_PROMPT
from app.engine.visualization import generate_chart_specs, generate_dashboard_title, query_chart_data, query_chart_data_batch, suppress_charts, layout_dashboard
from app.engine.profiling import profile_dataset

_has_valid_key = settings.openai_api_key and not settings.openai_api_key.startswith("your_")
client = OpenAI(api_key=settings.openai_api_key, timeout=10.0) if _has_valid_key else None


def get_ai_chart_titles(chart_specs: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
    if not client or not chart_specs:
        return None

    suggestions = []
    for spec in chart_specs:
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": CHART_TITLE_PROMPT.format(
                            chart_type=spec["chart_type"],
                            x_field=spec["x_field"],
                            y_field=spec["y_field"],
                            x_role=spec["x_role"],
                            y_role=spec["y_role"],
                            aggregation=spec["aggregation"],
                        ),
                    },
                    {"role": "user", "content": "Generate a polished title."},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=200,
            )
            content = response.choices[0].message.content
            if content:
                result = json.loads(content)
                suggestions.append({
                    "x_field": spec["x_field"],
                    "y_field": spec["y_field"],
                    "title": result.get("title"),
                    "description": result.get("description"),
                })
        except Exception:
            suggestions.append({
                "x_field": spec["x_field"],
                "y_field": spec["y_field"],
                "title": None,
            })

    return suggestions


def get_ai_dashboard_composition(semantics_json: str) -> Dict[str, str]:
    if not client:
        return {
            "title": "Data Dashboard",
            "description": "Executive overview of key metrics",
        }

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": DASHBOARD_COMPOSITION_PROMPT.format(
                        semantics_json=semantics_json
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=200,
        )
        content = response.choices[0].message.content
        if content:
            return json.loads(content)
    except Exception:
        pass

    return {
        "title": "Data Dashboard",
        "description": "Executive overview of key metrics",
    }


def build_dashboard(
    dataset_id: str,
    user_id: str,
    semantic_fields: List[Dict[str, Any]],
    parquet_path: str = "",
    metrics: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    ai_titles = get_ai_chart_titles([])
    profile = profile_dataset(parquet_path, dataset_id=dataset_id) if parquet_path else None

    chart_specs = generate_chart_specs(semantic_fields, ai_titles, profile=profile)

    if metrics:
        for metric in metrics:
            formula = metric.get("formula")
            kpi_spec = {
                "chart_type": "kpi",
                "x_field": "",
                "y_field": metric.get("field_name", ""),
                "aggregation": metric.get("aggregation", "SUM"),
                "formula": formula,
                "x_role": "dimension",
                "y_role": "measure",
                "order": len(chart_specs),
                "width": "half",
                "title": metric.get("name", f"KPI {metric.get('field_name', '')}"),
                "semantic_reasoning": f"User-defined metric: {metric.get('name', '')}",
                "chart_reasoning": "KPI card for user-defined metric",
                "aggregation_reasoning": f"{metric.get('aggregation', 'SUM')} applied to {formula or metric.get('field_name', '')}",
            }
            chart_specs.append(kpi_spec)

    ai_composition = get_ai_dashboard_composition(json.dumps(semantic_fields, indent=2))
    title = ai_composition.get("title", "Data Dashboard")
    description = ai_composition.get("description", "Executive overview")

    dashboard_id = str(uuid.uuid4())
    default_tab_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    charts = []
    all_chart_data = query_chart_data_batch(chart_specs, parquet_path) if parquet_path else [{"labels": [], "values": []} for _ in chart_specs]

    chart_specs, all_chart_data = suppress_charts(chart_specs, all_chart_data, profile, row_count=profile.get("row_count", 0) if profile else 0)

    if not chart_specs:
        chart_specs = [{"chart_type": "kpi", "x_field": "", "y_field": "", "aggregation": "COUNT", "x_role": "dimension", "y_role": "measure", "order": 0, "width": "full", "title": "No Data", "semantic_reasoning": "", "chart_reasoning": "", "aggregation_reasoning": "", "formula": None}]
        all_chart_data = [{"labels": [], "values": [0]}]

    # Merge data into specs for layout reordering
    for spec, data in zip(chart_specs, all_chart_data):
        spec["_data"] = data
    chart_specs = layout_dashboard(chart_specs)
    all_chart_data = [s.pop("_data") for s in chart_specs]

    for i, spec in enumerate(chart_specs):
        chart_id = str(uuid.uuid4())
        chart_data = all_chart_data[i] if i < len(all_chart_data) else {"labels": [], "values": []}
        charts.append({
            "id": chart_id,
            "dashboard_id": dashboard_id,
            "chart_type": spec["chart_type"],
            "title": spec["title"],
            "x_field": spec["x_field"],
            "y_field": spec["y_field"],
            "aggregation": spec["aggregation"],
            "formula": spec.get("formula"),
            "x_role": spec["x_role"],
            "y_role": spec["y_role"],
            "semantic_reasoning": spec["semantic_reasoning"],
            "chart_reasoning": spec["chart_reasoning"],
            "aggregation_reasoning": spec["aggregation_reasoning"],
            "order": spec["order"],
            "width": spec["width"],
            "tab_id": default_tab_id,
            "data": chart_data,
            "created_at": now,
            "updated_at": now,
        })

    tabs = [{
        "id": default_tab_id,
        "dashboard_id": dashboard_id,
        "title": title or "Dashboard",
        "order": 0,
        "created_at": now,
    }]

    return {
        "id": dashboard_id,
        "dataset_id": dataset_id,
        "user_id": user_id,
        "title": title,
        "description": description,
        "charts": charts,
        "tabs": tabs,
        "created_at": now,
        "updated_at": now,
    }
