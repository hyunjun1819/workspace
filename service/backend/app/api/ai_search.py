"""AI Search API endpoints."""

import logging
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional
from urllib.parse import urlparse
import aiohttp
import asyncio
from pathlib import Path

from ..services.ai_search import get_ai_searcher
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


def _is_valid_huggingface_url(url: str) -> bool:
    """Validate that a URL actually points to huggingface.co (not just contains the string)."""
    try:
        parsed = urlparse(url)
        return parsed.hostname in ("huggingface.co", "www.huggingface.co")
    except Exception:
        return False


class SearchRequest(BaseModel):
    """Request model for AI search (legacy)."""
    query: str = ""
    base_model: str


class TrendingRequest(BaseModel):
    """Request model for trending LoRAs."""
    base_model: str
    sort_by: str = "downloads"  # "downloads", "likes", or "trendingScore"


class DownloadExternalRequest(BaseModel):
    """Request model for downloading external LoRA."""
    url: str
    repo_id: str
    name: str
    base_model: str
    filename: Optional[str] = None


@router.post("/search")
async def ai_search(request: SearchRequest):
    """
    AI-powered LoRA search (legacy endpoint).

    Now redirects to trending for better quality results.
    """
    if not request.base_model:
        raise HTTPException(400, "베이스 모델을 선택해주세요")

    searcher = get_ai_searcher()
    result = await searcher.get_trending_loras(request.base_model, sort_by="downloads")

    if result.get("error"):
        return {"success": False, "error": result["error"], "results": []}

    return {"success": True, "results": result.get("results", []), "error": None}


@router.post("/trending")
async def get_trending_loras(request: TrendingRequest):
    """
    Get top 10 trending/popular LoRAs for a base model.

    Returns only verified, high-quality LoRAs from HuggingFace.

    Args:
        base_model: Target model (LTX-2, Wan2.2-T2V, Wan2.2-I2V)
        sort_by: "downloads", "likes", or "trendingScore"

    Returns:
        List of top 10 quality-verified LoRA recommendations with stats.
    """
    if not request.base_model:
        raise HTTPException(400, "베이스 모델을 선택해주세요")

    valid_sorts = ["downloads", "likes", "trendingScore"]
    if request.sort_by not in valid_sorts:
        raise HTTPException(400, f"sort_by는 {valid_sorts} 중 하나여야 합니다")

    searcher = get_ai_searcher()
    result = await searcher.get_trending_loras(request.base_model, sort_by=request.sort_by)

    if result.get("error"):
        return {"success": False, "error": result["error"], "results": []}

    return {"success": True, "results": result.get("results", []), "error": None}


@router.post("/validate-external")
async def validate_external_url(request: DownloadExternalRequest):
    """
    Validate an external HuggingFace URL before download.
    """
    # Only allow HuggingFace URLs (strict hostname check to prevent SSRF)
    if not _is_valid_huggingface_url(request.url):
        return {"valid": False, "error": "HuggingFace URL만 지원합니다"}

    # Try to access the repo
    try:
        async with aiohttp.ClientSession() as session:
            async with session.head(request.url, allow_redirects=True) as response:
                if response.status == 404:
                    return {"valid": False, "error": "저장소를 찾을 수 없습니다"}
                if response.status != 200:
                    return {"valid": False, "error": f"접근 오류: {response.status}"}

        return {"valid": True, "error": None}
    except Exception as e:
        return {"valid": False, "error": f"검증 실패: {str(e)}"}


