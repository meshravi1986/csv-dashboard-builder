from typing import Any, Dict, List, Optional, Tuple
import duckdb
from app.utils.duckdb import get_duckdb, safe_quote_ident
from app.engine.scoring import score_chart_combination


_MAX_FILTER_CARDINALITY = 500
_MAX_FILTER_SUGGESTIONS = 15
_MAX_PIE_CATEGORIES = 20
_MAX_BAR_LABELS = 50
_MAX_SCATTER_POINTS = 1000

DETERMINISTIC_CHART_RULES = {
    ("date", "measure"): "line",
    ("dimension", "measure"): "bar",
    ("measure", "measure"): "scatter",
}


def determine_chart_type(x_role: str, y_role: str) -> str:
    return DETERMINISTIC_CHART_RULES.get((x_role, y_role), "bar")


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
                "chart_reasoning": f"Line chart selected for time-series data ({date_field['field_name']} \u2192 {measure['field_name']})",
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
                "chart_reasoning": f"Bar chart selected for categorical comparison ({dim['field_name']} \u2192 {measure['field_name']})",
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


def _insight_key(spec: Dict[str, Any]) -> tuple:
    ct = spec.get("chart_type", "")
    xf = spec.get("x_field", "")
    yf = spec.get("y_field", "")
    xr = spec.get("x_role", "")
    if ct == "scatter":
        return ("scatter_pair", xf, yf)
    if ct == "kpi":
        return ("kpi", yf)
    if xr == "date":
        return ("date_trend", yf)
    return ("dim_measure", xf, yf)


