"""LoRA file scanning and classification service."""

import json
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple

from ..config import settings


class LoraScanner:
    """Scans and classifies video LoRA files."""

    # Known video LoRA patterns
    VIDEO_LORA_PATTERNS = {
        "ltx2": {
            "pattern": r"ltx[-_]?2",
            "base_model": "LTX-2",
            "categories": {
                "distilled": r"distilled",
                "camera": r"camera",
                "style": r"style",
            }
        },
        "wan22_t2v": {
            "pattern": r"Wan2\.?2.*T2V|Wan2\.?2.*Lightning.*T2V",
            "base_model": "Wan2.2-T2V",
            "categories": {
                "lightning": r"[Ll]ightning",
            }
        },
        "wan22_i2v": {
            "pattern": r"Wan2\.?2.*I2V|Wan2\.?2.*Lightning.*I2V",
            "base_model": "Wan2.2-I2V",
            "categories": {
                "lightning": r"[Ll]ightning",
            }
        }
    }

    def __init__(self):
        self.loras_path = settings.loras_path

    def scan_all(self) -> List[Dict]:
        """Scan all video LoRA files and return grouped results."""
        if not self.loras_path.exists():
            return []

        # Scan all safetensors files
        all_files = list(self.loras_path.glob("*.safetensors"))

        # Parse each file
        parsed_loras = []
        for file_path in all_files:
            lora_info = self._parse_lora_file(file_path)
            if lora_info:  # Only include video LoRAs
                parsed_loras.append(lora_info)

        # Group MoE pairs (HIGH + LOW)
        grouped_loras = self._group_moe_pairs(parsed_loras)

        return grouped_loras

    def _parse_lora_file(self, file_path: Path) -> Optional[Dict]:
        """Parse a single LoRA file and extract metadata."""
        filename = file_path.stem

        # Detect base model and type
        base_model, task_type = self._detect_base_model(filename)
        if not base_model:
            return None  # Not a video LoRA

        # Detect category
        category = self._detect_category(filename, base_model)

        # Check if this is a MoE file (HIGH/LOW)
        is_high_noise = "_HIGH" in filename or "HIGH" in filename.upper()
        is_low_noise = "_LOW" in filename or "LOW" in filename.upper()
        is_moe_file = is_high_noise or is_low_noise

        # Get file info
        file_size = file_path.stat().st_size

        return {
            "filename": file_path.name,
            "path": str(file_path),
            "size": file_size,
            "base_model": base_model,
            "task_type": task_type,
            "category": category,
            "is_moe_file": is_moe_file,
            "is_high_noise": is_high_noise,
            "is_low_noise": is_low_noise,
            "pair_key": self._get_pair_key(filename) if is_moe_file else None
        }

    def _detect_base_model(self, filename: str) -> Tuple[Optional[str], Optional[str]]:
        """Detect the base model and task type from filename."""
        filename_lower = filename.lower()

        # Check for Wan2.2 T2V (must check before generic Wan2.2)
        if re.search(r"wan2\.?2.*t2v|wan2\.?2.*lightning.*t2v", filename_lower, re.IGNORECASE):
            return "Wan2.2-T2V", "T2V"

        # Check for Wan2.2 I2V
        if re.search(r"wan2\.?2.*i2v|wan2\.?2.*lightning.*i2v", filename_lower, re.IGNORECASE):
            return "Wan2.2-I2V", "I2V"

        # Check for LTX-2
        if re.search(r"ltx[-_]?2", filename_lower):
            # LTX-2 supports both T2V and I2V
            # Check for specific indicators
            if "i2v" in filename_lower:
                return "LTX-2", "I2V"
            elif "t2v" in filename_lower:
                return "LTX-2", "T2V"
            else:
                # Default to BOTH for LTX-2 if not specified
                return "LTX-2", "BOTH"

        return None, None

    def _detect_category(self, filename: str, base_model: str) -> str:
        """Detect the LoRA category from filename."""
        filename_lower = filename.lower()

        # Category patterns
        if "lightning" in filename_lower:
            return "lightning"
        elif "distilled" in filename_lower:
            return "distilled"
        elif "camera" in filename_lower:
            return "camera"
        elif "style" in filename_lower:
            return "style"
        elif "motion" in filename_lower:
            return "motion"
        else:
            return "general"

    def _get_pair_key(self, filename: str) -> str:
        """Get a key for pairing HIGH/LOW files."""
        # Remove HIGH/LOW indicators to create a common key
        key = re.sub(r"[_-]?(HIGH|LOW|high|low)[_-]?", "", filename)
        # Normalize
        key = re.sub(r"[_-]+", "-", key)
        return key.lower()

    def _group_moe_pairs(self, loras: List[Dict]) -> List[Dict]:
        """Group HIGH/LOW MoE pairs into single LoRA entries."""
        # Separate MoE files and regular files
        moe_files: Dict[str, List[Dict]] = {}
        regular_files: List[Dict] = []

        for lora in loras:
            if lora["is_moe_file"]:
                pair_key = lora["pair_key"]
                if pair_key not in moe_files:
                    moe_files[pair_key] = []
                moe_files[pair_key].append(lora)
            else:
                regular_files.append(lora)

        # Process MoE pairs
        grouped_loras = []

        for pair_key, files in moe_files.items():
            high_file = next((f for f in files if f["is_high_noise"]), None)
            low_file = next((f for f in files if f["is_low_noise"]), None)

            if high_file and low_file:
                # Complete pair
                grouped_loras.append({
                    "name": self._generate_lora_name(high_file),
                    "description": f"MoE LoRA for {high_file['base_model']}",
                    "base_model": high_file["base_model"],
                    "task_type": high_file["task_type"],
                    "category": high_file["category"],
                    "is_moe": True,
                    "requires_paired_files": True,
                    "files": json.dumps([
                        {
                            "type": "high_noise",
                            "filename": high_file["filename"],
                            "path": high_file["path"],
                            "size": high_file["size"],
                            "is_downloaded": True
                        },
                        {
                            "type": "low_noise",
                            "filename": low_file["filename"],
                            "path": low_file["path"],
                            "size": low_file["size"],
                            "is_downloaded": True
                        }
                    ]),
                    "total_size": high_file["size"] + low_file["size"],
                    "all_files_downloaded": True,
                    "source": "local"
                })
            else:
                # Incomplete pair - add as individual files with warning
                for f in files:
                    grouped_loras.append({
                        "name": self._generate_lora_name(f) + " (incomplete)",
                        "description": f"Incomplete MoE LoRA - missing {'LOW' if f['is_high_noise'] else 'HIGH'} file",
                        "base_model": f["base_model"],
                        "task_type": f["task_type"],
                        "category": f["category"],
                        "is_moe": True,
                        "requires_paired_files": True,
                        "files": json.dumps([{
                            "type": "high_noise" if f["is_high_noise"] else "low_noise",
                            "filename": f["filename"],
                            "path": f["path"],
                            "size": f["size"],
                            "is_downloaded": True
                        }]),
                        "total_size": f["size"],
                        "all_files_downloaded": False,  # Incomplete
                        "source": "local"
                    })

        # Process regular (non-MoE) files
        for lora in regular_files:
            grouped_loras.append({
                "name": self._generate_lora_name(lora),
                "description": f"LoRA for {lora['base_model']}",
                "base_model": lora["base_model"],
                "task_type": lora["task_type"],
                "category": lora["category"],
                "is_moe": False,
                "requires_paired_files": False,
                "files": json.dumps([{
                    "type": "single",
                    "filename": lora["filename"],
                    "path": lora["path"],
                    "size": lora["size"],
                    "is_downloaded": True
                }]),
                "total_size": lora["size"],
                "all_files_downloaded": True,
                "source": "local"
            })

        return grouped_loras

    def _generate_lora_name(self, lora: Dict) -> str:
        """Generate a human-readable name for a LoRA."""
        filename = lora["filename"]

        # Clean up the filename
        name = filename.replace(".safetensors", "")
        name = re.sub(r"[_-]?(HIGH|LOW|high|low)[_-]?", "", name)
        name = name.replace("_", " ").replace("-", " ")

        # Capitalize properly
        words = name.split()
        name = " ".join(w.capitalize() if w.islower() else w for w in words)

        return name

    def get_stats(self) -> Dict:
        """Get statistics about scanned LoRAs."""
        loras = self.scan_all()

        by_model = {}
        by_category = {}

        for lora in loras:
            # Count by model
            model = lora["base_model"]
            by_model[model] = by_model.get(model, 0) + 1

            # Count by category
            cat = lora["category"]
            by_category[cat] = by_category.get(cat, 0) + 1

        return {
            "total": len(loras),
            "by_model": by_model,
            "by_category": by_category,
            "moe_count": sum(1 for l in loras if l["is_moe"]),
            "regular_count": sum(1 for l in loras if not l["is_moe"])
        }