@router.websocket("/ws/download-external")
async def download_external_lora(websocket: WebSocket):
    """
    Download LoRA from external HuggingFace URL via WebSocket.

    Provides real-time progress updates.
    """
    await websocket.accept()

    try:
        # Receive download request
        data = await websocket.receive_json()
        url = data.get("url")
        repo_id = data.get("repo_id")
        name = data.get("name", "Unknown LoRA")
        base_model = data.get("base_model")
        filename = data.get("filename")

        if not url or not _is_valid_huggingface_url(url):
            await websocket.send_json({"type": "error", "error": "잘못된 URL (HuggingFace URL만 지원)"})
            return

        # Determine target directory based on base model
        loras_path = settings.loras_path

        # For Wan2.2 models, we might need to download MoE pairs
        is_moe = "Wan2.2" in base_model

        await websocket.send_json({
            "type": "status",
            "message": f"다운로드 준비 중: {name}"
        })

        # Build HuggingFace download URL
        # Format: https://huggingface.co/{repo_id}/resolve/main/{filename}
        if not filename:
            # Try to find .safetensors files in the repo
            files, fetch_error = await _get_repo_files(repo_id)
            if fetch_error:
                await websocket.send_json({"type": "error", "error": fetch_error})
                return
            safetensor_files = [f for f in files if f.endswith(".safetensors")]

            if not safetensor_files:
                await websocket.send_json({
                    "type": "error",
                    "error": "LoRA 파일을 찾을 수 없습니다 (.safetensors)"
                })
                return

            # For MoE, look for HighNoise/LowNoise pairs
            if is_moe:
                high_files = [f for f in safetensor_files if "high" in f.lower()]
                low_files = [f for f in safetensor_files if "low" in f.lower()]
                if high_files and low_files:
                    files_to_download = [high_files[0], low_files[0]]
                else:
                    files_to_download = safetensor_files[:1]
            else:
                files_to_download = safetensor_files[:1]
        else:
            files_to_download = [filename]

        # Download each file
        total_files = len(files_to_download)
        for idx, file in enumerate(files_to_download):
            download_url = f"https://huggingface.co/{repo_id}/resolve/main/{file}"
            # Sanitize filename to prevent path traversal
            safe_filename = Path(file).name
            target_path = (loras_path / safe_filename).resolve()
            if not target_path.is_relative_to(loras_path.resolve()):
                await websocket.send_json({"type": "error", "error": f"잘못된 파일명: {file}"})
                return

            await websocket.send_json({
                "type": "progress",
                "filename": file,
                "file_index": idx + 1,
                "total_files": total_files,
                "progress": 0
            })

            success = await _download_file(
                download_url,
                target_path,
                websocket,
                file,
                idx + 1,
                total_files
            )

            if not success:
                await websocket.send_json({
                    "type": "error",
                    "error": f"다운로드 실패: {file}"
                })
                return

        await websocket.send_json({
            "type": "complete",
            "message": f"{total_files}개 파일 다운로드 완료",
            "files": files_to_download
        })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected during download")
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except Exception as send_error:
            logger.error("Failed to send error to client: %s. Original error: %s", send_error, e)


async def _get_repo_files(repo_id: str) -> tuple[list, str | None]:
    """Get list of files in a HuggingFace repo. Returns (files, error_message)."""
    api_url = f"https://huggingface.co/api/models/{repo_id}"

    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(api_url) as response:
                if response.status == 404:
                    return [], "저장소를 찾을 수 없습니다"
                if response.status == 429:
                    return [], "HuggingFace 요청 제한. 잠시 후 다시 시도하세요."
                if response.status != 200:
                    return [], f"HuggingFace API 오류: {response.status}"
                data = await response.json()
                siblings = data.get("siblings", [])
                return [s.get("rfilename", "") for s in siblings], None
    except asyncio.TimeoutError:
        return [], "HuggingFace 연결 시간 초과"
    except Exception as e:
        logger.error("Error fetching repo files: %s", e)
        return [], f"네트워크 오류: {str(e)}"


async def _download_file(
    url: str,
    target_path: Path,
    websocket: WebSocket,
    filename: str,
    file_index: int,
    total_files: int
) -> bool:
    """Download a file with progress updates. Cleans up partial files on failure."""

    try:
        # Ensure parent directory exists
        target_path.parent.mkdir(parents=True, exist_ok=True)

        timeout = aiohttp.ClientTimeout(total=3600, connect=30)  # 1hr total, 30s connect
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as response:
                if response.status != 200:
                    logger.error("Download failed for %s: HTTP %d", filename, response.status)
                    return False

                total_size = int(response.headers.get("content-length", 0))
                downloaded = 0

                with open(target_path, "wb") as f:
                    async for chunk in response.content.iter_chunked(1024 * 1024):  # 1MB chunks
                        f.write(chunk)
                        downloaded += len(chunk)

                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            await websocket.send_json({
                                "type": "progress",
                                "filename": filename,
                                "file_index": file_index,
                                "total_files": total_files,
                                "progress": progress,
                                "downloaded": downloaded,
                                "total": total_size
                            })

        return True

    except Exception as e:
        logger.error("Download error for %s: %s", filename, e)
        # Clean up partial file on failure
        if target_path.exists():
            target_path.unlink()
            logger.warning("Cleaned up partial download: %s", target_path)
        return False
