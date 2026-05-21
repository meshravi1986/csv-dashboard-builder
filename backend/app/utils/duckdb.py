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
        profile = {}
        columns = conn.execute(f"SELECT column_name, column_type FROM (DESCRIBE SELECT * FROM '{parquet_path}')").fetchall()
        profile["columns"] = [{"name": c[0], "type": c[1]} for c in columns]

        row_count = conn.execute(f"SELECT COUNT(*) FROM '{parquet_path}'").fetchone()[0]
        profile["row_count"] = row_count

        fields = []
        for col in columns:
            name, dtype = col
            null_count = conn.execute(f"SELECT COUNT(*) FROM '{parquet_path}' WHERE \"{name}\" IS NULL").fetchone()[0]
            cardinality = conn.execute(f"SELECT COUNT(DISTINCT \"{name}\") FROM '{parquet_path}'").fetchone()[0]
            samples = conn.execute(f"SELECT DISTINCT \"{name}\" FROM '{parquet_path}' WHERE \"{name}\" IS NOT NULL LIMIT 5").fetchall()
            sample_values = [str(s[0]) for s in samples]

            field_info = {
                "field_name": name,
                "detected_type": dtype,
                "null_count": null_count,
                "null_percent": null_count / row_count if row_count > 0 else 0,
                "cardinality": cardinality,
                "sample_values": sample_values,
            }

            if "INT" in dtype.upper() or "FLOAT" in dtype.upper() or "DOUBLE" in dtype.upper() or "DECIMAL" in dtype.upper():
                mn = conn.execute(f"SELECT MIN(\"{name}\") FROM '{parquet_path}'").fetchone()[0]
                mx = conn.execute(f"SELECT MAX(\"{name}\") FROM '{parquet_path}'").fetchone()[0]
                mean = conn.execute(f"SELECT AVG(\"{name}\") FROM '{parquet_path}'").fetchone()[0]
                field_info["min"] = mn
                field_info["max"] = mx
                field_info["mean"] = float(mean) if mean is not None else None

            fields.append(field_info)

        profile["fields"] = fields
        return profile
