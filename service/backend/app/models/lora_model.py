"""LoraModel - Video LoRA files catalog."""

from sqlalchemy import Column, Integer, String, Boolean, Text, Float, DateTime, CheckConstraint
from sqlalchemy.sql import func

from ..database import Base


class LoraModel(Base):
    """Represents a video LoRA file or MoE pair."""

    __tablename__ = "lora_models"
    __table_args__ = (
        CheckConstraint("task_type IN ('T2V', 'I2V', 'BOTH')", name="ck_lora_task_type"),
        CheckConstraint("source IN ('local', 'huggingface', 'github')", name="ck_lora_source"),
        CheckConstraint("download_progress BETWEEN 0 AND 100", name="ck_lora_progress"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Basic info
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Model compatibility
    base_model = Column(String(50), nullable=False)  # 'LTX-2', 'Wan2.2-T2V', 'Wan2.2-I2V'
    task_type = Column(String(10), nullable=False)   # 'T2V', 'I2V', 'BOTH'
    category = Column(String(50), nullable=False)    # 'camera', 'lightning', 'distilled', etc.

    # MoE support
    is_moe = Column(Boolean, default=False, nullable=False)
    requires_paired_files = Column(Boolean, default=False, nullable=False)

    # File information (JSON array)
    # [{
    #   "type": "single" | "high_noise" | "low_noise",
    #   "filename": "...",
    #   "path": "/ComfyUI/models/loras/...",
    #   "size": 1234567890,
    #   "is_downloaded": true
    # }]
    files = Column(Text, nullable=False, default="[]")

    # Total size in bytes
    total_size = Column(Integer, default=0)

    # Prompt information (JSON array)
    trigger_words = Column(Text, nullable=True)  # ["dolly shot", "tracking"]
    recommended_strength = Column(Float, default=1.0)

    # Samples
    sample_video = Column(String(500), nullable=True)
    thumbnail = Column(String(500), nullable=True)

    # Settings (JSON)
    # {"steps": 20, "cfg": 4.0, "fps": 24, "resolution": "720p"}
    settings = Column(Text, nullable=True)

    # Stats
    downloads = Column(Integer, default=0)
    rating = Column(Float, default=0.0)

    # Source
    source = Column(String(50), nullable=False, default="local")  # 'local', 'huggingface', 'github'
    source_url = Column(String(500), nullable=True)
    author = Column(String(100), nullable=True)

    # Status
    all_files_downloaded = Column(Boolean, default=False)
    download_progress = Column(Integer, default=0)  # 0-100

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<LoraModel(name='{self.name}', base_model='{self.base_model}', task='{self.task_type}')>"
