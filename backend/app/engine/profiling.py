import polars as pl
import threading
from typing import Any, Dict, List, Optional
from app.utils.duckdb import get_profile_stats

_profile_cache: Dict[str, Dict[str, Any]] = {}
_profile_in_flight: Dict[str, threading.Event] = {}
_profile_in_flight_lock = threading.Lock()


def profile_dataset(parquet_path: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
    if dataset_id and dataset_id in _profile_cache:
        return _profile_cache[dataset_id]

    if dataset_id:
        with _profile_in_flight_lock:
            if dataset_id in _profile_in_flight:
                event = _profile_in_flight[dataset_id]
                event.wait()
                if dataset_id in _profile_cache:
                    return _profile_cache[dataset_id]
            else:
                event = threading.Event()
                _profile_in_flight[dataset_id] = event

    try:
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

        if dataset_id:
            _profile_cache[dataset_id] = profile

        return profile
    finally:
        if dataset_id:
            with _profile_in_flight_lock:
                event = _profile_in_flight.pop(dataset_id, None)
            if event:
                event.set()


def clear_profile_cache(dataset_id: str):
    _profile_cache.pop(dataset_id, None)


def count_rows(parquet_path: str) -> int:
    df = pl.read_parquet(parquet_path)
    return len(df)
