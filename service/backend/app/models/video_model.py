"""VideoModel - Installed video generation models."""

from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, CheckConstraint
from sqlalchemy.sql import func

from ..database import Base


class VideoModel(Base):
    """Represents an installed video generation model (LTX-2, Wan2.2-T2V, Wan2.2-I2V)."""

    __tablename__ = "video_models"
    __table_args__ = (
        CheckConstraint("name IN ('LTX-2', 'Wan2.2-T2V', 'Wan2.2-I2V')", name="ck_video_model_name"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Model identification
    name = Column(String(100), unique=True, nullable=False)  # 'LTX-2', 'Wan2.2-T2V', 'Wan2.2-I2V'
    display_name = Column(String(200), nullable=False)

    # Task support
    supports_t2v = Column(Boolean, default=False, nullable=False)  # Text-to-Video
    supports_i2v = Column(Boolean, default=False, nullable=False)  # Image-to-Video

    # Architecture
    is_moe = Column(Boolean, default=False, nullable=False)  # Mixture of Experts
    requires_paired_files = Column(Boolean, default=False, nullable=False)  # HIGH + LOW files

    # File information (JSON array)
    # [{
    #   "type": "base" | "high_noise" | "low_noise",
    #   "path": "/path/to/file.gguf",
    #   "size": 17179869184,
    #   "exists": true
    # }]
    model_files = Column(Text, nullable=False, default="[]")

    # Supported LoRA categories (JSON arrays)
    t2v_categories = Column(Text, nullable=True)  # ["camera", "style", "distilled", "lightning"]
    i2v_categories = Column(Text, nullable=True)  # ["camera", "ic-lora", "motion", "lightning"]

    # Status
    is_complete = Column(Boolean, default=True, nullable=False)  # All required files present
    is_installed = Column(Boolean, default=True, nullable=False)

    # Timestamps
    detected_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<VideoModel(name='{self.name}', t2v={self.supports_t2v}, i2v={self.supports_i2v})>"
