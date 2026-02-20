"""AI-powered LoRA search service using Google Gemini API."""

import json
import logging
import re
import asyncio
from typing import Optional
import aiohttp
import google.generativeai as genai
from ..config import settings

logger = logging.getLogger(__name__)


# Model-specific configuration for "Pin & Fill" strategy
MODEL_CONFIG = {
    "LTX-2": {
        "official_author": "Lightricks",      # For Pinning (author-based search)
        "official_query": "LTX-2",            # Specific query for official repos
        "search_query": "LTX-2 lora",         # Broad query for community
        "exclude_keywords": ["LTX-Video", "Squish"],  # CRITICAL: Exclude v1 & incompatible
    },
    "Wan2.2-T2V": {
        "official_author": "Wan-AI",
        "official_query": "Wan2.2",
        "search_query": "Wan2.2 lora",
        "exclude_keywords": ["Wan2.1", "Wan-T2V-1.0"],  # Exclude Wan2.1 (incompatible)
    },
    "Wan2.2-I2V": {
        "official_author": "Wan-AI",
        "official_query": "Wan2.2",
        "search_query": "Wan2.2 lora",
        "exclude_keywords": ["Wan2.1", "Wan-T2V-1.0"],  # Exclude Wan2.1 (incompatible)
    },
}

# Gemini Curator system prompt for Korean descriptions
CURATOR_SYSTEM_PROMPT = """
### Role
You are a 'Video AI Model Curator'.
Your goal is to translate and summarize technical LoRA metadata into attractive, easy-to-understand Korean descriptions.

### Input Data
You will receive a list of LoRA models with:
- **Repo ID**: (e.g., "Lightricks/LTX-2-Camera-Dolly")
- **Tags**: (e.g., ["camera", "motion", "cinematic"])
- **Source**: "Official" or "Community"

### Task
1. **Analyze**: Identify the LoRA's primary effect based on its name and tags.
   - *Tip*: "Dolly", "Zoom", "Pan" -> "camera"
   - *Tip*: "Anime", "Ghibli", "Clay" -> "style"
2. **Translate**: Write a 1-sentence description in natural Korean.
   - If Source is "Official", emphasize reliability (e.g., "제작사 공식 카메라 제어 모델입니다.").
3. **Categorize**: Classify `effect_type` into: "camera", "style", "character", "motion".
4. **Badge**:
   - If Source is "Official" → badge = "Official"
   - If Source is "Community" → badge = "Trending" (NOT "Community")

### Output JSON Schema
{
  "descriptions": [
    {
      "repo_id": "string (Exact match)",
      "description_ko": "string (Korean summary)",
      "effect_type": "string",
      "badge": "Official" | "Trending" (NEVER use "Community")
    }
  ]
}

### Example
**Input**: "Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-In" (Official)
**Output**:
{
  "repo_id": "Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-In",
  "description_ko": "피사체로 서서히 다가가는 '돌리 인(Dolly-In)' 효과를 안정적으로 구현하는 공식 모델입니다.",
  "effect_type": "camera",
  "badge": "Official"
}
"""


