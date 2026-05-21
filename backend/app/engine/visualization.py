from typing import Any, Dict, List, Optional
import json
from app.utils.duckdb import query_parquet, get_duckdb


DETERMINISTIC_CHART_RULES = {
    ("date", "measure"): "line",
    ("dimension", "measure"): "bar",
    ("measure", "measure"): "scatter",
}


def determine_chart_type(x_role: str, y_role: str) -> str:
    key = (x_role, y_role)
    return     DETERMINISTIC_CHART_RULES.get(key, "bar") if (x_role, y_role) in DETERMINISTIC_CHART_RULES else "bar"


def generate_chart_specs(
    semantic_fields: List[Dict[str, Any]],
    ai_suggestions: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    dimensions = [f for f in semantic_fields if f.get("role") == "dimension"]
    measures = [f for f in semantic_fields if f.get("role") == "measure"]
    date_fields = [f for f in semantic_fields if f.get("role") == "date"]

    specs = []
    order = 0

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
                "order": order,
                "width": "full" if order == 0 else "half",
                "title": f"{measure['field_name']} over {date_field['field_name']}",
                "semantic_reasoning": f"{measure['field_name']} is a {agg}-aggregated measure, {date_field['field_name']} is a date dimension",
                "chart_reasoning": f"Line chart selected for time-series data ({date_field['field_name']} → {measure['field_name']})",
                "aggregation_reasoning": f"{agg} used for {measure['field_name']} as specified in semantic model",
            }
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
            specs.append(spec)
            order += 1

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
                "order": order,
                "width": "half" if order > 1 else "full",
                "title": f"{measure['field_name']} by {dim['field_name']}",
                "semantic_reasoning": f"{measure['field_name']} is a {agg}-aggregated measure grouped by {dim['field_name']}",
                "chart_reasoning": f"Bar chart selected for categorical comparison ({dim['field_name']} → {measure['field_name']})",
                "aggregation_reasoning": f"{agg} used for {measure['field_name']}",
            }
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
            specs.append(spec)
            order += 1

    for measure in measures:
        agg = measure.get("aggregation") or "SUM"
        spec = {
            "chart_type": "kpi",
            "x_field": "",
            "y_field": measure["field_name"],
            "aggregation": agg,
            "x_role": "dimension",
            "y_role": "measure",
            "order": order,
            "width": "half",
            "title": f"Total {measure['field_name']}",
            "semantic_reasoning": f"Single metric KPI for {measure['field_name']}",
            "chart_reasoning": "KPI card selected for single metric display",
            "aggregation_reasoning": f"{agg} applied to {measure['field_name']}",
        }
        specs.append(spec)
        order += 1

    if len(measures) >= 2:
        for i, m1 in enumerate(measures):
            for m2 in measures[i + 1:]:
                spec = {
                    "chart_type": "scatter",
                    "x_field": m1["field_name"],
                    "y_field": m2["field_name"],
                    "aggregation": m1.get("aggregation") or "SUM",
                    "x_role": "measure",
                    "y_role": "measure",
                    "order": order,
                    "width": "half",
                    "title": f"{m1['field_name']} vs {m2['field_name']}",
                    "semantic_reasoning": f"Comparing two measures: {m1['field_name']} and {m2['field_name']}",
                    "chart_reasoning": "Scatter chart selected for two-measure correlation analysis",
                    "aggregation_reasoning": f"Raw values plotted for {m1['field_name']} and {m2['field_name']}",
                }
                specs.append(spec)
                order += 1

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


def query_chart_data(chart_spec: Dict[str, Any], parquet_path: str) -> Dict[str, Any]:
    with get_duckdb() as conn:
        x_field = chart_spec["x_field"]
        y_field = chart_spec["y_field"]
        aggregation = chart_spec.get("aggregation") or "SUM"
        chart_type = chart_spec["chart_type"]
        formula = chart_spec.get("formula")

        print(f"query_chart_data: type={chart_type}, x={x_field}, y={y_field}, agg={aggregation}, formula={formula}, path={parquet_path}", flush=True)

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
                sql = f"SELECT COALESCE({value_expr()}, 0) as value FROM '{parquet_path}'"
                print(f"KPI SQL: {sql}", flush=True)
                result = conn.execute(sql).fetchone()
                val = float(result[0]) if result else 0
                print(f"KPI result: {val}", flush=True)
                return {"labels": [], "values": [val]}

            if chart_type == "pie":
                sql = f"SELECT \"{x_field}\" as label, {value_expr()} as value FROM '{parquet_path}' WHERE \"{x_field}\" IS NOT NULL GROUP BY \"{x_field}\" ORDER BY value DESC LIMIT 20"
                result = conn.execute(sql).fetchall()
                return {
                    "labels": [str(r[0]) for r in result],
                    "values": [float(r[1]) if r[1] is not None else 0 for r in result],
                }

            if chart_type == "scatter":
                sql = f"SELECT \"{x_field}\" as x, {raw_expr()} as y FROM '{parquet_path}' WHERE \"{x_field}\" IS NOT NULL AND {raw_expr()} IS NOT NULL LIMIT 1000"
                print(f"Scatter SQL: {sql}", flush=True)
                result = conn.execute(sql).fetchall()
                print(f"Scatter rows: {len(result)}", flush=True)
                return {
                    "labels": [],
                    "values": [{"x": r[0], "y": r[1]} for r in result],
                }

            sql = f"SELECT \"{x_field}\" as label, {value_expr()} as value FROM '{parquet_path}' WHERE \"{x_field}\" IS NOT NULL GROUP BY \"{x_field}\" ORDER BY value DESC LIMIT 50"
            print(f"SQL: {sql}", flush=True)
            result = conn.execute(sql).fetchall()
            print(f"Rows: {len(result)}", flush=True)
            return {
                "labels": [str(r[0]) for r in result],
                "values": [float(r[1]) if r[1] is not None else 0 for r in result],
            }
        except Exception as e:
            print(f"Query error for chart_type={chart_type}: {e}", flush=True)
            return {"labels": [], "values": []}
