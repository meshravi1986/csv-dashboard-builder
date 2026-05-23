import re
from typing import Any, Dict, List, Optional

ID_PATTERNS = re.compile(r"(_id$|_code$|_uuid$|^id$|^uuid$)", re.IGNORECASE)

CHART_SCORE_THRESHOLD = 45


def score_chart_combination(
    x_field: Optional[str],
    y_field: str,
    chart_type: str,
    x_profile: Optional[Dict[str, Any]],
    y_profile: Optional[Dict[str, Any]],
    row_count: int,
) -> Dict[str, Any]:
    reasons: List[str] = []
    score = 50

    # -- Penalties --

    if y_field and ID_PATTERNS.search(y_field):
        score -= 40
        reasons.append(f"Y-field '{y_field}' appears to be an ID (-40)")

    if x_field and ID_PATTERNS.search(x_field):
        score -= 25
        reasons.append(f"X-field '{x_field}' appears to be an ID (-25)")

    y_nulls = y_profile.get("null_percent", 0) if y_profile else 0
    x_nulls = x_profile.get("null_percent", 0) if x_profile else 0

    if y_nulls > 0.5:
        score -= 30
        reasons.append(f"Y-field '{y_field}' is >50% nulls (-30)")

    if x_nulls > 0.5:
        score -= 20
        reasons.append(f"X-field '{x_field}' is >50% nulls (-20)")

    y_card = y_profile.get("cardinality", 0) if y_profile else 0
    if y_card <= 1:
        score -= 50
        reasons.append(f"Y-field '{y_field}' is constant (cardinality={y_card}) (-50)")

    x_card = x_profile.get("cardinality", 0) if x_profile else 0
    if x_field and x_card > 0:
        ratio = x_card / max(row_count, 1)
        if ratio > 0.3:
            score -= 20
            reasons.append(f"X-field '{x_field}' is too granular ({x_card} / {row_count} rows) (-20)")
        elif ratio > 0.1:
            score -= 10
            reasons.append(f"X-field '{x_field}' has high cardinality ({x_card} / {row_count} rows) (-10)")

    if x_field and x_card <= 1:
        score -= 15
        reasons.append(f"X-field '{x_field}' has only one distinct value (-15)")

    # -- Bonuses --

    if x_profile and x_profile.get("is_date") and chart_type == "line":
        score += 30
        reasons.append("Time-series trend (date x measure) (+30)")

    if x_profile and not x_profile.get("is_date") and 3 <= x_card <= 15:
        score += 20
        reasons.append(f"Sweet-spot cardinality {int(x_card)} for dimension '{x_field}' (+20)")
    elif x_profile and not x_profile.get("is_date") and 2 <= x_card <= 3:
        score += 10
        reasons.append(f"Low cardinality {int(x_card)} for dimension '{x_field}' (+10)")

    try:
        y_std = float(y_profile.get("std")) if y_profile and y_profile.get("std") is not None else None
        y_mean = float(y_profile.get("mean")) if y_profile and y_profile.get("mean") is not None else None
    except (TypeError, ValueError):
        y_std = y_mean = None
    if y_std is not None and y_mean is not None and y_mean != 0:
        cv = abs(y_std / y_mean)
        if cv > 0.5:
            score += 15
            reasons.append(f"High-variance measure (std/mean={cv:.2f}) (+15)")
        elif cv > 0.2:
            score += 8
            reasons.append(f"Good-variance measure (std/mean={cv:.2f}) (+8)")

    if y_nulls < 0.01:
        score += 5
        reasons.append("Complete data (<1% nulls) (+5)")

    if chart_type == "kpi" and y_field:
        score += 10
        reasons.append("KPI single-metric card (+10)")

    if chart_type == "scatter":
        try:
            x_std = float(x_profile.get("std")) if x_profile and x_profile.get("std") is not None else None
        except (TypeError, ValueError):
            x_std = None
        if y_std is not None and x_std is not None:
            score += 10
            reasons.append("Scatter with two varying measures (+10)")

    score = max(0, min(100, score))

    return {
        "chart_score": score,
        "score_reasons": reasons,
        "should_render": score >= CHART_SCORE_THRESHOLD,
    }
