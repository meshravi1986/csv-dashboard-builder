import polars as pl
import threading
from collections import OrderedDict
from typing import Any, Dict, List, Optional
from app.utils.duckdb import get_profile_stats

_cache_maxsize = 50
_profile_cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
_profile_in_flight: Dict[str, threading.Event] = {}
_profile_in_flight_lock = threading.Lock()


def _cache_set(key: str, value: Dict[str, Any]):
    global _profile_cache
    _profile_cache[key] = value
    if len(_profile_cache) > _cache_maxsize:
        _profile_cache.popitem(last=False)


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    val = _profile_cache.get(key)
    if val is not None:
        _profile_cache.move_to_end(key)
    return val


def profile_dataset(parquet_path: str, dataset_id: Optional[str] = None) -> Dict[str, Any]:
    if dataset_id and _cache_get(dataset_id):
        return _profile_cache[dataset_id]

    if dataset_id:
        with _profile_in_flight_lock:
            if dataset_id in _profile_in_flight:
                event = _profile_in_flight[dataset_id]
                event.wait()
                cached = _cache_get(dataset_id)
                if cached:
                    return cached
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
            _cache_set(dataset_id, profile)

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
    from app.utils.duckdb import get_duckdb
    with get_duckdb() as conn:
        return conn.execute("SELECT COUNT(*) FROM read_parquet(?)", [parquet_path]).fetchone()[0]
