import os
import json
import uuid
import threading
from typing import Optional
import polars as pl
from pathlib import Path
from fastapi import UploadFile, HTTPException
from app.utils.supabase import get_supabase, get_supabase_storage
from app.config import settings
from app.engine.profiling import count_rows


_download_locks: dict[str, threading.Lock] = {}
_download_lock_lock = threading.Lock()


TEMP_DIR = Path(__file__).parent.parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)


MAX_FILE_SIZE = settings.max_upload_size_mb * 1024 * 1024
MAX_COLUMNS = settings.max_csv_columns


async def process_upload(file: UploadFile, user_id: str) -> dict:
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    temp_path = TEMP_DIR / f"{uuid.uuid4()}_{file.filename}"
    parquet_temp = TEMP_DIR / f"{uuid.uuid4()}.parquet"

    try:
        content = await file.read()

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds {settings.max_upload_size_mb}MB limit",
            )

        # Basic CSV content validation: must contain comma-separated values
        try:
            header_line = content.decode("utf-8").split("\n")[0].strip()
            if not header_line or "," not in header_line:
                raise HTTPException(status_code=400, detail="File does not appear to be a valid CSV (no comma-separated header found)")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File encoding is not valid UTF-8")

        temp_path.write_bytes(content)

        df = pl.read_csv(str(temp_path))
        row_count = len(df)
        column_count = len(df.columns)

        if column_count > MAX_COLUMNS:
            raise HTTPException(
                status_code=400,
                detail=f"CSV has {column_count} columns, exceeds the maximum of {MAX_COLUMNS}",
            )

        parquet_filename = f"{user_id}/{uuid.uuid4()}.parquet"
        df.write_parquet(str(parquet_temp))

        storage = get_supabase_storage()
        with open(str(parquet_temp), "rb") as f:
            storage.upload(
                path=parquet_filename,
                file=f,
                file_options={"content-type": "application/octet-stream"},
            )

        supabase = get_supabase()
        dataset_id = str(uuid.uuid4())
        dataset_data = {
            "id": dataset_id,
            "user_id": user_id,
            "name": Path(file.filename).stem,
            "original_filename": file.filename,
            "parquet_path": parquet_filename,
            "row_count": row_count,
            "column_count": column_count,
            "file_size": len(content),
            "status": "uploaded",
            "columns": json.dumps(list(df.columns)),
        }

        supabase.table("datasets").insert(dataset_data).execute()

        # Check if uploaded columns match any existing dashboard's dataset
        column_match = None
        try:
            current_cols = set(c.lower() for c in df.columns)
            existing_dashboards = supabase.table("dashboards").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
            seen_datasets = set()
            for d in existing_dashboards.data:
                ds_id = d.get("dataset_id")
                if not ds_id or ds_id in seen_datasets:
                    continue
                seen_datasets.add(ds_id)
                other_cols = get_dataset_columns(ds_id, supabase)
                if other_cols is None:
                    continue
                if current_cols == other_cols:
                    ds_name = ""
                    try:
                        ds_result = supabase.table("datasets").select("name").eq("id", ds_id).execute()
                        if ds_result.data:
                            ds_name = ds_result.data[0].get("name", "")
                    except Exception:
                        pass
                    vgid = d.get("version_group_id") or d["id"]
                    column_match = {
                        "dashboard_id": d["id"],
                        "dashboard_title": d["title"],
                        "dataset_id": ds_id,
                        "dataset_name": ds_name,
                        "version_group_id": vgid,
                        "version_number": d.get("version_number") or 1,
                    }
                    break
        except Exception:
            pass

        return {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "row_count": row_count,
            "column_count": column_count,
            "column_match": column_match,
        }

    except pl.exceptions.PolarsError as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    finally:
        if temp_path.exists():
            temp_path.unlink()
        if parquet_temp.exists():
            parquet_temp.unlink()


def get_parquet_path(parquet_storage_path: str) -> str:
    temp_path = TEMP_DIR / Path(parquet_storage_path).name
    if temp_path.exists() and temp_path.stat().st_size > 0:
        return str(temp_path)

    # Per-path lock prevents concurrent downloads of the same file
    with _download_lock_lock:
        if parquet_storage_path not in _download_locks:
            _download_locks[parquet_storage_path] = threading.Lock()
        lock = _download_locks[parquet_storage_path]

    with lock:
        # Double-check after acquiring lock (another thread may have just finished)
        if temp_path.exists() and temp_path.stat().st_size > 0:
            return str(temp_path)
        try:
            storage = get_supabase_storage()
            data = storage.download(parquet_storage_path)
            temp_path.write_bytes(data)
            if temp_path.stat().st_size == 0:
                raise ValueError("Downloaded empty file")
        except Exception as e:
            if temp_path.exists():
                temp_path.unlink()
            raise HTTPException(status_code=500, detail=f"Failed to load dataset: {str(e)}")
    return str(temp_path)


def get_dataset_columns(dataset_id: str, supabase) -> Optional[set]:
    """Get column names for a dataset from DB (fast) or parquet schema (fallback)."""
    try:
        ds = supabase.table("datasets").select("columns, parquet_path").eq("id", dataset_id).execute()
        if ds.data and ds.data[0].get("columns"):
            return set(c.lower() for c in json.loads(ds.data[0]["columns"]))
        if ds.data:
            parquet_path = get_parquet_path(ds.data[0]["parquet_path"])
            if parquet_path:
                import polars as pl
                schema = pl.read_parquet_schema(parquet_path)
                return set(c.lower() for c in schema.keys())
    except Exception:
        pass
    return None
