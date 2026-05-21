from fastapi import APIRouter, Depends, HTTPException
from app.schemas.api import QueryRequest, QueryResponse
from app.utils.auth import get_current_user
from app.utils.supabase import get_supabase
from app.engine.metrics import execute_query
from app.services.upload import get_parquet_path

router = APIRouter(prefix="/api/v1/query", tags=["query"])


@router.post("", response_model=QueryResponse)
def run_query(
    request: QueryRequest,
    user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    result = supabase.table("datasets").select("*").eq("id", request.dataset_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    parquet_path = get_parquet_path(result.data[0]["parquet_path"])
    query_result = execute_query(parquet_path, request.query)

    return query_result
