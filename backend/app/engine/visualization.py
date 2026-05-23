from typing import Any, Dict, List, Optional
import json
import duckdb
from app.utils.duckdb import get_duckdb
from app.engine.scoring import score_chart_combination


DETERMINISTIC_CHART_RULES = {
    ("date", "measure"): "line",
    ("dimension", "measure"): "bar",
    ("measure", "measure"): "scatter",
}


def determine_chart_type(x_role: str, y_role: str) -> str:
    key = (x_role, y_role)
    return DETERMINISTIC_CHART_RULES.get(key, "bar") if (x_role, y_role) in DETERMINISTIC_CHART_RULES else "bar"


def _build_profile_map(profile: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    if not profile:
        return {}
    return {f["field_name"]: f for f in profile.get("fields", [])}


def generate_chart_specs(
    semantic_fields: List[Dict[str, Any]],
    ai_suggestions: Optional[List[Dict[str, Any]]] = None,
    profile: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    dimensions = [f for f in semantic_fields if f.get("role") == "dimension"]
    measures = [f for f in semantic_fields if f.get("role") == "measure"]
    date_fields = [f for f in semantic_fields if f.get("role") == "date"]
    profile_map = _build_profile_map(profile)
    row_count = (profile or {}).get("row_count", 0)

    specs = []

    for date_field in date_fields:
        for measure in measures:
            agg = measure.get("aggregation") or "SUM"
            chart_type = determine_chart_type("date", "measure")
            spec = {
                "chart_type": chart_type,
                "x_field": date_field["field_name"],
                "y_field": measure["field_name"],
                "aggregation": agg,
                "x_role": "date",
                "y_role": "measure",
                "width": "full" if len(specs) == 0 else "half",
                "title": f"{measure['field_name']} over {date_field['field_name']}",
                "semantic_reasoning": f"{measure['field_name']} is a {agg}-aggregated measure, {date_field['field_name']} is a date dimension",
                "chart_reasoning": f"Line chart selected for time-series data ({date_field['field_name']} → {measure['field_name']})",
                "aggregation_reasoning": f"{agg} used for {measure['field_name']} as specified in semantic model",
            }
            scoring = score_chart_combination(
                x_field=date_field["field_name"],
                y_field=measure["field_name"],
                chart_type=chart_type,
                x_profile=profile_map.get(date_field["field_name"]),
                y_profile=profile_map.get(measure["field_name"]),
                row_count=row_count,
            )
            spec["chart_score"] = scoring["chart_score"]
            spec["score_reasons"] = scoring["score_reasons"]
            if ai_suggestions:
                ai_match = next(
                    (s for s in ai_suggestions if s.get("x_field") == date_field["field_name"] and s.get("y_field") == measure["field_name"]),
                    None,
                )
                if ai_match:
                    if ai_match.get("title"):
                        spec["title"] = ai_match["title"]
                    if ai_match.get("chart_reasoning"):
                        spec["chart_reasoning"] = ai_match["chart_reasoning"]
            if scoring["should_render"]:
                specs.append(spec)

    for dim in dimensions:
        for measure in measures:
            agg = measure.get("aggregation") or "SUM"
            chart_type = determine_chart_type("dimension", "measure")
            spec = {
                "chart_type": chart_type,
                "x_field": dim["field_name"],
                "y_field": measure["field_name"],
                "aggregation": agg,
                "x_role": "dimension",
                "y_role": "measure",
                "width": "half" if len(specs) > 1 else "full",
                "title": f"{measure['field_name']} by {dim['field_name']}",
                "semantic_reasoning": f"{measure['field_name']} is a {agg}-aggregated measure grouped by {dim['field_name']}",
                "chart_reasoning": f"Bar chart selected for categorical comparison ({dim['field_name']} → {measure['field_name']})",
                "aggregation_reasoning": f"{agg} used for {measure['field_name']}",
            }
            scoring = score_chart_combination(
                x_field=dim["field_name"],
                y_field=measure["field_name"],
                chart_type=chart_type,
                x_profile=profile_map.get(dim["field_name"]),
                y_profile=profile_map.get(measure["field_name"]),
                row_count=row_count,
            )
            spec["chart_score"] = scoring["chart_score"]
            spec["score_reasons"] = scoring["score_reasons"]
            if ai_suggestions:
                ai_match = next(
                    (s for s in ai_suggestions if s.get("x_field") == dim["field_name"] and s.get("y_field") == measure["field_name"]),
                    None,
                )
                if ai_match:
                    if ai_match.get("title"):
                        spec["title"] = ai_match["title"]
                    if ai_match.get("chart_reasoning"):
                        spec["chart_reasoning"] = ai_match["chart_reasoning"]
            if scoring["should_render"]:
                specs.append(spec)

    for measure in measures:
        agg = measure.get("aggregation") or "SUM"
        spec = {
            "chart_type": "kpi",
            "x_field": "",
            "y_field": measure["field_name"],
            "aggregation": agg,
            "x_role": "dimension",
            "y_role": "measure",
            "width": "half",
            "title": f"Total {measure['field_name']}",
            "semantic_reasoning": f"Single metric KPI for {measure['field_name']}",
            "chart_reasoning": "KPI card selected for single metric display",
            "aggregation_reasoning": f"{agg} applied to {measure['field_name']}",
        }
        scoring = score_chart_combination(
            x_field=None,
            y_field=measure["field_name"],
            chart_type="kpi",
            x_profile=None,
            y_profile=profile_map.get(measure["field_name"]),
            row_count=row_count,
        )
        spec["chart_score"] = scoring["chart_score"]
        spec["score_reasons"] = scoring["score_reasons"]
        if scoring["should_render"]:
            specs.append(spec)

    if len(measures) >= 2:
        for i, m1 in enumerate(measures):
            for m2 in measures[i + 1:]:
                chart_type = "scatter"
                spec = {
                    "chart_type": chart_type,
                    "x_field": m1["field_name"],
                    "y_field": m2["field_name"],
                    "aggregation": m1.get("aggregation") or "SUM",
                    "x_role": "measure",
                    "y_role": "measure",
                    "width": "half",
                    "title": f"{m1['field_name']} vs {m2['field_name']}",
                    "semantic_reasoning": f"Comparing two measures: {m1['field_name']} and {m2['field_name']}",
                    "chart_reasoning": "Scatter chart selected for two-measure correlation analysis",
                    "aggregation_reasoning": f"Raw values plotted for {m1['field_name']} and {m2['field_name']}",
                }
                scoring = score_chart_combination(
                    x_field=m1["field_name"],
                    y_field=m2["field_name"],
                    chart_type=chart_type,
                    x_profile=profile_map.get(m1["field_name"]),
                    y_profile=profile_map.get(m2["field_name"]),
                    row_count=row_count,
                )
                spec["chart_score"] = scoring["chart_score"]
                spec["score_reasons"] = scoring["score_reasons"]
                if scoring["should_render"]:
                    specs.append(spec)

    for i, spec in enumerate(specs):
        spec["order"] = i

    return specs


def generate_dashboard_title(
    semantic_fields: List[Dict[str, Any]],
    ai_title: Optional[str] = None,
) -> str:
    if ai_title:
        return ai_title
    measures = [f["field_name"] for f in semantic_fields if f.get("role") == "measure"]
    if measures:
        return f"{', '.join(measures[:3])} Dashboard"
    return "Data Dashboard"


def _build_filter_sql(filters: Optional[Dict[str, Any]] = None) -> str:
    if not filters:
        return ""
    conditions = []
    for field_name, fdef in filters.items():
        if fdef.get("type") == "dimension" and fdef.get("values"):
            vals = fdef["values"]
            quoted = [f"'{v.replace(chr(39), chr(39)*2)}'" for v in vals]
            conditions.append(f"\"{field_name}\" IN ({','.join(quoted)})")
        elif fdef.get("type") == "date":
            start = fdef.get("start")
            end = fdef.get("end")
            if start and end:
                conditions.append(f"\"{field_name}\" BETWEEN '{start}' AND '{end}'")
            elif start:
                conditions.append(f"\"{field_name}\" >= '{start}'")
            elif end:
                conditions.append(f"\"{field_name}\" <= '{end}'")
    if not conditions:
        return ""
    return " AND " + " AND ".join(conditions)


def query_chart_data(chart_spec: Dict[str, Any], parquet_path: str, filters: Optional[Dict[str, Any]] = None, conn: Optional[duckdb.DuckDBPyConnection] = None) -> Dict[str, Any]:
    if conn is None:
        with get_duckdb() as c:
            return _query_chart_data_with_conn(chart_spec, parquet_path, filters, c)
    return _query_chart_data_with_conn(chart_spec, parquet_path, filters, conn)


def query_chart_data_batch(chart_specs: List[Dict[str, Any]], parquet_path: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    with get_duckdb() as conn:
        return [_query_chart_data_with_conn(spec, parquet_path, filters, conn) for spec in chart_specs]


def _query_chart_data_with_conn(chart_spec: Dict[str, Any], parquet_path: str, filters: Optional[Dict[str, Any]], conn: duckdb.DuckDBPyConnection) -> Dict[str, Any]:
    x_field = chart_spec["x_field"]
    y_field = chart_spec["y_field"]
    aggregation = chart_spec.get("aggregation") or "SUM"
    chart_type = chart_spec["chart_type"]
    formula = chart_spec.get("formula")

    filter_sql = _build_filter_sql(filters)

    def agg_fn(expr: str) -> str:
        if aggregation == "COUNT_DISTINCT":
            return f"COUNT(DISTINCT {expr})"
        return f"{aggregation}({expr})"

    def is_pre_aggregated(expr: str) -> bool:
        aggs = {"SUM(", "AVG(", "COUNT(", "MIN(", "MAX("}
        return any(agg in expr.upper() for agg in aggs)

    def value_expr():
        if formula:
            if is_pre_aggregated(formula):
                return formula
            return agg_fn(formula)
        if not y_field:
            return "0"
        return agg_fn(f"\"{y_field}\"")

    def raw_expr():
        if formula:
            return formula
        return f"\"{y_field}\""

    try:
        if chart_type == "kpi":
            sql = f"SELECT COALESCE({value_expr()}, 0) as value FROM '{parquet_path}'{' WHERE 1=1' + filter_sql if filter_sql else ''}"
            result = conn.execute(sql).fetchone()
            val = float(result[0]) if result else 0
            return {"labels": [], "values": [val]}

        if chart_type == "pie":
            sql = f"SELECT \"{x_field}\" as label, {value_expr()} as value FROM '{parquet_path}' WHERE \"{x_field}\" IS NOT NULL{filter_sql} GROUP BY \"{x_field}\" ORDER BY value DESC LIMIT 20"
            result = conn.execute(sql).fetchall()
            return {
                "labels": [str(r[0]) for r in result],
                "values": [float(r[1]) if r[1] is not None else 0 for r in result],
            }

        if chart_type == "scatter":
            sql = f"SELECT \"{x_field}\" as x, {raw_expr()} as y FROM '{parquet_path}' WHERE \"{x_field}\" IS NOT NULL AND {raw_expr()} IS NOT NULL{filter_sql} LIMIT 1000"
            result = conn.execute(sql).fetchall()
            return {
                "labels": [],
                "values": [{"x": r[0], "y": r[1]} for r in result],
            }

        sql = f"SELECT \"{x_field}\" as label, {value_expr()} as value FROM '{parquet_path}' WHERE \"{x_field}\" IS NOT NULL{filter_sql} GROUP BY \"{x_field}\" ORDER BY value DESC LIMIT 50"
        result = conn.execute(sql).fetchall()
        return {
            "labels": [str(r[0]) for r in result],
            "values": [float(r[1]) if r[1] is not None else 0 for r in result],
        }
    except Exception as e:
        print(f"Query error for chart_type={chart_type}, filters={filters}: {e}", flush=True)
        return {"labels": [], "values": []}
