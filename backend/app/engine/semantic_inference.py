import re
from typing import Any, Dict, List, Optional, Tuple

# Column name patterns organized by business meaning
GEOGRAPHY_PATTERNS = re.compile(
    r"^(region|country|city|state|province|continent|territory|zone|district|area|location|address|"
    r"county|municipality|borough|locality|neighborhood|postal_code|zip|timezone|latitude|longitude)$",
    re.IGNORECASE,
)

IDENTIFIER_PATTERNS = re.compile(
    r"(_id$|_code$|_uuid$|^id$|^uuid$|_key$|_num$|^identifier$|^reference$|^ref$|_ref$)",
    re.IGNORECASE,
)

TIMESTAMP_PATTERNS = re.compile(
    r"^(created_at|updated_at|modified_at|deleted_at|archived_at|"
    r"processed_at|completed_at|submitted_at|requested_at|responded_at|"
    r"scheduled_at|published_at|approved_at|cancelled_at|login_at|logout_at|"
    r"created_date|modified_date|inserted_at|event_date|event_time|"
    r"timestamp|datetime|date_at|date_created|date_modified|"
    r"start_date|end_date|effective_date|expiry_date|due_date|"
    r"order_date|ship_date|transaction_date|payment_date|"
    r"transaction_time|order_time|shipping_time|delivery_time|"
    r"response_time|processing_time|arrival_time|departure_time)$",
    re.IGNORECASE,
)

# Catch-all for fields ending with _at or _time (common timestamp suffixes)
TIMESTAMP_SUFFIX_PATTERNS = re.compile(r"(_at$|_time$)", re.IGNORECASE)

CURRENCY_NAME_PATTERNS = re.compile(
    r"^(revenue|sales|amount|price|cost|expense|income|profit|salary|wage|fee|payment|budget|"
    r"spend|total|subtotal|gross|net|tax|commission|invoice|transaction_value|"
    r"premium|claim|refund|deposit|balance|credit|debit|"
    r"revenue_usd|revenue_inr|sales_amount|total_sales|net_sales|"
    r"average_price|unit_price|list_price|selling_price|purchase_price|"
    r"monthly_recurring|annual_recurring|arr|mrr|"
    r"cost_per_unit|cogs|cost_of_goods|operating_cost|overhead)$",
    re.IGNORECASE,
)

PERCENTAGE_NAME_PATTERNS = re.compile(
    r"(rate$|pct$|percent|percentage|_rate$|ratio$|margin$|yield$|"
    r"interest|tax_rate|conversion|churn_rate|growth_rate|discount|"
    r"occupancy|utilization|efficiency|retention|attrition|"
    r"probability|likelihood|prevalence|incidence|"
    r"roi|roas|cac|ltv|cpa|ctr|cvr)$",
    re.IGNORECASE,
)

RATIO_PATTERNS = re.compile(
    r"^(ratio|index|score|rating|rank|percentile|density|per_capita|per_unit|"
    r"velocity|frequency|intensity|volatility)$",
    re.IGNORECASE,
)

CATEGORICAL_PATTERNS = re.compile(
    r"^(category|type|class|segment|group|status|method|channel|department|division|"
    r"brand|model|color|size|gender|education|occupation|marital_status|"
    r"platform|source|medium|campaign|policy|plan|tier|level|phase|"
    r"stage|step|mode|sort|priority|frequency|period|interval)$",
    re.IGNORECASE,
)

TEXT_PATTERNS = re.compile(
    r"^(description|comment|note|review|feedback|summary|details|text|message|content|body|remarks|"
    r"reason|explanation|instruction|note|tag|label|title|headline|caption)$",
    re.IGNORECASE,
)

NAME_PATTERNS = re.compile(
    r"(_name$|^name$|first_name|last_name|full_name|username|display_name|customer_name|"
    r"employee_name|product_name|company_name|business_name|legal_name)",
    re.IGNORECASE,
)

COUNT_PATTERNS = re.compile(
    r"^(count|quantity|qty|volume|number_of|num_|total_|"
    r"frequency|occurrence|count_|_count$)$",
    re.IGNORECASE,
)


def _check_currency_samples(sample_values: List[str]) -> bool:
    for v in sample_values:
        v = str(v).strip()
        if v.startswith(("$", "€", "£", "¥")):
            return True
        # Match decimal values like 1234.56 (likely currency)
        if re.match(r"^-?\d{1,3}(,\d{3})*(\.\d{2})$", v):
            return True
    return False


def _check_percentage_samples(sample_values: List[str]) -> bool:
    for v in sample_values:
        v = str(v).strip()
        if v.endswith("%") or v.startswith("%"):
            return True
    return False


