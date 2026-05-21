from typing import Any, Dict, List, Optional
from app.utils.duckdb import query_parquet, get_duckdb


def compute_metric(
    parquet_path: str,
    aggregation: str,
    field_name: str,
    group_by: Optional[str] = None,
    formula: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if formula:
        return compute_formula_metric(parquet_path, formula, group_by)
    return query_parquet(parquet_path, aggregation, field_name, group_by)


def compute_formula_metric(
    parquet_path: str,
    formula: str,
    group_by: Optional[str] = None,
) -> List[Dict[str, Any]]:
    with get_duckdb() as conn:
        fields = formula.replace(" ", "").split("+") if "+" in formula else \
                 formula.replace(" ", "").split("-") if "-" in formula else \
                 formula.replace(" ", "").split("*") if "*" in formula else \
                 formula.replace(" ", "").split("/") if "/" in formula else [formula]
        if group_by:
            select_parts = [f"\"{group_by}\""]
            for f in fields:
                select_parts.append(f"SUM(\"{f}\")")
            select_clause = ", ".join(select_parts)
            sql = f"SELECT {select_clause} FROM '{parquet_path}' GROUP BY \"{group_by}\""
        else:
            select_parts = []
            for f in fields:
                select_parts.append(f"SUM(\"{f}\")")
            select_clause = ", ".join(select_parts)
            sql = f"SELECT {select_clause} FROM '{parquet_path}'"
        result = conn.execute(sql).fetchall()
        columns = [desc[0] for desc in conn.description]
        return [dict(zip(columns, row)) for row in result]


def execute_query(parquet_path: str, sql: str) -> Dict[str, Any]:
    with get_duckdb() as conn:
        full_sql = sql.replace(":parquet_path", f"'{parquet_path}'")
        result = conn.execute(full_sql).fetchall()
        columns = [desc[0] for desc in conn.description]
        rows = [list(r) for r in result]
        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
        }
