"""API endpoints for LoRA download management."""

import json
import logging
import asyncio
from pathlib import Path
from typing import Dict, List
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.orm import Session
import psutil
import aiohttp

from ..database import get_db
from ..models.lora_model import LoraModel
from ..models.video_model import VideoModel
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class DownloadValidator:
    """Validates download requests."""

    def __init__(self, db: Session):
        self.db = db

    def validate(self, lora_id: int) -> Dict:
        """
        Validate if a LoRA can be downloaded.

        Returns:
            {
                "valid": bool,
                "error": str | None,
                "warnings": List[str],
                "required_files": List[Dict],
                "total_size": int
            }
        """
        lora = self.db.query(LoraModel).filter_by(id=lora_id).first()
        if not lora:
            return {"valid": False, "error": "LoRA not found"}

        warnings = []

        # Check if already downloaded
        if lora.all_files_downloaded:
            return {
                "valid": True,
                "error": None,
                "warnings": ["LoRA is already downloaded"],
                "required_files": json.loads(lora.files),
                "total_size": lora.total_size,
                "already_downloaded": True
            }

        # Check if base model is installed
        installed_models = [
            m.name for m in self.db.query(VideoModel).filter_by(is_installed=True).all()
        ]

        if lora.base_model not in installed_models:
            return {
                "valid": False,
                "error": f"Base model '{lora.base_model}' is not installed. "
                        f"Please install {lora.base_model} first."
            }

        # Check MoE file completeness
        files = json.loads(lora.files)
        if lora.requires_paired_files:
            has_high = any(f["type"] == "high_noise" for f in files)
            has_low = any(f["type"] == "low_noise" for f in files)

            if not (has_high and has_low):
                return {
                    "valid": False,
                    "error": "MoE LoRA requires both HIGH and LOW noise files."
                }

        # Check disk space
        total_size = sum(f.get("size", 0) for f in files)
        free_space = psutil.disk_usage(str(settings.loras_path)).free

        if total_size > free_space:
            return {
                "valid": False,
                "error": f"Not enough disk space. Required: {total_size / 1e9:.2f} GB, "
                        f"Available: {free_space / 1e9:.2f} GB"
            }

        if total_size > free_space * 0.9:
            warnings.append(f"Low disk space after download ({free_space / 1e9:.2f} GB available)")

        # Check which files need downloading
        files_to_download = [f for f in files if not f.get("is_downloaded", False)]

        return {
            "valid": True,
            "error": None,
            "warnings": warnings,
            "required_files": files_to_download,
            "total_size": sum(f.get("size", 0) for f in files_to_download),
            "requires_moe": lora.requires_paired_files
        }


@router.post("/loras/validate-download")
async def validate_download(lora_id: int, db: Session = Depends(get_db)):
    """
    Validate if a LoRA can be downloaded.

    Body:
        {"lora_id": int}

    Returns:
        Validation result
    """
    validator = DownloadValidator(db)
    return validator.validate(lora_id)


@router.websocket("/ws/download/{lora_id}")
async def download_lora_ws(
    websocket: WebSocket,
    lora_id: int,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for downloading LoRA with progress updates.

    Messages (Server -> Client):
        {"type": "progress", "progress": int, "message": str}
        {"type": "complete", "files": List[str]}
        {"type": "error", "error": str}
    """
    await websocket.accept()

    try:
        # Validate download
        validator = DownloadValidator(db)
        validation = validator.validate(lora_id)

        if not validation["valid"]:
            await websocket.send_json({
                "type": "error",
                "error": validation["error"]
            })
            await websocket.close()
            return

        if validation.get("already_downloaded"):
            await websocket.send_json({
                "type": "complete",
                "files": [f["path"] for f in validation["required_files"]],
                "message": "Already downloaded"
            })
            await websocket.close()
            return

        # Get LoRA
        lora = db.query(LoraModel).filter_by(id=lora_id).first()
        files = json.loads(lora.files)
        files_to_download = [f for f in files if not f.get("is_downloaded", False)]

        downloaded_files = []
        total_files = len(files_to_download)

        for idx, file_info in enumerate(files_to_download):
            try:
                # Send progress
                progress = int((idx / total_files) * 100)
                await websocket.send_json({
                    "type": "progress",
                    "progress": progress,
                    "message": f"Downloading {file_info['filename']} ({idx + 1}/{total_files})"
                })

                # Download file
                url = file_info.get("url")
                if url:
                    dest_path = settings.loras_path / file_info["filename"]
                    await download_file(url, dest_path, websocket, progress, 100 // total_files)

                    # Update file info
                    file_info["path"] = str(dest_path)
                    file_info["is_downloaded"] = True
                    downloaded_files.append(str(dest_path))

            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "error": f"Failed to download {file_info['filename']}: {str(e)}"
                })
                return

        # Update database
        lora.files = json.dumps(files)
        lora.all_files_downloaded = all(f.get("is_downloaded", False) for f in files)
        lora.download_progress = 100 if lora.all_files_downloaded else 0
        db.commit()

        # Send completion
        await websocket.send_json({
            "type": "complete",
            "files": downloaded_files,
            "message": "Download complete!"
        })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for lora_id=%d", lora_id)
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "error": str(e)
            })
        except Exception:
            logger.error("Failed to send error to client for lora_id=%d: %s", lora_id, e)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


async def download_file(url: str, dest: Path, websocket: WebSocket, base_progress: int, progress_range: int):
    """Download a single file with progress updates. Cleans up partial files on failure."""
    dest.parent.mkdir(parents=True, exist_ok=True)

    try:
        timeout = aiohttp.ClientTimeout(total=3600, connect=30)  # 1hr total, 30s connect
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as response:
                response.raise_for_status()

                total_size = int(response.headers.get("content-length", 0))
                downloaded = 0

                with open(dest, 'wb') as f:
                    async for chunk in response.content.iter_chunked(1024 * 1024):  # 1MB chunks
                        f.write(chunk)
                        downloaded += len(chunk)

                        if total_size > 0:
                            file_progress = int((downloaded / total_size) * progress_range)
                            await websocket.send_json({
                                "type": "progress",
                                "progress": base_progress + file_progress,
                                "message": f"Downloading... {downloaded / 1e6:.1f} / {total_size / 1e6:.1f} MB"
                            })
    except Exception:
        # Clean up partial file on failure
        if dest.exists():
            dest.unlink()
            logger.warning("Cleaned up partial download: %s", dest)
        raise


@router.get("/disk-space")
async def get_disk_space():
    """
    Get disk space information for the LoRA directory.

    Returns:
        {
            "total": int,
            "used": int,
            "free": int,
            "percent_used": float
        }
    """
    usage = psutil.disk_usage(str(settings.loras_path))

    return {
        "total": usage.total,
        "used": usage.used,
        "free": usage.free,
        "percent_used": usage.percent,
        "total_gb": round(usage.total / 1e9, 2),
        "used_gb": round(usage.used / 1e9, 2),
        "free_gb": round(usage.free / 1e9, 2)
    }