class AILoraSearcher:
    """Search for LoRAs using Gemini AI with web grounding."""

    def __init__(self):
        self.primary_key = settings.google_api_key
        self.fallback_key = settings.google_api_key_fallback
        self.current_key = self.primary_key
        self._configure_api()

    def _configure_api(self):
        """Configure the Gemini API with current key."""
        if self.current_key:
            genai.configure(api_key=self.current_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash')
        else:
            self.model = None

    def _switch_to_fallback(self):
        """Switch to fallback API key."""
        if self.current_key != self.fallback_key and self.fallback_key:
            logger.info("Switching to fallback API key due to rate limit")
            self.current_key = self.fallback_key
            self._configure_api()
            return True
        return False

    async def search_loras(self, query: str, base_model: str) -> dict:
        """
        Search for LoRAs matching the user's query.

        [DEPRECATED] Use get_trending_loras() instead for better quality results.
        """
        # Redirect to trending for better results
        return await self.get_trending_loras(base_model, sort_by="downloads")

    async def get_trending_loras(self, base_model: str, sort_by: str = "trendingScore") -> dict:
        """
        Get top 10 trending/popular video LoRAs using Pin & Fill strategy.

        Pin: Official models from author's repository (priority)
        Fill: Community models sorted by downloads/likes

        Args:
            base_model: Target model (LTX-2, Wan2.2-T2V, Wan2.2-I2V)
            sort_by: Sort method - "trendingScore", "downloads", or "likes"

        Returns:
            List of top 10 quality-verified LoRA recommendations
        """
        config = MODEL_CONFIG.get(base_model)

        logger.info("[Trending] Base model: %s, sort_by: %s", base_model, sort_by)

        if not config:
            logger.info("[Trending] No config for %s, using legacy method", base_model)
            # Fallback to legacy method for unsupported models
            model_filter = self._normalize_base_model_hf(base_model)
            all_results = await self._fetch_trending_hf(model_filter, sort_by)
            quality_results = [r for r in all_results if self._validate_lora_quality(r)]
            top_results = quality_results[:10]

            if self.model and top_results:
                top_results = await self._add_trending_descriptions(top_results, base_model)
            return {"results": top_results, "error": None}

        # Pin & Fill Strategy
        logger.info("[Trending] Using Pin & Fill for %s", base_model)

        # Step A: Fetch Official (Pin)
        official_results = await self._fetch_official_loras(config)

        # Step B: Fetch Community (Fill)
        community_results = await self._fetch_community_loras(config, sort_by)

        # Step C: Merge all results (deduplicate by repo_id)
        seen_repos = {r["repo_id"] for r in official_results}
        unique_community = [r for r in community_results if r["repo_id"] not in seen_repos]

        all_results = official_results + unique_community
        logger.info("[Trending] Official: %d, Community: %d, Total: %d", len(official_results), len(unique_community), len(all_results))

        # Apply quality filters
        quality_results = [r for r in all_results if self._validate_lora_quality(r)]

        if not quality_results:
            return {"error": "인기 LoRA를 찾을 수 없습니다. 다른 모델을 선택해보세요.", "results": []}

        # Sort ALL results by selected criteria (no official/community distinction)
        sort_key = "downloads" if sort_by == "downloads" else "likes" if sort_by == "likes" else "downloads"
        quality_results.sort(key=lambda x: x.get(sort_key, 0), reverse=True)
        logger.debug("[Trending] Sorted by %s", sort_key)

        # Take top 10 (sorted by downloads/likes, NOT by official status)
        top_results = quality_results[:10]

        # Add Korean descriptions with Gemini Curator
        if self.model and top_results:
            top_results = await self._add_trending_descriptions(top_results, base_model)

        return {"results": top_results, "error": None}

    def _validate_lora_quality(self, model_data: dict) -> bool:
        """Validate that a LoRA meets minimum quality standards.

        Quality criteria (relaxed for emerging video LoRA ecosystem):
        - Must have safetensors file
        - No minimum downloads (LTX-Video is new technology)
        - No description requirement (HuggingFace repos often lack descriptions)
        """
        # Must have safetensors (already filtered during fetch)
        if not model_data.get("has_safetensors", True):
            logger.debug("[Quality] Rejected %s: no safetensors", model_data.get("name"))
            return False

        return True

    def _contains_exclude_keywords(self, text: str, exclude_keywords: list) -> bool:
        """Check if text contains any of the exclude keywords."""
        text_lower = text.lower()
        return any(kw.lower() in text_lower for kw in exclude_keywords)

    def _build_result(self, model: dict, source: str) -> dict:
        """Build result dict from HuggingFace model data."""
        repo_id = model.get("modelId", "")
        siblings = model.get("siblings", [])
        safetensor_files = [s for s in siblings if s.get("rfilename", "").endswith(".safetensors")]
        total_size = sum(s.get("size", 0) for s in safetensor_files)

        return {
            "name": repo_id.split("/")[-1],
            "repo_id": repo_id,
            "url": f"https://huggingface.co/{repo_id}",
            "source": source,  # "Official" or "Community"
            "downloads": model.get("downloads", 0),
            "likes": model.get("likes", 0),
            "tags": model.get("tags", []),
            "estimated_size_mb": round(total_size / (1024 * 1024)) if total_size else 100,
            "has_safetensors": True,
            "last_modified": model.get("lastModified", ""),
            "description_ko": "",  # Gemini will fill this
            "effect_type": self._detect_effect_type(repo_id, model.get("tags", [])),
            "compatibility_note": f"{source} 모델",
            "thumbnail": None,
        }

    def _normalize_base_model_hf(self, model_name: str) -> str:
        """Normalize model name to HuggingFace search keywords."""
        model_mapping = {
            "LTX-2": "ltx",
            "Wan2.2-T2V": "wan",
            "Wan2.2-I2V": "wan",
        }
        return model_mapping.get(model_name, "video")

    async def _fetch_official_loras(self, config: dict) -> list:
        """
        Step A: Fetch official LoRAs from author's repository (Pin).
        - Uses author parameter for official repos only
        - No "video" tag filter (official models may not have tags)
        """
        author = config["official_author"]
        query = config["official_query"]
        exclude = config.get("exclude_keywords", [])

        results = []
        try:
            async with aiohttp.ClientSession() as session:
                api_url = "https://huggingface.co/api/models"
                params = {
                    "author": author,
                    "search": query,
                    "limit": 20,
                    "full": "true"
                }

                logger.info("[Official] Fetching from author=%s, query=%s", author, query)

                async with session.get(api_url, params=params) as response:
                    if response.status != 200:
                        logger.warning("[Official] API error: %d", response.status)
                        return []

                    models = await response.json()
                    logger.info("[Official] Found %d models from %s", len(models), author)

                    for model in models:
                        repo_id = model.get("modelId", "")

                        # Filter LoRA models only
                        if "LoRA" not in repo_id and "lora" not in repo_id.lower():
                            continue

                        # Apply exclude keywords filter
                        if self._contains_exclude_keywords(repo_id, exclude):
                            logger.debug("[Official] Excluded: %s", repo_id)
                            continue

                        # Check for safetensors
                        siblings = model.get("siblings", [])
                        has_safetensors = any(
                            s.get("rfilename", "").endswith(".safetensors")
                            for s in siblings
                        )
                        if not has_safetensors:
                            continue

                        result = self._build_result(model, source="Official")
                        results.append(result)

                    logger.info("[Official] Returning %d official LoRAs", len(results))

        except Exception as e:
            logger.error("[Official] Error: %s", e)

        return results

    async def _fetch_community_loras(self, config: dict, sort_by: str) -> list:
        """
        Step B: Fetch community LoRAs (Fill).
        - Sorted by downloads/likes
        - Strict exclude_keywords filtering
        """
        query = config["search_query"]
        exclude = config.get("exclude_keywords", [])

        results = []
        try:
            async with aiohttp.ClientSession() as session:
                api_url = "https://huggingface.co/api/models"
                params = {
                    "search": query,
                    "sort": sort_by,
                    "direction": "-1",
                    "limit": 30,
                    "full": "true"
                }

                logger.info("[Community] Fetching query=%s, sort=%s", query, sort_by)

                async with session.get(api_url, params=params) as response:
                    if response.status != 200:
                        logger.warning("[Community] API error: %d", response.status)
                        return []

                    models = await response.json()
                    logger.info("[Community] Found %d models", len(models))

                    for model in models:
                        repo_id = model.get("modelId", "")

                        # Apply exclude keywords filter (CRITICAL)
                        if self._contains_exclude_keywords(repo_id, exclude):
                            logger.debug("[Community] Excluded: %s", repo_id)
                            continue

                        # Check for safetensors
                        siblings = model.get("siblings", [])
                        has_safetensors = any(
                            s.get("rfilename", "").endswith(".safetensors")
                            for s in siblings
                        )
                        if not has_safetensors:
                            continue

                        result = self._build_result(model, source="Community")
                        results.append(result)

                    logger.info("[Community] Returning %d community LoRAs", len(results))

        except Exception as e:
            logger.error("[Community] Error: %s", e)

        return results

    async def _fetch_trending_hf(self, model_keyword: str, sort_by: str) -> list:
        """Fetch trending LoRAs from HuggingFace API.

        Args:
            model_keyword: Model keyword for search (e.g., "ltx", "wan")
            sort_by: Sort method - "trendingScore", "downloads", or "likes"
        """
        results = []

        # Search queries to try
        search_queries = [
            f"{model_keyword} lora video",
            f"{model_keyword} video lora",
            f"{model_keyword}video lora",
        ]

        try:
            async with aiohttp.ClientSession() as session:
                seen_repos = set()

                for search_query in search_queries:
                    api_url = "https://huggingface.co/api/models"
                    params = {
                        "search": search_query,
                        "sort": sort_by,
                        "direction": "-1",
                        "limit": 30,
                        "full": "true"
                    }

                    async with session.get(api_url, params=params) as response:
                        if response.status != 200:
                            logger.warning("[HF API] Error %d for '%s'", response.status, search_query)
                            continue

                        models = await response.json()

                        for model in models:
                            repo_id = model.get("modelId", "")

                            # Skip duplicates
                            if repo_id in seen_repos:
                                continue
                            seen_repos.add(repo_id)

                            # Check for safetensors
                            siblings = model.get("siblings", [])
                            has_safetensors = any(
                                s.get("rfilename", "").endswith(".safetensors")
                                for s in siblings
                            )

                            if not has_safetensors:
                                continue

                            # Check model compatibility
                            if not self._is_compatible_with_model_keyword(model, model_keyword):
                                continue

                            # Get file size
                            safetensor_files = [s for s in siblings if s.get("rfilename", "").endswith(".safetensors")]
                            total_size = sum(s.get("size", 0) for s in safetensor_files)

                            result = {
                                "name": repo_id.split("/")[-1],
                                "repo_id": repo_id,
                                "url": f"https://huggingface.co/{repo_id}",
                                "description_ko": model.get("cardData", {}).get("description", "") or "HuggingFace LoRA",
                                "description": model.get("cardData", {}).get("description", "") or "",
                                "effect_type": self._detect_effect_type(repo_id, model.get("tags", [])),
                                "estimated_size_mb": round(total_size / (1024 * 1024)) if total_size else 100,
                                "compatibility_note": f"{model_keyword.upper()} 모델 호환",
                                "thumbnail": None,
                                "downloads": model.get("downloads", 0),
                                "likes": model.get("likes", 0),
                                "tags": model.get("tags", []),
                                "source": "huggingface",
                                "has_safetensors": True,
                                "last_modified": model.get("lastModified", "")
                            }

                            results.append(result)

                    # Stop if we have enough results
                    if len(results) >= 30:
                        break

        except Exception as e:
            logger.error("[HF Trending] Error: %s", e)

        # Sort by the requested method
        if sort_by == "downloads":
            results = sorted(results, key=lambda x: x.get("downloads", 0), reverse=True)
        elif sort_by == "likes":
            results = sorted(results, key=lambda x: x.get("likes", 0), reverse=True)

        return results

    def _is_compatible_with_model_keyword(self, model: dict, keyword: str) -> bool:
        """Check if HuggingFace model is compatible with target model keyword."""
        repo_id = model.get("modelId", "").lower()
        tags = [t.lower() for t in model.get("tags", [])]

        # Check in repo_id and tags
        searchable = repo_id + " " + " ".join(tags)

        # Define related keywords for each model
        keyword_variants = {
            "ltx": ["ltx", "ltx-video", "ltx2", "ltxv", "lightricks"],
            "wan": ["wan", "wan2", "wanvideo", "wan-video"],
        }

        variants = keyword_variants.get(keyword, [keyword])
        return any(v in searchable for v in variants)

    async def _add_trending_descriptions(self, results: list, base_model: str) -> list:
        """Use Gemini Curator to add Korean descriptions and badges."""
        if not results:
            return results

        # Build input for Curator
        results_info = "\n".join([
            f"- {r['repo_id']}: tags={r.get('tags', [])[:5]}, source={r.get('source', 'Community')}"
            for r in results
        ])

        prompt = f"""{CURATOR_SYSTEM_PROMPT}

### Input
Target Model: {base_model}

{results_info}

### Output (JSON only):"""

        try:
            response = await self.model.generate_content_async(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )

            cleaned = response.text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            data = json.loads(cleaned)
            desc_map = {d["repo_id"]: d for d in data.get("descriptions", [])}

            # Map Curator output to results
            for result in results:
                repo_id = result["repo_id"]
                if repo_id in desc_map:
                    curator_data = desc_map[repo_id]
                    result["description_ko"] = curator_data.get("description_ko", "")
                    result["effect_type"] = curator_data.get("effect_type", result.get("effect_type", "style"))
                    result["badge"] = curator_data.get("badge", "Trending")
                else:
                    # Fallback: set badge based on source
                    result["badge"] = "Official" if result.get("source") == "Official" else "Trending"

            logger.info("[Curator] Successfully processed %d results", len(results))

        except Exception as e:
            logger.error("[Curator] Error: %s", e)
            # Fallback: set badge based on source only
            for result in results:
                result["badge"] = "Official" if result.get("source") == "Official" else "Trending"

        return results

    async def _parse_user_query(self, query: str, ui_base_model: str) -> dict:
        """
        Use Gemini to parse user query into structured JSON.
        Separates search keywords from base model filter.
        """
        if not self.model:
            # Fallback: use simple translation
            return {
                "search_query": " ".join(self._simple_translate(query)),
                "search_terms": self._simple_translate(query),
                "base_model_filter": self._normalize_base_model(ui_base_model)
            }

        prompt = """### Role
You are a Search Query Optimizer for AI video model platforms.

### Critical Rules
1. **Separate Intent**: Extract Base Model (filter) from Search Keywords (semantic).
2. **Normalize Model Names** (Civitai-compatible values):
   - "LTX", "LTX-2", "Lightricks" → "LTXV2"
   - "Wan", "Wan2.1", "Wan2.2" → "Wan Video"
3. **Clean Query**: REMOVE model name from search_query.
4. **English Only**: Convert any Korean keywords to English for search.

### Output JSON Schema
{
  "search_query": "string (Clean English keywords for text search)",
  "search_terms": ["array", "of", "individual", "keywords"],
  "filters": {
    "base_model": "string | null (Normalized: 'LTXV2' or 'Wan Video')"
  }
}

### Examples
Input: "LTX-2용 부드러운 카메라 움직임"
Output:
{
  "search_query": "smooth camera movement cinematic motion",
  "search_terms": ["smooth camera", "camera movement", "cinematic motion", "dolly shot"],
  "filters": { "base_model": "LTXV2" }
}

Input: "피부 질감 디테일" (UI model: Wan2.2-I2V)
Output:
{
  "search_query": "skin texture detail realistic",
  "search_terms": ["skin texture", "skin detail", "realistic skin", "face detail"],
  "filters": { "base_model": "Wan Video" }
}

Input: "시네마틱 스타일 로라"
Output:
{
  "search_query": "cinematic style film look aesthetic",
  "search_terms": ["cinematic", "film style", "movie look", "aesthetic"],
  "filters": { "base_model": null }
}
"""

        user_prompt = f"""User Query: {query}
UI Selected Model: {ui_base_model}

Return JSON only:"""

        try:
            response = await self.model.generate_content_async(
                prompt + "\n\n" + user_prompt,
                generation_config={"response_mime_type": "application/json"}
            )

            cleaned = response.text.strip()
            # Clean markdown code blocks if present
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            data = json.loads(cleaned)

            result = {
                "search_query": data.get("search_query", ""),
                "search_terms": data.get("search_terms", []),
                "base_model_filter": data.get("filters", {}).get("base_model") or self._normalize_base_model(ui_base_model)
            }

            logger.info("[Structured Query] search_query: '%s'", result['search_query'])
            logger.info("[Structured Query] base_model_filter: '%s'", result['base_model_filter'])

            return result

        except Exception as e:
            logger.error("Error parsing user query: %s", e)
            # Fallback
            return {
                "search_query": " ".join(self._simple_translate(query)),
                "search_terms": self._simple_translate(query),
                "base_model_filter": self._normalize_base_model(ui_base_model)
            }

    def _normalize_base_model(self, model_name: str) -> str:
        """Normalize model name for internal use (legacy compatibility)."""
        return self._normalize_base_model_hf(model_name)

    def _is_compatible_with_model(self, result: dict, target_model: str) -> bool:
        """Check if HuggingFace result is compatible with target model."""
        model_keywords = {
            "LTXV2": ["ltx", "ltx-video", "ltx2", "ltxv", "lightricks"],
            "Wan Video": ["wan", "wan2.1", "wan2.2", "wanvideo"],
        }

        keywords = model_keywords.get(target_model, [])
        if not keywords:
            return True  # Unknown model, allow all

        # Check repo_id, name, tags
        searchable = (
            result.get("repo_id", "").lower() + " " +
            result.get("name", "").lower() + " " +
            " ".join(result.get("tags", [])).lower()
        )

        return any(kw in searchable for kw in keywords)

    async def _generate_search_terms(self, query: str, base_model: str) -> list:
        """Legacy function - now calls _parse_user_query for backwards compatibility."""
        parsed = await self._parse_user_query(query, base_model)
        return parsed.get("search_terms", self._simple_translate(query))

    def _simple_translate(self, query: str) -> list:
        """Simple keyword translation as fallback."""
        translations = {
            "피부": "skin",
            "질감": "texture",
            "디테일": "detail",
            "카메라": "camera",
            "움직임": "motion",
            "줌": "zoom",
            "부드러운": "smooth",
            "시네마틱": "cinematic",
            "스타일": "style",
            "애니메이션": "animation",
            "물결": "wave",
            "불": "fire",
            "빛": "light",
            "사람": "person",
            "얼굴": "face",
            "현실적": "realistic",
            "사실적": "realistic",
        }

        terms = []
        for ko, en in translations.items():
            if ko in query:
                terms.append(en)

        return terms if terms else ["video", "lora"]

    async def _search_huggingface_multi(self, search_terms: list, model_filter: str) -> list:
        """Search HuggingFace with multiple search term combinations.

        Args:
            search_terms: Clean search terms (no model name)
            model_filter: Normalized model filter (e.g., "LTX Video", "Wan Video")
        """
        # Map normalized model names to HuggingFace search keywords
        model_keywords = {
            "LTXV2": ["ltx", "ltx-video", "ltx2"],
            "Wan Video": ["wan", "wan2.1", "wan2.2"],
        }

        keywords = model_keywords.get(model_filter, [])
        all_results = {}

        logger.info("[HF Search] Using model keywords: %s", keywords)
        logger.info("[HF Search] Using search terms: %s", search_terms)

        try:
            async with aiohttp.ClientSession() as session:
                # Try different search combinations
                search_queries = []

                # Strategy: Use model keyword to find compatible LoRAs
                # Combination 1: model keyword + search terms + lora
                for term in search_terms[:3]:
                    for kw in keywords[:2]:
                        search_queries.append(f"{kw} {term} lora")

                # Combination 2: model keyword + lora + video (general search)
                for kw in keywords[:2]:
                    search_queries.append(f"{kw} lora video")

                # Combination 3: search terms + lora + video (broader search)
                for term in search_terms[:2]:
                    search_queries.append(f"{term} lora video")

                logger.debug("[HF Search] Queries: %s", search_queries[:6])

                for search_query in search_queries[:6]:  # Limit to 6 searches
                    results = await self._do_hf_search(session, search_query)
                    for r in results:
                        if r["repo_id"] not in all_results:
                            all_results[r["repo_id"]] = r

                    if len(all_results) >= 5:
                        break

        except Exception as e:
            logger.error("[HF Search] Multi-search error: %s", e)

        # Sort by downloads and return top 5
        sorted_results = sorted(all_results.values(), key=lambda x: x.get("downloads", 0), reverse=True)
        return sorted_results[:5]

    async def _do_hf_search(self, session: aiohttp.ClientSession, search_query: str) -> list:
        """Perform a single HuggingFace search."""
        results = []
        api_url = "https://huggingface.co/api/models"
        params = {
            "search": search_query,
            "limit": 10,
            "sort": "downloads",
            "direction": "-1"
        }

        try:
            async with session.get(api_url, params=params) as response:
                if response.status != 200:
                    return []

                models = await response.json()

                for model in models[:5]:
                    model_id = model.get("modelId", "")
                    tags = model.get("tags", [])

                    # Check if it has safetensors (likely a LoRA)
                    has_safetensors = any("safetensors" in t.lower() for t in tags)
                    is_lora = "lora" in model_id.lower() or "lora" in " ".join(tags).lower()

                    if has_safetensors or is_lora:
                        detail = await self._get_model_details(session, model_id)
                        if detail:
                            results.append(detail)
                            if len(results) >= 2:
                                break

        except Exception as e:
            logger.error("HF search error for '%s': %s", search_query, e)

        return results

    async def _search_huggingface(self, query: str, model_filter: str) -> list:
        """Search HuggingFace API for real LoRAs (fallback).

        Args:
            query: Original user query (Korean or English)
            model_filter: Normalized model filter (e.g., "LTX Video", "Wan Video")
        """

        # Build search queries based on normalized model filter
        model_keywords = {
            "LTXV2": ["ltx", "ltx-video", "ltx2", "lightricks"],
            "Wan Video": ["wan", "wan2.1", "wan2.2", "wanvideo"],
        }

        keywords = model_keywords.get(model_filter, ["video", "lora"])

        # Translate common Korean effects to English for search
        effect_translations = {
            "카메라": "camera",
            "움직임": "motion",
            "줌": "zoom",
            "부드러운": "smooth",
            "시네마틱": "cinematic",
            "피부": "skin",
            "디테일": "detail",
            "스타일": "style",
            "애니메이션": "animation",
            "물결": "wave",
            "불": "fire",
            "빛": "light",
        }

        search_terms = []
        for ko, en in effect_translations.items():
            if ko in query:
                search_terms.append(en)

        # Combine with model keywords
        search_query = " ".join(keywords[:2] + search_terms[:2] + ["lora", "video"])

        results = []

        try:
            async with aiohttp.ClientSession() as session:
                # Search HuggingFace models API
                api_url = "https://huggingface.co/api/models"
                params = {
                    "search": search_query,
                    "filter": "lora",
                    "limit": 20,
                    "sort": "downloads",
                    "direction": "-1"
                }

                async with session.get(api_url, params=params) as response:
                    if response.status != 200:
                        logger.warning("HuggingFace API error: %d", response.status)
                        return []

                    models = await response.json()

                # Filter for video-related LoRAs
                for model in models[:10]:  # Check top 10
                    model_id = model.get("modelId", "")
                    tags = model.get("tags", [])

                    # Check if it's likely a video LoRA
                    model_lower = model_id.lower()
                    tags_lower = [t.lower() for t in tags]

                    is_video_related = any(kw in model_lower or kw in " ".join(tags_lower)
                                          for kw in ["video", "animation", "motion", "ltx", "wan", "camera"])

                    is_lora = "lora" in tags_lower or "lora" in model_lower

                    if is_lora or is_video_related:
                        # Verify the repo exists and get more details
                        detail = await self._get_model_details(session, model_id)
                        if detail:
                            results.append(detail)
                            if len(results) >= 3:
                                break

                # If no results, try alternative search
                if not results:
                    # Try searching for the specific base model using keywords
                    model_keyword = keywords[0] if keywords else "video"
                    alt_params = {
                        "search": f"{model_keyword} lora",
                        "limit": 10,
                        "sort": "downloads",
                        "direction": "-1"
                    }

                    async with session.get(api_url, params=alt_params) as response:
                        if response.status == 200:
                            models = await response.json()
                            for model in models[:5]:
                                model_id = model.get("modelId", "")
                                detail = await self._get_model_details(session, model_id)
                                if detail:
                                    results.append(detail)
                                    if len(results) >= 3:
                                        break

        except Exception as e:
            logger.error("HuggingFace search error: %s", e)

        return results

    async def _get_model_details(self, session: aiohttp.ClientSession, model_id: str) -> Optional[dict]:
        """Get detailed info about a HuggingFace model."""
        try:
            api_url = f"https://huggingface.co/api/models/{model_id}"

            async with session.get(api_url) as response:
                if response.status != 200:
                    return None

                data = await response.json()

                # Get file info
                siblings = data.get("siblings", [])
                safetensor_files = [s for s in siblings if s.get("rfilename", "").endswith(".safetensors")]

                total_size = sum(s.get("size", 0) for s in safetensor_files) if safetensor_files else 0

                return {
                    "name": model_id.split("/")[-1],
                    "repo_id": model_id,
                    "url": f"https://huggingface.co/{model_id}",
                    "description_ko": data.get("description", "")[:200] if data.get("description") else "설명 없음",
                    "effect_type": self._detect_effect_type(model_id, data.get("tags", [])),
                    "estimated_size_mb": round(total_size / (1024 * 1024)) if total_size else 100,
                    "compatibility_note": "",
                    "thumbnail": None,
                    "downloads": data.get("downloads", 0),
                    "tags": data.get("tags", [])
                }

        except Exception as e:
            logger.error("Error getting model details for %s: %s", model_id, e)
            return None

    def _detect_effect_type(self, model_id: str, tags: list) -> str:
        """Detect the effect type from model info."""
        combined = (model_id + " " + " ".join(tags)).lower()

        if any(kw in combined for kw in ["camera", "zoom", "pan", "dolly"]):
            return "camera"
        if any(kw in combined for kw in ["style", "aesthetic", "cinematic"]):
            return "style"
        if any(kw in combined for kw in ["motion", "movement", "animation"]):
            return "motion"
        if any(kw in combined for kw in ["character", "person", "face", "skin"]):
            return "character"

        return "style"

    async def _add_descriptions(self, results: list, query: str, base_model: str) -> list:
        """Use Gemini to add Korean descriptions to search results."""
        if not results:
            return results

        # Build prompt for descriptions
        results_info = "\n".join([
            f"- {r['name']} ({r['repo_id']}): tags={r.get('tags', [])}"
            for r in results
        ])

        prompt = f"""사용자가 "{query}" 효과를 원합니다. 대상 모델: {base_model}

다음 LoRA들에 대해 한국어 설명을 작성해주세요:
{results_info}

각 LoRA에 대해 2-3문장으로 설명하고, {base_model} 모델과의 호환성 참고사항도 추가해주세요.

JSON 형식으로만 응답:
{{
  "descriptions": [
    {{
      "repo_id": "owner/repo-name",
      "description_ko": "한국어 설명",
      "compatibility_note": "호환성 참고사항"
    }}
  ]
}}"""

        try:
            response = await self.model.generate_content_async(prompt)

            # Parse response
            cleaned = response.text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            data = json.loads(cleaned)
            descriptions = {d["repo_id"]: d for d in data.get("descriptions", [])}

            # Update results with descriptions
            for result in results:
                repo_id = result["repo_id"]
                if repo_id in descriptions:
                    result["description_ko"] = descriptions[repo_id].get("description_ko", result["description_ko"])
                    result["compatibility_note"] = descriptions[repo_id].get("compatibility_note", "")

        except Exception as e:
            logger.error("Error adding descriptions: %s", e)
            # Keep original results without enhanced descriptions

        return results



# Singleton instance
_searcher: Optional[AILoraSearcher] = None


def get_ai_searcher() -> AILoraSearcher:
    """Get or create the AI searcher singleton."""
    global _searcher
    if _searcher is None:
        _searcher = AILoraSearcher()
    return _searcher