def _check_identifier_samples(sample_values: List[str]) -> bool:
    numeric_count = 0
    alphanum_count = 0
    for v in sample_values:
        v = str(v).strip()
        if re.match(r"^\d+$", v):
            numeric_count += 1
        elif re.match(r"^[A-Za-z0-9_-]{8,}$", v):
            alphanum_count += 1
    if len(sample_values) == 0:
        return False
    # If most samples are long alphanumeric strings, likely identifiers
    if alphanum_count >= len(sample_values) * 0.5 and max(len(str(v)) for v in sample_values) >= 8:
        return True
    return False


def infer_semantic_tags(
    field_name: str,
    sample_values: List[str],
    detected_type: str,
    cardinality: int,
    row_count: int,
) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "semantic_tags": [],
        "suggested_role": None,
        "suggested_aggregation": None,
        "suggested_formatting": None,
    }

    # -- 1. Check identifier patterns (highest priority) --
    if IDENTIFIER_PATTERNS.search(field_name) or _check_identifier_samples(sample_values):
        result["semantic_tags"].append("identifier")
        result["suggested_role"] = "dimension"
        result["suggested_aggregation"] = "COUNT_DISTINCT"
        return result

    # -- 2. Timestamp / date detection --
    is_date_type = detected_type == "date"
    is_timestamp_name = bool(TIMESTAMP_PATTERNS.fullmatch(field_name)) or bool(TIMESTAMP_SUFFIX_PATTERNS.search(field_name))
    if is_date_type or is_timestamp_name:
        result["semantic_tags"].append("timestamp")
        result["suggested_role"] = "date"
        return result

    # -- 3. Geography --
    if GEOGRAPHY_PATTERNS.fullmatch(field_name):
        result["semantic_tags"].append("geography")
        result["suggested_role"] = "dimension"
        return result

    # -- 4. Currency (by name or sample values) --
    if CURRENCY_NAME_PATTERNS.fullmatch(field_name) or _check_currency_samples(sample_values):
        result["semantic_tags"].append("currency")
        result["suggested_role"] = "measure"
        result["suggested_aggregation"] = "SUM"
        result["suggested_formatting"] = "currency"
        return result

    # -- 5. Percentage (by name or sample values) --
    if PERCENTAGE_NAME_PATTERNS.search(field_name) or _check_percentage_samples(sample_values):
        result["semantic_tags"].append("percentage")
        result["suggested_role"] = "measure"
        result["suggested_aggregation"] = "AVG"
        result["suggested_formatting"] = "percent"
        return result

    # -- 6. Ratio / score --
    if RATIO_PATTERNS.fullmatch(field_name):
        result["semantic_tags"].append("ratio")
        result["suggested_role"] = "measure"
        result["suggested_aggregation"] = "AVG"
        return result

    # -- 7. Count / quantity --
    if COUNT_PATTERNS.search(field_name):
        result["semantic_tags"].append("categorical")
        result["suggested_role"] = "measure"
        result["suggested_aggregation"] = "SUM"
        return result

    # -- 8. Name / label --
    if NAME_PATTERNS.search(field_name):
        result["semantic_tags"].append("categorical")
        result["suggested_role"] = "dimension"
        return result

    # -- 9. Categorical dimension --
    if CATEGORICAL_PATTERNS.fullmatch(field_name):
        result["semantic_tags"].append("categorical")
        result["suggested_role"] = "dimension"
        return result

    # -- 10. Text / description (likely not useful for charts) --
    if TEXT_PATTERNS.fullmatch(field_name):
        result["semantic_tags"].append("categorical")
        result["suggested_role"] = "dimension"
        return result

    # -- Fallback based on detected type --
    if detected_type == "numeric":
        # Check cardinality: high-cardinality numeric may be an ID-like field
        if cardinality > 0 and row_count > 0 and cardinality / row_count > 0.5:
            result["semantic_tags"].append("identifier")
            result["suggested_role"] = "dimension"
            result["suggested_aggregation"] = "COUNT_DISTINCT"
        else:
            result["semantic_tags"].append("categorical")
            result["suggested_role"] = "measure"
            result["suggested_aggregation"] = "SUM"
    elif detected_type == "date":
        result["semantic_tags"].append("timestamp")
        result["suggested_role"] = "date"
    elif detected_type == "boolean":
        result["semantic_tags"].append("categorical")
        result["suggested_role"] = "dimension"
    else:
        result["semantic_tags"].append("categorical")
        result["suggested_role"] = "dimension"

    return result
