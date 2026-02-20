"""Configuration settings for the Video LoRA Manager."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ComfyUI paths
    comfyui_path: str = "/opt/comfyui-server"
    comfyui_host: str = "localhost"
    comfyui_port: int = 8188

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8080
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./data/lora_manager.db"

    # Google AI (Gemini) API Keys
    google_api_key: str = ""
    google_api_key_fallback: str = ""

    # Derived paths
    @property
    def models_path(self) -> Path:
        return Path(self.comfyui_path) / "models"

    @property
    def unet_path(self) -> Path:
        return self.models_path / "unet"

    @property
    def loras_path(self) -> Path:
        return self.models_path / "loras"

    @property
    def checkpoints_path(self) -> Path:
        return self.models_path / "checkpoints"

    @property
    def comfyui_api_url(self) -> str:
        return f"http://{self.comfyui_host}:{self.comfyui_port}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Export settings instance
settings = get_settings()
