import re
import duckdb
import queue
import threading
from pathlib import Path
from typing import Any, List, Dict, Optional
from contextlib import contextmanager


_COLUMN_NAME_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_ \-\.\(\)\[\]]*$')

_POOL_SIZE = 4
_connection_pool: queue.Queue = queue.Queue()
_pool_lock = threading.Lock()
_pool_initialized = False


def validate_column_name(name: str) -> bool:
    return bool(_COLUMN_NAME_RE.match(name))


def safe_quote_ident(name: str) -> str:
    escaped = name.replace('"', '""')
    return f'"{escaped}"'


def _init_pool():
    global _pool_initialized
    if _pool_initialized:
        return
    with _pool_lock:
        if _pool_initialized:
            return
        for _ in range(_POOL_SIZE):
            conn = duckdb.connect(":memory:")
            conn.execute("INSTALL parquet; LOAD parquet;")
            _connection_pool.put(conn)
        _pool_initialized = True


@contextmanager
def get_duckdb():
    _init_pool()
    try:
        conn = _connection_pool.get(timeout=5.0)
        yield conn
    finally:
        _connection_pool.put(conn)


_VALID_AGGS = {"SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"}


def query_parquet(parquet_path: str, aggregation: str, field: str, group_by: Optional[str] = None) -> List[Dict[str, Any]]:
    if aggregation not in _VALID_AGGS:
        aggregation = "SUM"
    with get_duckdb() as conn:
        quoted_field = safe_quote_ident(field)
        if group_by:
            quoted_gb = safe_quote_ident(group_by)
            query = f"SELECT {quoted_gb}, {aggregation}({quoted_field}) as value FROM read_parquet(?) GROUP BY {quoted_gb} ORDER BY {quoted_gb}"
        else:
            query = f"SELECT {aggregation}({quoted_field}) as value FROM read_parquet(?)"
        result = conn.execute(query, [parquet_path]).fetchall()
        columns = [desc[0] for desc in conn.description]
        return [dict(zip(columns, row)) for row in result]


def get_profile_stats(parquet_path: str) -> Dict[str, Any]:
    with get_duckdb() as conn:
        columns = conn.execute(
            "SELECT column_name, column_type FROM (DESCRIBE SELECT * FROM read_parquet(?))",
            [parquet_path],
        ).fetchall()
        col_list = [{"name": c[0], "type": c[1]} for c in columns]

        row_count = conn.execute(
            "SELECT COUNT(*) FROM read_parquet(?)",
            [parquet_path],
        ).fetchone()[0]

        # Single-pass SUMMARIZE for all columns
        summary_rows = conn.execute(
            "SELECT column_name, column_type, min, max, approx_unique, avg, std, count, null_percentage FROM (SUMMARIZE SELECT * FROM read_parquet(?))",
            [parquet_path],
        ).fetchall()
        summary_map = {}
        for sr in summary_rows:
            summary_map[sr[0]] = {
                "column_type": sr[1],
                "min": sr[2],
                "max": sr[3],
                "approx_unique": sr[4],
                "avg": sr[5],
                "std": sr[6],
                "non_null_count": sr[7],
                "null_percentage": sr[8],
            }

        fields = []
        for col_name, col_type in columns:
            s = summary_map.get(col_name, {})
            non_null = s.get("non_null_count", 0)
            null_count = max(0, row_count - non_null)
            null_percent = null_count / row_count if row_count > 0 else 0

            quoted = safe_quote_ident(col_name)
            samples = conn.execute(
                f"SELECT DISTINCT {quoted} FROM read_parquet(?) WHERE {quoted} IS NOT NULL LIMIT 5",
                [parquet_path],
            ).fetchall()
            sample_values = [str(sv[0]) for sv in samples]

            field_info = {
                "field_name": col_name,
                "detected_type": col_type,
                "null_count": null_count,
                "null_percent": null_percent,
                "cardinality": s.get("approx_unique", 0) or 0,
                "sample_values": sample_values,
            }

            if "INT" in col_type.upper() or "FLOAT" in col_type.upper() or "DOUBLE" in col_type.upper() or "DECIMAL" in col_type.upper():
                field_info["min"] = s.get("min")
                field_info["max"] = s.get("max")
                field_info["mean"] = s.get("avg")
                field_info["std"] = s.get("std")

            fields.append(field_info)

        return {
            "columns": col_list,
            "row_count": row_count,
            "fields": fields,
        }
