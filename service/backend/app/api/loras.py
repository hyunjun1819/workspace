"""API endpoints for LoRA management."""

import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from ..models.lora_model import LoraModel
from ..models.video_model import VideoModel
from ..services.lora_scanner import LoraScanner

logger = logging.getLogger(__name__)

router = APIRouter()


def _safe_json_loads(value: str, default=None, field_name: str = "unknown"):
    """Safely parse JSON from database fields, returning default on error."""
    if not value:
        return default if default is not None else []
    try:
        return json.loads(value)
    except json.JSONDecodeError as e:
        logger.warning("Corrupt JSON in field '%s': %s", field_name, e)
        return default if default is not None else []


@router.get("/scan")
async def scan_loras(db: Session = Depends(get_db)):
    """
    Scan filesystem for video LoRA files and update database.

    Returns:
        {
            "scanned": int,
            "new": int,
            "updated": int
        }
    """
    scanner = LoraScanner()
    scanned_loras = scanner.scan_all()

    new_count = 0
    updated_count = 0

    try:
        for lora_data in scanned_loras:
            # Check if LoRA already exists by name and base_model
            existing = db.query(LoraModel).filter_by(
                name=lora_data["name"],
                base_model=lora_data["base_model"]
            ).first()

            if existing:
                # Update existing LoRA, but preserve custom description
                existing_desc = existing.description
                for key, value in lora_data.items():
                    # Skip description if it's a default value and we have a custom one
                    if key == "description":
                        default_descs = [
                            f"LoRA for {lora_data.get('base_model', '')}",
                            f"MoE LoRA for {lora_data.get('base_model', '')}",
                        ]
                        if value in default_descs and existing_desc not in default_descs:
                            continue  # Keep existing custom description
                    setattr(existing, key, value)
                updated_count += 1
            else:
                # Create new LoRA
                lora = LoraModel(**lora_data)
                db.add(lora)
                new_count += 1

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    return {
        "scanned": len(scanned_loras),
        "new": new_count,
        "updated": updated_count
    }


