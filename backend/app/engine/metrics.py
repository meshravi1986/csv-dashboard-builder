import re
from typing import Any, Dict, List, Optional
from app.utils.duckdb import query_parquet, get_duckdb, safe_quote_ident


def _get_parquet_columns(parquet_path: str) -> set:
    with get_duckdb() as conn:
        cols = conn.execute(
            "SELECT column_name FROM (DESCRIBE SELECT * FROM read_parquet(?))",
            [parquet_path],
        ).fetchall()
        return {c[0] for c in cols}
