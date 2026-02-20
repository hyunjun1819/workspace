"""API endpoints for video model management."""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.video_model import VideoModel
from ..services.model_detector import VideoModelDetector

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


@router.get("/detect")
async def detect_models(db: Session = Depends(get_db)):
    """
    Detect installed video models and save to database.

    Returns:
        {
            "detected_models": [...],
            "total": int
        }
    """
    detector = VideoModelDetector()
    detected = detector.detect_all()

    # Save to database
    try:
        for model_data in detected:
            existing = db.query(VideoModel).filter_by(name=model_data["name"]).first()

            if existing:
                # Update existing model
                for key, value in model_data.items():
                    setattr(existing, key, value)
            else:
                # Create new model
                model = VideoModel(**model_data)
                db.add(model)

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    # Return detected models
    return {
        "detected_models": [
            {
                "name": m["name"],
                "display_name": m["display_name"],
                "supports_t2v": m["supports_t2v"],
                "supports_i2v": m["supports_i2v"],
                "is_moe": m["is_moe"],
                "is_complete": m["is_complete"]
            }
            for m in detected
        ],
        "total": len(detected)
    }


@router.get("/installed")
async def get_installed_models(db: Session = Depends(get_db)):
    """
    Get list of installed video models.

    Returns:
        {
            "models": [...]
        }
    """
    models = db.query(VideoModel).filter_by(is_installed=True).all()

    return {
        "models": [
            {
                "id": m.id,
                "name": m.name,
                "display_name": m.display_name,
                "supports_t2v": m.supports_t2v,
                "supports_i2v": m.supports_i2v,
                "t2v_categories": _safe_json_loads(m.t2v_categories, [], f"model[{m.name}].t2v_categories"),
                "i2v_categories": _safe_json_loads(m.i2v_categories, [], f"model[{m.name}].i2v_categories"),
                "is_moe": m.is_moe,
                "is_complete": m.is_complete
            }
            for m in models
        ]
    }


@router.get("/{model_name}")
async def get_model_detail(model_name: str, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific model.

    Args:
        model_name: Model name (e.g., 'LTX-2', 'Wan2.2-T2V')

    Returns:
        Model details including file information
    """
    model = db.query(VideoModel).filter_by(name=model_name).first()

    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")

    return {
        "id": model.id,
        "name": model.name,
        "display_name": model.display_name,
        "supports_t2v": model.supports_t2v,
        "supports_i2v": model.supports_i2v,
        "is_moe": model.is_moe,
        "requires_paired_files": model.requires_paired_files,
        "model_files": _safe_json_loads(model.model_files, [], "model.model_files"),
        "t2v_categories": _safe_json_loads(model.t2v_categories, [], "model.t2v_categories"),
        "i2v_categories": _safe_json_loads(model.i2v_categories, [], "model.i2v_categories"),
        "is_complete": model.is_complete,
        "is_installed": model.is_installed,
        "detected_at": model.detected_at.isoformat() if model.detected_at else None,
        "updated_at": model.updated_at.isoformat() if model.updated_at else None
    }


@router.get("/validate/{model_name}")
async def validate_model(model_name: str, db: Session = Depends(get_db)):
    """
    Validate model installation (check file existence, MoE completeness).

    Args:
        model_name: Model name to validate

    Returns:
        Validation result
    """
    model = db.query(VideoModel).filter_by(name=model_name).first()

    if not model:
        return {
            "valid": False,
            "error": f"Model '{model_name}' not found"
        }

    files = _safe_json_loads(model.model_files, [], "model.model_files")

    result = {
        "valid": model.is_complete,
        "model": model_name,
        "is_moe": model.is_moe,
        "is_complete": model.is_complete
    }

    if model.is_moe:
        has_high = any(f["type"] == "high_noise" and f.get("exists", True) for f in files)
        has_low = any(f["type"] == "low_noise" and f.get("exists", True) for f in files)

        result["has_high_noise"] = has_high
        result["has_low_noise"] = has_low

        missing = []
        if not has_high:
            missing.append("high_noise")
        if not has_low:
            missing.append("low_noise")

        result["missing_files"] = missing

    return result
