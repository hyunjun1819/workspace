"""FastAPI application entry point."""

import logging
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from .config import settings
from .database import init_db
from .api import models, loras, download, ai_search, help, upload, tips

logger = logging.getLogger(__name__)

# Static files directory (frontend build)
# Path: app/main.py -> app/ -> backend/ -> backend/static
STATIC_DIR = Path(__file__).parent.parent / "static"
if not STATIC_DIR.exists():
    # Try frontend dist directory for development
    STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"
    if not STATIC_DIR.exists():
        # Try alternative path for Docker
        STATIC_DIR = Path("/app/static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Initializing Video LoRA Manager...")
    init_db()
    logger.info("ComfyUI path: %s", settings.comfyui_path)
    logger.info("Models path: %s", settings.models_path)
    logger.info("LoRAs path: %s", settings.loras_path)
    yield
    # Shutdown
    logger.info("Shutting down Video LoRA Manager...")


app = FastAPI(
    title="ComfyUI Video LoRA Manager",
    description="Web interface for managing video generation LoRA models",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration - restrict to known origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://localhost:{settings.port}",
        f"http://127.0.0.1:{settings.port}",
        "http://localhost:3000",  # Vite dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(loras.router, prefix="/api/loras", tags=["loras"])
app.include_router(download.router, prefix="/api", tags=["download"])
app.include_router(ai_search.router, prefix="/api/ai-search", tags=["ai-search"])
app.include_router(help.router, prefix="/api/help", tags=["help"])
app.include_router(tips.router, prefix="/api/tips", tags=["tips"])
app.include_router(upload.router, prefix="/api/loras", tags=["upload"])

# Serve video files for guide
VIDEO_DIR = Path(__file__).parent.parent.parent / "video"
if VIDEO_DIR.exists():
    app.mount("/videos", StaticFiles(directory=VIDEO_DIR), name="videos")


@app.get("/health")
async def health_check():
    """Health check endpoint with service status."""
    import aiohttp

    # Check ComfyUI connection
    comfyui_ok = False
    try:
        timeout = aiohttp.ClientTimeout(total=3)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{settings.comfyui_api_url}/system_stats") as resp:
                comfyui_ok = resp.status == 200
    except Exception:
        pass

    # Check Gemini API key presence
    gemini_configured = bool(settings.google_api_key)

    return {
        "status": "healthy",
        "comfyui": comfyui_ok,
        "gemini_configured": gemini_configured,
    }


# Serve static files (frontend build)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/")
    async def serve_frontend():
        """Serve frontend index.html."""
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Serve SPA routes - return index.html for client-side routing."""
        # Check if it's a static file (with path traversal protection)
        file_path = (STATIC_DIR / path).resolve()
        if file_path.is_relative_to(STATIC_DIR.resolve()) and file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Otherwise return index.html for SPA routing
        return FileResponse(STATIC_DIR / "index.html")
else:
    @app.get("/")
    async def root():
        """Root endpoint (no frontend build)."""
        return {
            "name": "ComfyUI Video LoRA Manager",
            "version": "1.0.0",
            "status": "running",
            "note": "Frontend not built. Run 'npm run build' in frontend directory."
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
