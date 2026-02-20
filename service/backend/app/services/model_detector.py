"""Video model detection service."""

import json
from pathlib import Path
from typing import List, Dict, Optional

from ..config import settings


class VideoModelDetector:
    """Detects installed video generation models."""

    def __init__(self):
        self.unet_path = settings.unet_path
        self.checkpoint_path = settings.checkpoints_path

    def detect_all(self) -> List[Dict]:
        """Detect all installed video models."""
        detected = []

        # Detect LTX-2
        ltx2 = self._detect_ltx2()
        if ltx2:
            detected.append(ltx2)

        # Detect Wan2.2 T2V
        wan22_t2v = self._detect_wan22_t2v()
        if wan22_t2v:
            detected.append(wan22_t2v)

        # Detect Wan2.2 I2V
        wan22_i2v = self._detect_wan22_i2v()
        if wan22_i2v:
            detected.append(wan22_i2v)

        return detected

    def _detect_ltx2(self) -> Optional[Dict]:
        """Detect LTX-2 model (supports both T2V and I2V)."""
        # Check for GGUF file
        gguf_files = list(self.unet_path.glob("ltx-2*.gguf"))
        if gguf_files:
            file_path = gguf_files[0]
            return {
                "name": "LTX-2",
                "display_name": "LTX-2",
                "supports_t2v": True,
                "supports_i2v": True,
                "is_moe": False,
                "requires_paired_files": False,
                "model_files": json.dumps([{
                    "type": "base",
                    "path": str(file_path),
                    "size": file_path.stat().st_size,
                    "exists": True
                }]),
                "t2v_categories": json.dumps(["camera", "style", "distilled"]),
                "i2v_categories": json.dumps(["camera", "ic-lora", "motion"]),
                "is_complete": True,
                "is_installed": True
            }

        # Check for safetensors file
        safetensors_files = list(self.checkpoint_path.glob("ltx-2*.safetensors"))
        if safetensors_files:
            file_path = safetensors_files[0]
            return {
                "name": "LTX-2",
                "display_name": "LTX-2",
                "supports_t2v": True,
                "supports_i2v": True,
                "is_moe": False,
                "requires_paired_files": False,
                "model_files": json.dumps([{
                    "type": "base",
                    "path": str(file_path),
                    "size": file_path.stat().st_size,
                    "exists": True
                }]),
                "t2v_categories": json.dumps(["camera", "style", "distilled"]),
                "i2v_categories": json.dumps(["camera", "ic-lora", "motion"]),
                "is_complete": True,
                "is_installed": True
            }

        return None

    def _detect_wan22_t2v(self) -> Optional[Dict]:
        """Detect Wan2.2 T2V model (MoE: requires High + Low noise files)."""
        high_files = list(self.unet_path.glob("Wan2.2-T2V*HighNoise*.gguf"))
        low_files = list(self.unet_path.glob("Wan2.2-T2V*LowNoise*.gguf"))

        if not high_files or not low_files:
            return None

        high_path = high_files[0]
        low_path = low_files[0]

        return {
            "name": "Wan2.2-T2V",
            "display_name": "Wan2.2 Text-to-Video",
            "supports_t2v": True,
            "supports_i2v": False,
            "is_moe": True,
            "requires_paired_files": True,
            "model_files": json.dumps([
                {
                    "type": "high_noise",
                    "path": str(high_path),
                    "size": high_path.stat().st_size,
                    "exists": True
                },
                {
                    "type": "low_noise",
                    "path": str(low_path),
                    "size": low_path.stat().st_size,
                    "exists": True
                }
            ]),
            "t2v_categories": json.dumps(["lightning"]),
            "i2v_categories": None,
            "is_complete": True,
            "is_installed": True
        }

    def _detect_wan22_i2v(self) -> Optional[Dict]:
        """Detect Wan2.2 I2V model (MoE: requires High + Low noise files)."""
        high_files = list(self.unet_path.glob("Wan2.2-I2V*HighNoise*.gguf"))
        low_files = list(self.unet_path.glob("Wan2.2-I2V*LowNoise*.gguf"))

        if not high_files or not low_files:
            return None

        high_path = high_files[0]
        low_path = low_files[0]

        return {
            "name": "Wan2.2-I2V",
            "display_name": "Wan2.2 Image-to-Video",
            "supports_t2v": False,
            "supports_i2v": True,
            "is_moe": True,
            "requires_paired_files": True,
            "model_files": json.dumps([
                {
                    "type": "high_noise",
                    "path": str(high_path),
                    "size": high_path.stat().st_size,
                    "exists": True
                },
                {
                    "type": "low_noise",
                    "path": str(low_path),
                    "size": low_path.stat().st_size,
                    "exists": True
                }
            ]),
            "t2v_categories": None,
            "i2v_categories": json.dumps(["lightning"]),
            "is_complete": True,
            "is_installed": True
        }

    def get_model_summary(self) -> Dict:
        """Get summary of detected models."""
        detected = self.detect_all()
        return {
            "total": len(detected),
            "models": [
                {
                    "name": m["name"],
                    "display_name": m["display_name"],
                    "supports_t2v": m["supports_t2v"],
                    "supports_i2v": m["supports_i2v"],
                    "is_moe": m["is_moe"],
                    "is_complete": m["is_complete"]
                }
                for m in detected
            ]
        }
