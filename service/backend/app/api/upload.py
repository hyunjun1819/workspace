"""API endpoints for LoRA file upload."""

import os
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from ..config import settings
from ..services.lora_scanner import LoraScanner

router = APIRouter()

# Allowed file extensions
ALLOWED_EXTENSIONS = {'.safetensors', '.pt', '.pth', '.ckpt', '.bin'}

# Max file size: 10GB
MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024


def validate_filename(filename: str) -> bool:
    """Validate file has allowed extension."""
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS


@router.post("/upload")
async def upload_lora(
    file: UploadFile = File(...),
    base_model: Optional[str] = Form(None),
    subfolder: Optional[str] = Form(None)
):
    """
    Upload a LoRA file to the server.

    Args:
        file: The LoRA file to upload (.safetensors, .pt, .pth, .ckpt, .bin)
        base_model: Optional base model name (LTX-2, Wan2.2-T2V, etc.)
        subfolder: Optional subfolder within loras directory

    Returns:
        {
            "success": bool,
            "filename": str,
            "path": str,
            "size": int,
            "message": str
        }
    """
    # Validate filename
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다")

    if not validate_filename(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 지원: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Sanitize filename (remove path components for security)
    safe_filename = Path(file.filename).name

    # Determine destination path
    dest_dir = settings.loras_path

    if subfolder:
        # Sanitize subfolder to prevent directory traversal
        safe_subfolder = Path(subfolder).name
        dest_dir = dest_dir / safe_subfolder

    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / safe_filename

    # Check if file already exists
    if dest_path.exists():
        raise HTTPException(
            status_code=409,
            detail=f"이미 동일한 이름의 파일이 존재합니다: {safe_filename}"
        )

    try:
        # Stream file to disk (handles large files efficiently)
        total_size = 0
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    # Clean up partial file
                    buffer.close()
                    dest_path.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"파일이 너무 큽니다. 최대 10GB까지 업로드 가능합니다."
                    )
                buffer.write(chunk)

        # Trigger LoRA scan to register the new file
        scanner = LoraScanner()
        scanner.scan_all()

        return {
            "success": True,
            "filename": safe_filename,
            "path": str(dest_path),
            "size": total_size,
            "size_mb": round(total_size / (1024 * 1024), 2),
            "message": f"업로드 완료: {safe_filename}"
        }

    except HTTPException:
        raise
    except Exception as e:
        # Clean up partial file on error
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)}")


@router.get("/upload/check")
async def check_file_exists(filename: str, subfolder: Optional[str] = None):
    """
    Check if a file already exists in the loras directory.

    Args:
        filename: The filename to check
        subfolder: Optional subfolder to check in

    Returns:
        {"exists": bool, "path": str}
    """
    dest_dir = settings.loras_path

    if subfolder:
        safe_subfolder = Path(subfolder).name
        dest_dir = dest_dir / safe_subfolder

    safe_filename = Path(filename).name
    dest_path = dest_dir / safe_filename

    return {
        "exists": dest_path.exists(),
        "path": str(dest_path) if dest_path.exists() else None
    }


@router.get("/upload/disk-info")
async def get_upload_disk_info():
    """
    Get disk space information for upload destination.

    Returns:
        {
            "free_gb": float,
            "total_gb": float,
            "used_percent": float,
            "can_upload": bool
        }
    """
    import psutil

    usage = psutil.disk_usage(str(settings.loras_path))

    return {
        "free_gb": round(usage.free / (1024 ** 3), 2),
        "total_gb": round(usage.total / (1024 ** 3), 2),
        "used_percent": usage.percent,
        "can_upload": usage.free > 1024 * 1024 * 100  # At least 100MB free
    }
