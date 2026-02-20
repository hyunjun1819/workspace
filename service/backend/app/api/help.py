"""Help API endpoints with Gemini chat integration."""

import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import google.generativeai as genai

from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Workflows directory
WORKFLOWS_DIR = Path("/opt/comfyui-server/workflows")

# System prompt for ComfyUI workflow helper
WORKFLOW_HELPER_PROMPT = """당신은 ComfyUI를 처음 쓰는 사람을 돕는 친절한 도우미입니다.

## 대상
- 컴퓨터 전공자가 아닌 일반인
- AI 영상 생성을 처음 접하는 사람
- "노드", "JSON", "파라미터" 같은 용어를 모르는 사람

## 설명 방식
1. **비유로 설명**: "Noise Seed는 요리의 레시피 번호 같은 것입니다. 같은 번호면 같은 맛이 나요."
2. **화면 기준으로 안내**: "화면 왼쪽에 있는 초록색 박스에서..."
3. **클릭 순서로 안내**: "① 먼저 Samplers 박스를 클릭하세요 → ② noise_seed 칸을 찾으세요 → ③ 숫자를 바꾸세요"
4. **전문용어 금지**: "Latent" → "AI가 이해하는 이미지", "CFG" → "프롬프트 반영 강도"

## 답변 형식
- 핵심만 먼저 (3줄 이내)
- 그 다음 "더 자세히 알고 싶다면" 섹션에서 부가 설명
- 기술적 배경은 생략하거나 맨 마지막에 짧게

## 예시
❌ "RandomNoise 노드에서 noise_seed 값을 수정합니다"
✅ "영상의 분위기를 바꾸고 싶으면, 'Samplers' 박스 안에 있는 숫자(noise_seed)를 다른 숫자로 바꿔보세요. 숫자가 다르면 다른 느낌의 영상이 나와요."

## 워크플로우 JSON
아래는 사용자가 선택한 워크플로우입니다:

"""


class ChatRequest(BaseModel):
    """Request model for help chat."""
    workflow_id: str
    question: str


class ChatResponse(BaseModel):
    """Response model for help chat."""
    answer: str
    workflow_name: str


class WorkflowInfo(BaseModel):
    """Workflow info model."""
    id: str
    name: str
    filename: str


def _get_workflow_list() -> list[WorkflowInfo]:
    """Get list of available workflows."""
    workflows = []

    if not WORKFLOWS_DIR.exists():
        return workflows

    for file in sorted(WORKFLOWS_DIR.glob("*.json")):
        # Skip backup files
        if file.name.startswith(".") or "_backup" in file.name:
            continue

        # Create a clean ID from filename
        workflow_id = file.stem

        # Create a readable name
        name = file.stem
        # Clean up common prefixes
        if name.startswith("(LTX2)"):
            name = f"LTX-2: {name[6:]}"
        elif name.startswith("LTX-2_"):
            name = f"LTX-2: {name[6:]}"
        elif name.startswith("Wan22"):
            name = f"Wan2.2: {name[5:]}"
        elif name.startswith("Qwen"):
            name = f"Qwen: {name}"

        workflows.append(WorkflowInfo(
            id=workflow_id,
            name=name,
            filename=file.name
        ))

    return workflows


def _load_workflow(workflow_id: str) -> tuple[dict, str]:
    """Load workflow JSON by ID. Returns (workflow_dict, display_name)."""
    workflow_path = WORKFLOWS_DIR / f"{workflow_id}.json"

    if not workflow_path.exists():
        raise HTTPException(404, f"워크플로우를 찾을 수 없습니다: {workflow_id}")

    try:
        with open(workflow_path, "r", encoding="utf-8") as f:
            workflow = json.load(f)
        return workflow, workflow_id
    except json.JSONDecodeError:
        raise HTTPException(400, f"워크플로우 파일이 손상되었습니다: {workflow_id}")


@router.get("/workflows")
async def list_workflows():
    """List all available workflows."""
    workflows = _get_workflow_list()
    return {"workflows": [w.model_dump() for w in workflows]}


@router.post("/chat")
async def chat_with_workflow(request: ChatRequest):
    """
    Chat with Gemini about a specific workflow.

    The workflow JSON is automatically attached to the context.
    """
    if not request.question.strip():
        raise HTTPException(400, "질문을 입력해주세요")

    if not request.workflow_id:
        raise HTTPException(400, "워크플로우를 선택해주세요")

    # Load workflow
    workflow, workflow_name = _load_workflow(request.workflow_id)

    # Build prompt - 전체 워크플로우 JSON 첨부 (사용자 요청)
    full_prompt = WORKFLOW_HELPER_PROMPT + json.dumps(workflow, ensure_ascii=False, indent=2)
    full_prompt += f"\n\n## 사용자 질문\n{request.question}"

    # Try with primary key first, then fallback
    api_keys = [k for k in [settings.google_api_key, settings.google_api_key_fallback] if k]
    if not api_keys:
        raise HTTPException(500, "Gemini API 키가 설정되지 않았습니다")

    last_error = None
    for i, api_key in enumerate(api_keys):
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-3-flash-preview')
            response = model.generate_content(full_prompt)
            answer = response.text
            if i > 0:
                logger.info("Fallback key #%d succeeded", i+1)
            break
        except Exception as e:
            last_error = e
            error_str = str(e)
            logger.warning("Key #%d failed: %s", i+1, error_str[:100])
            # If rate limited (429), try next key
            if "429" in error_str or "Resource exhausted" in error_str:
                continue
            # For other errors, don't retry
            raise HTTPException(500, f"AI 응답 생성 실패: {error_str}")
    else:
        # All keys exhausted
        raise HTTPException(500, f"모든 API 키 할당량 초과. 잠시 후 다시 시도해주세요. ({last_error})")

    return ChatResponse(
        answer=answer,
        workflow_name=workflow_name
    )


