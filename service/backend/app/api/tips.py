"""Tips API endpoints with AI prompt converter."""

import logging
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# Wan2.2 시스템 프롬프트
WAN_SYSTEM_PROMPT = """당신은 Wan2.2 비디오 생성 모델의 프롬프트 전문가입니다.
사용자의 영상 아이디어를 실사(포토리얼리스틱) 스타일로 변환하세요.

## 중요: 언어 처리
- 사용자가 한국어로 입력해도 **반드시 영어로 프롬프트를 작성**하세요.
- 한국어 입력을 이해하고, 영어 프롬프트로 변환하세요.

## 필수 포함 요소 (반드시 프롬프트에 넣으세요)
- 피부 텍스처: visible pores, detailed skin texture, natural imperfections, fine microtexture
- 조명: soft diffused lighting, rim lighting, edge lighting
- 렌즈: 85mm portrait lens, shallow depth of field, cinematic bokeh
- 색감: Kodak Portra color grading, cinematic mood
- 카메라 움직임: slowly pushes forward / pans left / dolly out 등

## 금지 단어 (절대 사용 금지)
beautiful, perfect, flawless, smooth skin, stunning, gorgeous, ideal

## 프롬프트 구조 (이 순서로 작성)
1. 인물 설명 (인종/나이/성별 + natural skin texture, visible pores)
2. 의상과 상황
3. 환경 설명
4. 조명 설정 (soft diffused lighting with rim light)
5. 렌즈 설정 (85mm lens with shallow depth of field)
6. 카메라 움직임 (Camera slowly...)
7. 색감 (Kodak Portra color grading, cinematic mood)

## 출력 형식
반드시 아래 형식으로만 출력하세요. 다른 설명 없이 이 형식만 출력:

[PROMPT]
(여기에 변환된 프롬프트 80-120단어)
[/PROMPT]

[NEGATIVE]
plastic skin, airbrushed, overly smooth, doll-like, waxy face, low quality, overexposed, bright colors
[/NEGATIVE]

## 사용자 입력
"""


# LTX2 시스템 프롬프트
LTX_SYSTEM_PROMPT = """당신은 LTX-Video 2.0 비디오 생성 모델의 프롬프트 전문가입니다.
사용자의 영상 아이디어를 실사(포토리얼리스틱) 스타일로 변환하세요.

## 중요: 언어 처리
- 사용자가 한국어로 입력해도 **반드시 영어로 프롬프트를 작성**하세요.
- 한국어 입력을 이해하고, 영어 프롬프트로 변환하세요.

## 필수 포함 요소 (반드시 프롬프트에 넣으세요)
- 피부 텍스처: authentic skin texture, crisp detail, no mushy surfaces, pore detail
- 렌즈 (필수!): 50mm f/2.8 또는 85mm f/2.0 또는 100mm macro f/4
- 조명: strong natural sunlight from side, soft rim light, edge/rim light separation
- 안정성: minimal micro-jitter, no shimmer, static tripod-locked
- 기술 스펙: 24fps, 180-degree shutter, natural motion blur

## 금지 단어 (절대 사용 금지)
beautiful, perfect, flawless, stunning, gorgeous, ideal

## 프롬프트 구조 (이 순서로 작성)
1. 인물 설명 (인종/나이/성별 + authentic skin texture, visible pores)
2. 의상과 외모
3. 환경 설정
4. 조명 (strong natural sunlight from side...)
5. 렌즈 스펙 (50mm f/2.8...) - 필수!
6. 카메라 움직임 (Slow dolly in / static tripod-locked)
7. 색감과 기술 스펙 (Kodak Portra aesthetic, 24fps...)

## 출력 형식
반드시 아래 형식으로만 출력하세요. 다른 설명 없이 이 형식만 출력:

[PROMPT]
(여기에 변환된 프롬프트, 200자 이하로 간결하게)
[/PROMPT]

[NEGATIVE]
jitter, texture shifts, plastic skin, blur artifacts, high-frequency patterns, oversaturation
[/NEGATIVE]

## 사용자 입력
"""


class ConvertRequest(BaseModel):
    """Request model for prompt conversion."""
    model_type: str  # "wan2.2" | "ltx2"
    user_prompt: str


class ConvertResponse(BaseModel):
    """Response model for prompt conversion."""
    converted_prompt: str
    negative_prompt: str


def _parse_response(response_text: str) -> tuple[str, str]:
    """Parse AI response to extract prompt and negative."""
    # Extract prompt
    prompt_match = re.search(r'\[PROMPT\](.*?)\[/PROMPT\]', response_text, re.DOTALL)
    prompt = prompt_match.group(1).strip() if prompt_match else response_text.strip()

    # Extract negative
    negative_match = re.search(r'\[NEGATIVE\](.*?)\[/NEGATIVE\]', response_text, re.DOTALL)
    if negative_match:
        negative = negative_match.group(1).strip()
    else:
        # Default negatives if not found
        negative = "plastic skin, airbrushed, doll-like, low quality"

    return prompt, negative


@router.post("/convert", response_model=ConvertResponse)
async def convert_prompt(request: ConvertRequest):
    """
    Convert user prompt to photorealistic style for Wan2.2 or LTX2.
    """
    if not request.user_prompt.strip():
        raise HTTPException(400, "프롬프트를 입력해주세요")

    if request.model_type not in ["wan2.2", "ltx2"]:
        raise HTTPException(400, "지원하지 않는 모델입니다. wan2.2 또는 ltx2를 선택하세요.")

    # Select system prompt based on model
    if request.model_type == "wan2.2":
        system_prompt = WAN_SYSTEM_PROMPT
    else:
        system_prompt = LTX_SYSTEM_PROMPT

    full_prompt = system_prompt + request.user_prompt

    # Try with primary key first, then fallback
    api_keys = [k for k in [settings.google_api_key, settings.google_api_key_fallback] if k]
    if not api_keys:
        raise HTTPException(500, "Gemini API 키가 설정되지 않았습니다")

    last_error = None
    for i, api_key in enumerate(api_keys):
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-2.0-flash')
            response = model.generate_content(full_prompt)
            answer = response.text
            if i > 0:
                logger.info("Fallback key #%d succeeded for tips/convert", i+1)
            break
        except Exception as e:
            last_error = e
            error_str = str(e)
            logger.warning("Key #%d failed for tips/convert: %s", i+1, error_str[:100])
            # If rate limited (429), try next key
            if "429" in error_str or "Resource exhausted" in error_str:
                continue
            # For other errors, don't retry
            raise HTTPException(500, f"AI 응답 생성 실패: {error_str}")
    else:
        # All keys exhausted
        raise HTTPException(500, f"모든 API 키 할당량 초과. 잠시 후 다시 시도해주세요. ({last_error})")

    # Parse response
    converted_prompt, negative_prompt = _parse_response(answer)

    return ConvertResponse(
        converted_prompt=converted_prompt,
        negative_prompt=negative_prompt
    )
