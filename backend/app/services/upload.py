import os
import uuid
import threading
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


async def process_upload(file: UploadFile, user_id: str) -> dict:
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    temp_path = TEMP_DIR / f"{uuid.uuid4()}_{file.filename}"
    parquet_temp = TEMP_DIR / f"{uuid.uuid4()}.parquet"

    try:
        content = await file.read()
        temp_path.write_bytes(content)

        df = pl.read_csv(str(temp_path))
        row_count = len(df)
        column_count = len(df.columns)

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
                ds_result = supabase.table("datasets").select("parquet_path, name").eq("id", ds_id).execute()
                if not ds_result.data:
                    continue
                other_path = get_parquet_path(ds_result.data[0]["parquet_path"])
                if not other_path:
                    continue
                other_df = pl.read_parquet(other_path)
                other_cols = set(c.lower() for c in other_df.columns)
                if current_cols == other_cols:
                    vgid = d.get("version_group_id") or d["id"]
                    column_match = {
                        "dashboard_id": d["id"],
                        "dashboard_title": d["title"],
                        "dataset_id": ds_id,
                        "dataset_name": ds_result.data[0].get("name", ""),
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
