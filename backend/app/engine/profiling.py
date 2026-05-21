import polars as pl
from typing import Any, Dict, List
from app.utils.duckdb import get_profile_stats


def profile_dataset(parquet_path: str) -> Dict[str, Any]:
    profile = get_profile_stats(parquet_path)

    total_nulls = sum(f.get("null_count", 0) for f in profile.get("fields", []))
    profile["total_null_cells"] = total_nulls
    profile["field_count"] = len(profile.get("fields", []))

    for field in profile.get("fields", []):
        dtype = field.get("detected_type", "").upper()
        if "INT" in dtype or "FLOAT" in dtype or "DOUBLE" in dtype or "DECIMAL" in dtype:
            field["detected_type"] = "numeric"
        elif "DATE" in dtype or "TIMESTAMP" in dtype or "DATETIME" in dtype:
            field["detected_type"] = "date"
        elif "BOOL" in dtype:
            field["detected_type"] = "boolean"
        elif "VARCHAR" in dtype or "TEXT" in dtype or "CHAR" in dtype or "STRING" in dtype:
            field["detected_type"] = "string"
        else:
            field["detected_type"] = "unknown"

        field["is_date"] = field["detected_type"] == "date"

    return profile


def count_rows(parquet_path: str) -> int:
    df = pl.read_parquet(parquet_path)
    return len(df)
