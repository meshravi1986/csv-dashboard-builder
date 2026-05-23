import duckdb
import os
from pathlib import Path
from typing import Any, List, Dict
from contextlib import contextmanager


@contextmanager
def get_duckdb():
    conn = duckdb.connect(":memory:")
    try:
        conn.execute("INSTALL parquet; LOAD parquet;")
        yield conn
    finally:
        conn.close()


def query_parquet(parquet_path: str, aggregation: str, field: str, group_by: str | None = None) -> List[Dict[str, Any]]:
    with get_duckdb() as conn:
        if group_by:
            query = f"SELECT {group_by}, {aggregation}({field}) as value FROM '{parquet_path}' GROUP BY {group_by} ORDER BY {group_by}"
        else:
            query = f"SELECT {aggregation}({field}) as value FROM '{parquet_path}'"
        result = conn.execute(query).fetchall()
        columns = [desc[0] for desc in conn.description]
        return [dict(zip(columns, row)) for row in result]


def get_profile_stats(parquet_path: str) -> Dict[str, Any]:
    with get_duckdb() as conn:
        columns = conn.execute(
            f"SELECT column_name, column_type FROM (DESCRIBE SELECT * FROM '{parquet_path}')"
        ).fetchall()
        col_list = [{"name": c[0], "type": c[1]} for c in columns]

        row_count = conn.execute(
            f"SELECT COUNT(*) FROM '{parquet_path}'"
        ).fetchone()[0]

        # Single-pass SUMMARIZE for all columns: min, max, approx_unique, avg, count, null_percentage
        summary_rows = conn.execute(
            f"SELECT column_name, column_type, min, max, approx_unique, avg, count, null_percentage FROM (SUMMARIZE SELECT * FROM '{parquet_path}')"
        ).fetchall()
        summary_map = {}
        for sr in summary_rows:
            summary_map[sr[0]] = {
                "column_type": sr[1],
                "min": sr[2],
                "max": sr[3],
                "approx_unique": sr[4],
                "avg": sr[5],
                "non_null_count": sr[6],
                "null_percentage": sr[7],
            }

        fields = []
        for col_name, col_type in columns:
            s = summary_map.get(col_name, {})
            non_null = s.get("non_null_count", 0)
            null_count = max(0, row_count - non_null)
            null_percent = null_count / row_count if row_count > 0 else 0

            samples = conn.execute(
                f"SELECT DISTINCT \"{col_name}\" FROM '{parquet_path}' WHERE \"{col_name}\" IS NOT NULL LIMIT 5"
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

            fields.append(field_info)

        return {
            "columns": col_list,
            "row_count": row_count,
            "fields": fields,
        }