def suppress_charts(
    chart_specs: List[Dict[str, Any]],
    all_chart_data: List[Dict[str, Any]],
    profile: Optional[Dict[str, Any]],
    row_count: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    profile_map = _build_profile_map(profile)

    near_dup_groups: Dict[tuple, List[tuple]] = {}
    for idx, spec in enumerate(chart_specs):
        key = _insight_key(spec)
        score = spec.get("chart_score", 0) or 0
        near_dup_groups.setdefault(key, []).append((score, idx))

    keep_idx: set = set()
    keeper_of_group: Dict[tuple, int] = {}
    for key, entries in near_dup_groups.items():
        entries.sort(key=lambda e: -e[0])
        keeper = entries[0][1]
        keep_idx.add(keeper)
        keeper_of_group[key] = keeper
        for entry in entries[1:]:
            chart_specs[entry[1]]["duplicate_of_index"] = keeper

    for idx, (spec, data) in enumerate(zip(chart_specs, all_chart_data)):
        reasons: List[str] = []
        y_field = spec.get("y_field", "")
        x_field = spec.get("x_field", "")
        chart_type = spec.get("chart_type", "")
        labels = data.get("labels", [])
        values = data.get("values", [])

        # Rule 1: pie chart with >6 categories
        if chart_type == "pie" and len(labels) > 6:
            reasons.append(f"Pie chart has {len(labels)} categories (>6)")

        # Rule 2: label count >50
        if len(labels) > 50:
            reasons.append(f"Chart has {len(labels)} labels (>50)")

        # Rule 3: variance too low (near-constant values)
        if chart_type != "kpi" and values:
            nums = [v for v in values if isinstance(v, (int, float))]
            if len(nums) > 1:
                mean = sum(nums) / len(nums)
                if mean != 0:
                    var = sum((v - mean) ** 2 for v in nums) / len(nums)
                    cv = (var ** 0.5) / abs(mean)
                    if cv < 0.05:
                        reasons.append(f"Very low variance (cv={cv:.3f})")

        # Rule 4: y-field null % >70%
        if y_field:
            yp = profile_map.get(y_field)
            if yp and yp.get("null_percent", 0) > 0.7:
                reasons.append(f"Y-field has {yp['null_percent']*100:.0f}% nulls (>70%)")

        # Rule 5: x-field dimension cardinality too high
        if x_field and chart_type in ("bar", "line", "pie"):
            xp = profile_map.get(x_field)
            if xp:
                card = xp.get("cardinality", 0)
                if card > 0 and card / max(row_count, 1) > 0.3:
                    reasons.append(f"Dimension cardinality {card}/{row_count} is too high")

        # Rule 6: measure has mostly zero values
        if chart_type != "kpi" and values:
            nums = [v for v in values if isinstance(v, (int, float))]
            if nums:
                zero_frac = sum(1 for v in nums if v == 0) / len(nums)
                if zero_frac > 0.8:
                    reasons.append(f"{sum(1 for v in nums if v == 0)}/{len(nums)} values are zero (>80%)")

        # Rule 7: near-duplicate insight
        if idx not in keep_idx:
            spec["duplicate_of_index"] = keeper_of_group.get(_insight_key(spec))
            reasons.append("Near-duplicate insight (same measure+dimension as higher-scored chart)")

        spec["_suppressed"] = len(reasons) > 0
        if reasons:
            spec["suppression_reason"] = "; ".join(reasons)

    return chart_specs, all_chart_data


def _interleave_types(charts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_type: Dict[str, List[Dict[str, Any]]] = {}
    for c in charts:
        by_type.setdefault(c["chart_type"], []).append(c)
    types = sorted(by_type, key=lambda t: len(by_type[t]), reverse=True)
    result = []
    while any(by_type.values()):
        for t in types:
            if by_type[t]:
                result.append(by_type[t].pop(0))
    return result


def layout_dashboard(chart_specs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    for s in chart_specs:
        ct = s.get("chart_type", "")
        if ct == "kpi":
            s["layout_group"] = "kpi"
            s["layout_priority"] = 1
            s["recommended_size"] = "quarter"
            s["width"] = "half"
        elif s.get("x_role") == "date" and s.get("y_role") == "measure":
            s["layout_group"] = "trend"
            s["layout_priority"] = 2
        elif ct == "scatter":
            s["layout_group"] = "scatter"
            s["layout_priority"] = 4
        else:
            s["layout_group"] = "comparison"
            s["layout_priority"] = 3

    kpis = [s for s in chart_specs if s.get("chart_type") == "kpi"][:4]
    non_kpis = [s for s in chart_specs if s.get("chart_type") != "kpi"]

    non_kpis.sort(key=lambda s: (s["layout_priority"], -(s.get("chart_score", 50) or 50)))
    non_kpis = non_kpis[:6]

    interleaved: List[Dict[str, Any]] = []
    for priority in range(2, 5):
        group = [s for s in non_kpis if s["layout_priority"] == priority]
        if group:
            interleaved.extend(_interleave_types(group))

    ordered: List[Dict[str, Any]] = []
    i = 0
    while i < len(interleaved):
        remaining = len(interleaved) - i
        current = interleaved[i]

        if remaining == 1:
            current["width"] = "full"
            current["recommended_size"] = "full"
            ordered.append(current)
            i += 1
            continue

        nxt = interleaved[i + 1]

        if current["chart_type"] == nxt["chart_type"] and remaining >= 3:
            current["width"] = "full"
            current["recommended_size"] = "full"
            ordered.append(current)
            i += 1
        else:
            current["width"] = "half"
            nxt["width"] = "half"
            current["recommended_size"] = "half"
            nxt["recommended_size"] = "half"
            ordered.append(current)
            ordered.append(nxt)
            i += 2

    result = kpis + ordered
    for idx, s in enumerate(result):
        s["order"] = idx

    return result


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


def _build_filter_sql(filters: Optional[Dict[str, Any]] = None) -> tuple[str, list]:
    if not filters:
        return "", []
    conditions = []
    params: list = []
    param_idx = 1
    for field_name, fdef in filters.items():
        q_field = safe_quote_ident(field_name)
        if fdef.get("type") == "dimension" and fdef.get("values"):
            vals = fdef["values"]
            placeholders = ",".join([f"${param_idx + i}" for i in range(len(vals))])
            conditions.append(f"{q_field} IN ({placeholders})")
            params.extend(vals)
            param_idx += len(vals)
        elif fdef.get("type") == "date":
            start = fdef.get("start")
            end = fdef.get("end")
            if start and end:
                conditions.append(f"{q_field} BETWEEN ${param_idx} AND ${param_idx + 1}")
                params.extend([start, end])
                param_idx += 2
            elif start:
                conditions.append(f"{q_field} >= ${param_idx}")
                params.append(start)
                param_idx += 1
            elif end:
                conditions.append(f"{q_field} <= ${param_idx}")
                params.append(end)
                param_idx += 1
    if not conditions:
        return "", []
    return " AND " + " AND ".join(conditions), params


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

    filter_sql, filter_params = _build_filter_sql(filters)
    params: list = [parquet_path]

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
        return agg_fn(safe_quote_ident(y_field))

    def raw_expr():
        if formula:
            return formula
        if y_field:
            return safe_quote_ident(y_field)
        return "0"

    quoted_x = safe_quote_ident(x_field) if x_field else ""

    try:
        if chart_type == "kpi":
            sql = f"SELECT COALESCE({value_expr()}, 0) as value FROM read_parquet($1)"
            params.extend(filter_params)
            if filter_sql:
                sql += " WHERE 1=1" + filter_sql
            result = conn.execute(sql, params).fetchone()
            val = float(result[0]) if result else 0
            return {"labels": [], "values": [val]}

        if chart_type == "pie":
            sql = f"SELECT {quoted_x} as label, {value_expr()} as value FROM read_parquet($1) WHERE {quoted_x} IS NOT NULL{filter_sql} GROUP BY {quoted_x} ORDER BY value DESC LIMIT {_MAX_PIE_CATEGORIES}"
            params.extend(filter_params)
            result = conn.execute(sql, params).fetchall()
            return {
                "labels": [str(r[0]) for r in result],
                "values": [float(r[1]) if r[1] is not None else 0 for r in result],
            }

        if chart_type == "scatter":
            rex = raw_expr()
            sql = f"SELECT {quoted_x} as x, {rex} as y FROM read_parquet($1) WHERE {quoted_x} IS NOT NULL AND {rex} IS NOT NULL{filter_sql} LIMIT {_MAX_SCATTER_POINTS}"
            params.extend(filter_params)
            result = conn.execute(sql, params).fetchall()
            return {
                "labels": [],
                "values": [{"x": r[0], "y": r[1]} for r in result],
            }

        sql = f"SELECT {quoted_x} as label, {value_expr()} as value FROM read_parquet($1) WHERE {quoted_x} IS NOT NULL{filter_sql} GROUP BY {quoted_x} ORDER BY value DESC LIMIT {_MAX_BAR_LABELS}"
        params.extend(filter_params)
        result = conn.execute(sql, params).fetchall()
        return {
            "labels": [str(r[0]) for r in result],
            "values": [float(r[1]) if r[1] is not None else 0 for r in result],
        }
    except Exception as e:
        print(f"Query error for chart_type={chart_type}, filters={filters}: {e}", flush=True)
        return {"labels": [], "values": []}