@router.get("")
async def get_loras(
    base_model: Optional[str] = None,
    task_type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    downloaded: Optional[bool] = None,
    sort: str = Query("name", regex="^(name|downloads|rating|created_at)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Get list of LoRAs with filtering and pagination.

    Query Parameters:
        base_model: Filter by base model (LTX-2, Wan2.2-T2V, Wan2.2-I2V)
        task_type: Filter by task type (T2V, I2V, BOTH)
        category: Filter by category (lightning, distilled, camera, etc.)
        search: Search in name and description
        downloaded: Filter by download status
        sort: Sort field (name, downloads, rating, created_at)
        page: Page number (1-based)
        limit: Items per page

    Returns:
        {
            "loras": [...],
            "total": int,
            "page": int,
            "total_pages": int
        }
    """
    query = db.query(LoraModel)

    # Apply filters
    if base_model:
        query = query.filter(LoraModel.base_model == base_model)

    if task_type:
        if task_type == "BOTH":
            query = query.filter(LoraModel.task_type == "BOTH")
        else:
            query = query.filter(
                or_(LoraModel.task_type == task_type, LoraModel.task_type == "BOTH")
            )

    if category:
        query = query.filter(LoraModel.category == category)

    if search:
        query = query.filter(
            or_(
                LoraModel.name.ilike(f"%{search}%"),
                LoraModel.description.ilike(f"%{search}%")
            )
        )

    if downloaded is not None:
        query = query.filter(LoraModel.all_files_downloaded == downloaded)

    # Apply sorting
    if sort == "downloads":
        query = query.order_by(LoraModel.downloads.desc())
    elif sort == "rating":
        query = query.order_by(LoraModel.rating.desc())
    elif sort == "created_at":
        query = query.order_by(LoraModel.created_at.desc())
    else:
        query = query.order_by(LoraModel.name)

    # Get total count
    total = query.count()

    # Apply pagination
    loras = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "loras": [
            {
                "id": l.id,
                "name": l.name,
                "description": l.description,
                "base_model": l.base_model,
                "task_type": l.task_type,
                "category": l.category,
                "is_moe": l.is_moe,
                "files": _safe_json_loads(l.files, [], f"lora[{l.id}].files"),
                "total_size": l.total_size,
                "trigger_words": _safe_json_loads(l.trigger_words, [], f"lora[{l.id}].trigger_words"),
                "recommended_strength": l.recommended_strength,
                "sample_video": l.sample_video,
                "thumbnail": l.thumbnail,
                "downloads": l.downloads,
                "rating": l.rating,
                "all_files_downloaded": l.all_files_downloaded,
                "download_progress": l.download_progress
            }
            for l in loras
        ],
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1
    }


@router.get("/stats")
async def get_lora_stats(db: Session = Depends(get_db)):
    """
    Get statistics about LoRAs.

    Returns:
        {
            "total": int,
            "by_model": {...},
            "by_category": {...},
            "downloaded": int
        }
    """
    all_loras = db.query(LoraModel).all()

    by_model = {}
    by_category = {}
    downloaded = 0

    for lora in all_loras:
        # Count by model
        model = lora.base_model
        by_model[model] = by_model.get(model, 0) + 1

        # Count by category
        cat = lora.category
        by_category[cat] = by_category.get(cat, 0) + 1

        # Count downloaded
        if lora.all_files_downloaded:
            downloaded += 1

    return {
        "total": len(all_loras),
        "by_model": by_model,
        "by_category": by_category,
        "downloaded": downloaded,
        "moe_count": sum(1 for l in all_loras if l.is_moe)
    }


@router.get("/{lora_id}")
async def get_lora_detail(lora_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific LoRA.

    Args:
        lora_id: LoRA database ID

    Returns:
        LoRA details
    """
    lora = db.query(LoraModel).filter_by(id=lora_id).first()

    if not lora:
        raise HTTPException(status_code=404, detail="LoRA not found")

    return {
        "id": lora.id,
        "name": lora.name,
        "description": lora.description,
        "base_model": lora.base_model,
        "task_type": lora.task_type,
        "category": lora.category,
        "is_moe": lora.is_moe,
        "requires_paired_files": lora.requires_paired_files,
        "files": _safe_json_loads(lora.files, [], "lora.files"),
        "total_size": lora.total_size,
        "trigger_words": _safe_json_loads(lora.trigger_words, [], "lora.trigger_words"),
        "recommended_strength": lora.recommended_strength,
        "sample_video": lora.sample_video,
        "thumbnail": lora.thumbnail,
        "settings": _safe_json_loads(lora.settings, {}, "lora.settings"),
        "downloads": lora.downloads,
        "rating": lora.rating,
        "source": lora.source,
        "source_url": lora.source_url,
        "author": lora.author,
        "all_files_downloaded": lora.all_files_downloaded,
        "download_progress": lora.download_progress,
        "created_at": lora.created_at.isoformat() if lora.created_at else None,
        "updated_at": lora.updated_at.isoformat() if lora.updated_at else None
    }


@router.delete("/{lora_id}")
async def delete_lora(lora_id: int, delete_files: bool = False, db: Session = Depends(get_db)):
    """
    Delete a LoRA from the database (optionally delete files).

    Args:
        lora_id: LoRA database ID
        delete_files: If True, also delete the actual files

    Returns:
        Deletion result
    """
    from pathlib import Path
    from ..config import settings

    lora = db.query(LoraModel).filter_by(id=lora_id).first()

    if not lora:
        raise HTTPException(status_code=404, detail="LoRA not found")

    deleted_files = []

    if delete_files:
        files = json.loads(lora.files)
        loras_root = settings.loras_path.resolve()
        for file_info in files:
            file_path = Path(file_info.get("path", "")).resolve()
            # Only allow deletion within the loras directory
            if not file_path.is_relative_to(loras_root):
                continue
            if file_path.exists():
                file_path.unlink()
                deleted_files.append(str(file_path))

    # Delete from database
    db.delete(lora)
    db.commit()

    return {
        "success": True,
        "deleted_id": lora_id,
        "deleted_files": deleted_files
    }
