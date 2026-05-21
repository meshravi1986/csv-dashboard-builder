from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.schemas.api import UploadResponse
from app.services.upload import process_upload
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/upload", tags=["upload"])


@router.post("", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    result = await process_upload(file, user["id"])
    return result
