# LoRA 추천 시스템 완전 가이드

> 마지막 업데이트: 2026-02-10
> 이 문서는 LoRA 추천 시스템의 A부터 Z까지 모든 동작 원리를 설명합니다.

---

## 목차

1. [시스템 아키텍처](#1-시스템-아키텍처)
2. [데이터 흐름 전체 다이어그램](#2-데이터-흐름-전체-다이어그램)
3. [프론트엔드 상세](#3-프론트엔드-상세)
4. [백엔드 API 상세](#4-백엔드-api-상세)
5. [서비스 레이어 상세](#5-서비스-레이어-상세)
6. [HuggingFace API 연동](#6-huggingface-api-연동)
7. [Gemini AI 한국어 설명 생성](#7-gemini-ai-한국어-설명-생성)
8. [품질 필터링 로직](#8-품질-필터링-로직)
9. [다운로드 프로세스](#9-다운로드-프로세스)
10. [TypeScript 타입 정의](#10-typescript-타입-정의)
11. [실제 API 응답 예시](#11-실제-api-응답-예시)
12. [서버 로그 예시](#12-서버-로그-예시)

---

## 1. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            사용자 브라우저                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    AISearchModal.tsx (React)                         │   │
│  │  - 베이스 모델 선택 (LTX-2, Wan2.2-T2V, Wan2.2-I2V)                  │   │
│  │  - 정렬 기준 선택 (downloads, likes, trendingScore)                  │   │
│  │  - 결과 목록 표시 (순위 배지, 통계, 한국어 설명)                       │   │
│  │  - 다운로드 진행률 표시                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP POST / WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FastAPI 백엔드 (port 8189)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    app/api/ai_search.py (Router)                     │   │
│  │  - POST /api/ai-search/trending       → 트렌딩 LoRA 조회             │   │
│  │  - POST /api/ai-search/search         → 레거시 (trending 리다이렉트) │   │
│  │  - POST /api/ai-search/validate-external → URL 검증                 │   │
│  │  - WS   /api/ai-search/ws/download-external → 다운로드               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                app/services/ai_search.py (Service)                   │   │
│  │  - AILoraSearcher 클래스 (싱글톤)                                    │   │
│  │  - get_trending_loras() → HuggingFace 검색 + 품질 필터               │   │
│  │  - _add_trending_descriptions() → Gemini로 한국어 설명 생성          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │  HuggingFace API  │           │   Google Gemini   │
        │  (LoRA 검색)       │           │   (한국어 설명)    │
        │                   │           │                   │
        │  api/models       │           │  gemini-2.0-flash │
        │  - search         │           │                   │
        │  - sort           │           │                   │
        │  - siblings       │           │                   │
        └───────────────────┘           └───────────────────┘
```

---

## 2. 데이터 흐름 전체 다이어그램

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 1: 모달 오픈                                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ 사용자가 "인기 LoRA" 버튼 클릭                                                 │
│     ↓                                                                        │
│ AISearchModal isOpen=true                                                    │
│     ↓                                                                        │
│ useEffect 트리거 → loadTrending() 자동 호출                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 2: API 호출                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ fetch('/api/ai-search/trending', {                                           │
│   method: 'POST',                                                            │
│   body: { base_model: "LTX-2", sort_by: "downloads" }                        │
│ })                                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 3: 백엔드 API Router                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ @router.post("/trending")                                                    │
│ async def get_trending_loras(request: TrendingRequest):                      │
│     searcher = get_ai_searcher()  # 싱글톤 인스턴스                           │
│     result = await searcher.get_trending_loras(                              │
│         request.base_model,       # "LTX-2"                                  │
│         sort_by=request.sort_by   # "downloads"                              │
│     )                                                                        │
│     return {"success": True, "results": result["results"]}                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 4: 서비스 레이어 - get_trending_loras()                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4.1 모델 이름 정규화                                                          │
│     "LTX-2" → "ltx"                                                          │
│     "Wan2.2-T2V" → "wan"                                                     │
│                                                                              │
│ 4.2 HuggingFace API 호출 (_fetch_trending_hf)                                │
│     검색 쿼리 3개 시도:                                                       │
│     - "ltx lora video"                                                       │
│     - "ltx video lora"                                                       │
│     - "ltxvideo lora"                                                        │
│                                                                              │
│ 4.3 품질 필터링 (_validate_lora_quality)                                     │
│     - safetensors 파일 존재 여부만 확인                                       │
│                                                                              │
│ 4.4 상위 10개 선택                                                            │
│                                                                              │
│ 4.5 Gemini로 한국어 설명 추가 (_add_trending_descriptions)                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 5: HuggingFace API 호출 상세                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ GET https://huggingface.co/api/models                                        │
│ ?search=ltx+lora+video                                                       │
│ &sort=downloads                                                              │
│ &direction=-1                                                                │
│ &limit=30                                                                    │
│ &full=true                                                                   │
│                                                                              │
│ 응답에서 추출하는 정보:                                                        │
│ - modelId (repo_id)                                                          │
│ - downloads                                                                  │
│ - likes                                                                      │
│ - lastModified                                                               │
│ - tags                                                                       │
│ - siblings (파일 목록) → safetensors 존재 확인                                │
│ - cardData.description                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 6: 호환성 검증                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ _is_compatible_with_model_keyword(model, "ltx"):                             │
│                                                                              │
│ keyword_variants = {                                                         │
│     "ltx": ["ltx", "ltx-video", "ltx2", "ltxv", "lightricks"],              │
│     "wan": ["wan", "wan2", "wanvideo", "wan-video"],                        │
│ }                                                                            │
│                                                                              │
│ repo_id + tags에서 키워드 검색                                                │
│ → 하나라도 포함되면 호환                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 7: Gemini 한국어 설명 생성                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ 프롬프트:                                                                     │
│ """                                                                          │
│ 다음은 LTX-2 모델용 인기 LoRA 목록입니다.                                     │
│ 각 LoRA에 대해 간단한 한국어 설명을 작성해주세요.                              │
│                                                                              │
│ - amgery-lora-for-ltxv-13b: downloads=13, tags=[diffusers, lora, ltxv]      │
│ - LTX-video_lora_bullet_time: downloads=0, tags=[region:us]                 │
│ ...                                                                          │
│                                                                              │
│ JSON 형식으로만 응답:                                                         │
│ {                                                                            │
│   "descriptions": [                                                          │
│     {                                                                        │
│       "name": "lora-name",                                                   │
│       "description_ko": "이 LoRA의 효과에 대한 한국어 설명 (2-3문장)"         │
│     }                                                                        │
│   ]                                                                          │
│ }                                                                            │
│ """                                                                          │
│                                                                              │
│ 모델: gemini-2.0-flash                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ Step 8: 결과 반환 및 렌더링                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ API 응답:                                                                     │
│ {                                                                            │
│   "success": true,                                                           │
│   "results": [...],                                                          │
│   "error": null                                                              │
│ }                                                                            │
│                                                                              │
│ React 상태 업데이트:                                                          │
│ setResults(data.results)                                                     │
│                                                                              │
│ 렌더링:                                                                       │
│ - 순위 배지 (1~3위: 금색, 4위~: 회색)                                         │
│ - 이름, 효과 타입, HuggingFace 태그                                           │
│ - 한국어 설명                                                                 │
│ - 다운로드 수, 좋아요 수, 파일 크기                                            │
│ - HuggingFace 링크                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 프론트엔드 상세

### 파일 위치
`service/frontend/src/components/AISearchModal.tsx`

### 상태 관리

```typescript
// 선택된 베이스 모델
const [baseModel, setBaseModel] = useState('')

// 정렬 기준: 'downloads' | 'likes' | 'trendingScore'
const [sortBy, setSortBy] = useState<SortOption>('downloads')

// API 응답 결과
const [results, setResults] = useState<AISearchResult[]>([])

// 선택된 LoRA 인덱스 Set
const [selected, setSelected] = useState<Set<number>>(new Set())

// 로딩 상태
const [loading, setLoading] = useState(false)

// 에러 메시지
const [error, setError] = useState<string | null>(null)

// 다운로드 상태
const [downloading, setDownloading] = useState(false)
const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)

// WebSocket 참조
const wsRef = useRef<WebSocket | null>(null)
```

### 자동 로드 로직

```typescript
// 모달이 열리거나 설정이 변경되면 자동으로 트렌딩 로드
useEffect(() => {
  if (isOpen && baseModel) {
    loadTrending()
  }
}, [isOpen, baseModel, sortBy, loadTrending])
```

### API 호출 함수

```typescript
const loadTrending = useCallback(async () => {
  if (!baseModel) return

  setLoading(true)
  setError(null)
  setResults([])
  setSelected(new Set())

  try {
    const res = await fetch('/api/ai-search/trending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_model: baseModel, sort_by: sortBy })
    })

    const data = await res.json()

    if (!data.success) {
      setError(data.error || '로딩 실패')
      return
    }

    setResults(data.results || [])

    if (data.results.length === 0) {
      setError('인기 LoRA를 찾을 수 없습니다.')
    }
  } catch (err) {
    setError('로딩 중 오류가 발생했습니다')
  } finally {
    setLoading(false)
  }
}, [baseModel, sortBy])
```

### 숫자 포맷 함수

```typescript
const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'  // 1.5M
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'     // 2.3K
  }
  return num.toString()                       // 456
}
```

### UI 컴포넌트 구조

```
┌─────────────────────────────────────────────────────────────┐
│ Header: "🔥 인기 LoRA Top 10"                    [X] 닫기  │
├─────────────────────────────────────────────────────────────┤
│ Filters:                                                    │
│ [베이스 모델 선택 ▼]  [정렬 기준 ▼]  [🔄 새로고침]          │
│                                                             │
│ "HuggingFace에서 검증된 인기 LoRA만 표시됩니다"             │
├─────────────────────────────────────────────────────────────┤
│ Results:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [1] [☑] amgery-lora-for-ltxv-13b     [style] [HuggingFace] │
│ │     이 LoRA는 LTXV-13B 비디오 모델을 사용하여...         │ │
│ │     ⬇ 13  ♥ 0  📦 ~100MB           HuggingFace →        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [2] [☐] LTX-video_lora_bullet_time   [style] [HuggingFace] │
│ │     이 LoRA는 비디오에 '불릿 타임' 효과를 추가...        │ │
│ │     ⬇ 0   ♥ 0  📦 ~100MB           HuggingFace →        │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Download Progress (다운로드 중일 때만 표시):                 │
│ 다운로드 중: file.safetensors (1/2)                 45%     │
│ [████████████░░░░░░░░░░░░░░░░░░░░░]                         │
├─────────────────────────────────────────────────────────────┤
│ Footer (선택 시):                                            │
│ [      선택한 LoRA 다운로드 (2개, ~200MB)      ]            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 백엔드 API 상세

### 파일 위치
`service/backend/app/api/ai_search.py`

### Request/Response 모델

```python
class TrendingRequest(BaseModel):
    """Request model for trending LoRAs."""
    base_model: str                          # "LTX-2", "Wan2.2-T2V", "Wan2.2-I2V"
    sort_by: str = "downloads"               # "downloads", "likes", "trendingScore"


class DownloadExternalRequest(BaseModel):
    """Request model for downloading external LoRA."""
    url: str                                 # HuggingFace URL
    repo_id: str                             # "owner/repo-name"
    name: str                                # 표시 이름
    base_model: str                          # 대상 모델
    filename: Optional[str] = None           # 특정 파일 (없으면 자동 탐지)
```

### 엔드포인트 상세

#### POST /api/ai-search/trending

```python
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
    # 유효성 검사
    if not request.base_model:
        raise HTTPException(400, "베이스 모델을 선택해주세요")

    valid_sorts = ["downloads", "likes", "trendingScore"]
    if request.sort_by not in valid_sorts:
        raise HTTPException(400, f"sort_by는 {valid_sorts} 중 하나여야 합니다")

    # 서비스 호출
    searcher = get_ai_searcher()
    result = await searcher.get_trending_loras(request.base_model, sort_by=request.sort_by)

    if result.get("error"):
        return {"success": False, "error": result["error"], "results": []}

    return {"success": True, "results": result.get("results", []), "error": None}
```

#### POST /api/ai-search/search (레거시)

```python
@router.post("/search")
async def ai_search(request: SearchRequest):
    """
    AI-powered LoRA search (legacy endpoint).

    Now redirects to trending for better quality results.
    """
    # 트렌딩으로 리다이렉트
    searcher = get_ai_searcher()
    result = await searcher.get_trending_loras(request.base_model, sort_by="downloads")
    # ...
```

#### WebSocket /api/ai-search/ws/download-external

```python
@router.websocket("/ws/download-external")
async def download_external_lora(websocket: WebSocket):
    """
    Download LoRA from external HuggingFace URL via WebSocket.

    Provides real-time progress updates.

    Messages:
    - {"type": "status", "message": "..."} → 상태 메시지
    - {"type": "progress", "filename": "...", "progress": 45.2, ...} → 진행률
    - {"type": "complete", "message": "...", "files": [...]} → 완료
    - {"type": "error", "error": "..."} → 에러
    """
    await websocket.accept()

    try:
        # 요청 수신
        data = await websocket.receive_json()
        url = data.get("url")
        repo_id = data.get("repo_id")
        name = data.get("name", "Unknown LoRA")
        base_model = data.get("base_model")
        filename = data.get("filename")

        # URL 검증
        if not url or "huggingface.co" not in url:
            await websocket.send_json({"type": "error", "error": "잘못된 URL"})
            return

        # 다운로드할 파일 결정
        if not filename:
            files = await _get_repo_files(repo_id)
            safetensor_files = [f for f in files if f.endswith(".safetensors")]
            # ...

        # 파일 다운로드 (진행률 전송)
        for idx, file in enumerate(files_to_download):
            download_url = f"https://huggingface.co/{repo_id}/resolve/main/{file}"
            success = await _download_file(download_url, target_path, websocket, ...)
            # ...

        # 완료 메시지
        await websocket.send_json({
            "type": "complete",
            "message": f"{total_files}개 파일 다운로드 완료",
            "files": files_to_download
        })

    except WebSocketDisconnect:
        print("WebSocket disconnected during download")
```

---

## 5. 서비스 레이어 상세

### 파일 위치
`service/backend/app/services/ai_search.py`

### 클래스 구조

```python
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
        """Switch to fallback API key on rate limit."""
        if self.current_key != self.fallback_key and self.fallback_key:
            print("Switching to fallback API key due to rate limit...")
            self.current_key = self.fallback_key
            self._configure_api()
            return True
        return False
```

### 싱글톤 패턴

```python
# 모듈 레벨 싱글톤 인스턴스
_searcher: Optional[AILoraSearcher] = None


def get_ai_searcher() -> AILoraSearcher:
    """Get or create the AI searcher singleton."""
    global _searcher
    if _searcher is None:
        _searcher = AILoraSearcher()
    return _searcher
```

### 핵심 메서드: get_trending_loras()

```python
async def get_trending_loras(self, base_model: str, sort_by: str = "trendingScore") -> dict:
    """
    Get top 10 trending/popular video LoRAs for the specified base model.

    Args:
        base_model: Target model (LTX-2, Wan2.2-T2V, Wan2.2-I2V)
        sort_by: Sort method - "trendingScore", "downloads", or "likes"

    Returns:
        dict: {"results": [...], "error": None} or {"results": [], "error": "message"}
    """
    # Step 1: 모델 이름 정규화
    model_filter = self._normalize_base_model_hf(base_model)
    # "LTX-2" → "ltx"
    # "Wan2.2-T2V" → "wan"

    print(f"[Trending] Base model: {base_model} -> Filter: {model_filter}")
    print(f"[Trending] Sort by: {sort_by}")

    # Step 2: HuggingFace API 호출
    all_results = await self._fetch_trending_hf(model_filter, sort_by)

    # Step 3: 품질 필터 적용
    quality_results = [r for r in all_results if self._validate_lora_quality(r)]

    print(f"[Trending] Found {len(all_results)} total, {len(quality_results)} passed quality filter")

    # Step 4: 결과 없으면 에러 반환
    if not quality_results:
        return {"error": "인기 LoRA를 찾을 수 없습니다. 다른 모델을 선택해보세요.", "results": []}

    # Step 5: 상위 10개 선택
    top_results = quality_results[:10]

    # Step 6: Gemini로 한국어 설명 추가 (선택적)
    if self.model:
        results_with_desc = await self._add_trending_descriptions(top_results, base_model)
        return {"results": results_with_desc, "error": None}

    return {"results": top_results, "error": None}
```

---

## 6. HuggingFace API 연동

### API 호출 메서드

```python
async def _fetch_trending_hf(self, model_keyword: str, sort_by: str) -> list:
    """Fetch trending LoRAs from HuggingFace API."""
    results = []

    # 여러 검색 쿼리 시도
    search_queries = [
        f"{model_keyword} lora video",    # "ltx lora video"
        f"{model_keyword} video lora",    # "ltx video lora"
        f"{model_keyword}video lora",     # "ltxvideo lora"
    ]

    try:
        async with aiohttp.ClientSession() as session:
            seen_repos = set()  # 중복 방지

            for search_query in search_queries:
                api_url = "https://huggingface.co/api/models"
                params = {
                    "search": search_query,
                    "sort": sort_by,          # "downloads", "likes", "trendingScore"
                    "direction": "-1",         # 내림차순
                    "limit": 30,
                    "full": "true"             # 전체 정보 포함
                }

                async with session.get(api_url, params=params) as response:
                    if response.status != 200:
                        print(f"[HF API] Error {response.status} for '{search_query}'")
                        continue

                    models = await response.json()

                    for model in models:
                        repo_id = model.get("modelId", "")

                        # 중복 체크
                        if repo_id in seen_repos:
                            continue
                        seen_repos.add(repo_id)

                        # safetensors 파일 확인
                        siblings = model.get("siblings", [])
                        has_safetensors = any(
                            s.get("rfilename", "").endswith(".safetensors")
                            for s in siblings
                        )

                        if not has_safetensors:
                            continue

                        # 모델 호환성 확인
                        if not self._is_compatible_with_model_keyword(model, model_keyword):
                            continue

                        # 파일 크기 계산
                        safetensor_files = [s for s in siblings if s.get("rfilename", "").endswith(".safetensors")]
                        total_size = sum(s.get("size", 0) for s in safetensor_files)

                        # 결과 객체 생성
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

                # 충분한 결과가 있으면 중단
                if len(results) >= 30:
                    break

    except Exception as e:
        print(f"[HF Trending] Error: {e}")

    # 요청된 정렬 방식으로 재정렬
    if sort_by == "downloads":
        results = sorted(results, key=lambda x: x.get("downloads", 0), reverse=True)
    elif sort_by == "likes":
        results = sorted(results, key=lambda x: x.get("likes", 0), reverse=True)

    return results
```

### 호환성 검증 메서드

```python
def _is_compatible_with_model_keyword(self, model: dict, keyword: str) -> bool:
    """Check if HuggingFace model is compatible with target model keyword."""
    repo_id = model.get("modelId", "").lower()
    tags = [t.lower() for t in model.get("tags", [])]

    # repo_id와 tags에서 검색
    searchable = repo_id + " " + " ".join(tags)

    # 각 모델의 관련 키워드 정의
    keyword_variants = {
        "ltx": ["ltx", "ltx-video", "ltx2", "ltxv", "lightricks"],
        "wan": ["wan", "wan2", "wanvideo", "wan-video"],
    }

    variants = keyword_variants.get(keyword, [keyword])
    return any(v in searchable for v in variants)
```

### 효과 타입 감지

```python
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

    return "style"  # 기본값
```

---

## 7. Gemini AI 한국어 설명 생성

### 메서드 상세

```python
async def _add_trending_descriptions(self, results: list, base_model: str) -> list:
    """Use Gemini to add Korean descriptions to trending results."""
    if not results:
        return results

    # 결과 정보를 문자열로 변환
    results_info = "\n".join([
        f"- {r['name']}: downloads={r.get('downloads', 0)}, tags={r.get('tags', [])[:5]}"
        for r in results
    ])

    # 프롬프트 구성
    prompt = f"""다음은 {base_model} 모델용 인기 LoRA 목록입니다.
각 LoRA에 대해 간단한 한국어 설명을 작성해주세요.

{results_info}

JSON 형식으로만 응답:
{{
  "descriptions": [
    {{
      "name": "lora-name",
      "description_ko": "이 LoRA의 효과에 대한 한국어 설명 (2-3문장)"
    }}
  ]
}}"""

    try:
        # Gemini API 호출
        response = await self.model.generate_content_async(prompt)

        # 응답 정리 (마크다운 코드 블록 제거)
        cleaned = response.text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        # JSON 파싱
        data = json.loads(cleaned)
        desc_map = {d["name"]: d["description_ko"] for d in data.get("descriptions", [])}

        # 결과에 한국어 설명 추가
        for result in results:
            if result["name"] in desc_map:
                result["description_ko"] = desc_map[result["name"]]

    except Exception as e:
        print(f"[Trending] Error adding descriptions: {e}")
        # 에러 시 원본 유지

    return results
```

### Gemini 프롬프트 예시

```
다음은 LTX-2 모델용 인기 LoRA 목록입니다.
각 LoRA에 대해 간단한 한국어 설명을 작성해주세요.

- amgery-lora-for-ltxv-13b-0.9.7-video-model: downloads=13, tags=['diffusers', 'lora', 'ltxv', 'concept', 'license:mit']
- LTX-video_lora_bullet_time: downloads=0, tags=['region:us']
- ltx_video_anime_landscape_early_lora: downloads=0, tags=['region:us']
- ltx_video_pixel_early_lora: downloads=0, tags=['region:us']
- LTX-Video-Squish-LoRA: downloads=0, tags=['dataset:Lightricks/Squish-Dataset', 'base_model:Lightricks/LTX-Video', 'base_model:finetune:Lightricks/LTX-Video']

JSON 형식으로만 응답:
{
  "descriptions": [
    {
      "name": "lora-name",
      "description_ko": "이 LoRA의 효과에 대한 한국어 설명 (2-3문장)"
    }
  ]
}
```

### Gemini 응답 예시

```json
{
  "descriptions": [
    {
      "name": "amgery-lora-for-ltxv-13b-0.9.7-video-model",
      "description_ko": "이 LoRA는 LTXV-13B 비디오 모델을 사용하여 화가 난 감정을 표현하는 데 사용됩니다. 다운로드 수가 높은 것으로 보아, 해당 감정을 비디오에 효과적으로 적용하는 데 유용할 것으로 예상됩니다."
    },
    {
      "name": "LTX-video_lora_bullet_time",
      "description_ko": "이 LoRA는 비디오에 '불릿 타임' 효과를 추가하는 데 사용될 수 있습니다. 불릿 타임은 시간의 흐름을 느리게 보여주는 시각 효과로, 영화 등에서 자주 사용됩니다."
    },
    {
      "name": "ltx_video_anime_landscape_early_lora",
      "description_ko": "이 LoRA는 LTX 비디오 모델을 사용하여 애니메이션 풍경을 생성하는 데 사용될 수 있습니다. 'Early'라는 이름에서 초기 버전임을 알 수 있습니다."
    }
  ]
}
```

---

## 8. 품질 필터링 로직

### 현재 품질 기준 (완화됨)

```python
def _validate_lora_quality(self, model_data: dict) -> bool:
    """Validate that a LoRA meets minimum quality standards.

    Quality criteria (relaxed for emerging video LoRA ecosystem):
    - Must have safetensors file
    - No minimum downloads (LTX-Video is new technology)
    - No description requirement (HuggingFace repos often lack descriptions)
    """
    # safetensors 파일 필수 (fetch 단계에서 이미 필터링됨)
    if not model_data.get("has_safetensors", True):
        print(f"[Quality] Rejected {model_data.get('name')}: no safetensors")
        return False

    return True
```

### 이전 품질 기준 (엄격함 - 참고용)

```python
# 이전에 사용하던 엄격한 기준 (현재는 비활성화)

# 1. 최소 다운로드 50회
if model_data.get("downloads", 0) < 50:
    print(f"[Quality] Rejected {model_data.get('name')}: downloads < 50")
    return False

# 2. 설명 20자 이상
description = model_data.get("description_ko") or model_data.get("description") or ""
if len(description.strip()) < 20:
    print(f"[Quality] Rejected {model_data.get('name')}: description too short")
    return False

# 3. safetensors 파일 존재
if not model_data.get("has_safetensors", True):
    print(f"[Quality] Rejected {model_data.get('name')}: no safetensors")
    return False
```

### 필터 완화 이유

LTX-Video는 2025년 초에 출시된 신기술입니다. LoRA 생태계가 아직 초기 단계이므로:
- 대부분의 LoRA 다운로드 수가 50 미만
- HuggingFace 저장소에 설명이 없는 경우가 많음
- 사용 가능한 LoRA를 보여주는 것이 중요

---

## 9. 다운로드 프로세스

### 전체 흐름

```
1. 사용자가 LoRA 선택 → "선택한 LoRA 다운로드" 클릭
                    ↓
2. WebSocket 연결: ws://.../api/ai-search/ws/download-external
                    ↓
3. 다운로드 요청 전송:
   {
     "url": "https://huggingface.co/owner/repo",
     "repo_id": "owner/repo",
     "name": "LoRA Name",
     "base_model": "LTX-2"
   }
                    ↓
4. 서버: 저장소 파일 목록 조회
   GET https://huggingface.co/api/models/owner/repo
                    ↓
5. .safetensors 파일 필터링
                    ↓
6. Wan2.2 모델인 경우 MoE 쌍 확인 (HighNoise/LowNoise)
                    ↓
7. 파일 다운로드 시작
   https://huggingface.co/owner/repo/resolve/main/file.safetensors
                    ↓
8. 진행률 WebSocket 전송 (1MB 청크마다):
   {
     "type": "progress",
     "filename": "file.safetensors",
     "progress": 45.2,
     "file_index": 1,
     "total_files": 2,
     "downloaded": 47185920,
     "total": 104857600
   }
                    ↓
9. 다운로드 완료:
   {
     "type": "complete",
     "message": "2개 파일 다운로드 완료",
     "files": ["file1.safetensors", "file2.safetensors"]
   }
                    ↓
10. 파일 저장 위치: /opt/comfyui-server/models/loras/
```

### 다운로드 함수

```python
async def _download_file(
    url: str,
    target_path: Path,
    websocket: WebSocket,
    filename: str,
    file_index: int,
    total_files: int
) -> bool:
    """Download a file with progress updates."""

    try:
        # 부모 디렉토리 생성
        target_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    return False

                total_size = int(response.headers.get("content-length", 0))
                downloaded = 0

                with open(target_path, "wb") as f:
                    async for chunk in response.content.iter_chunked(1024 * 1024):  # 1MB 청크
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
        print(f"Download error: {e}")
        return False
```

---

## 10. TypeScript 타입 정의

### 파일 위치
`service/frontend/src/types/index.ts`

```typescript
export interface AISearchResult {
  name: string;                    // LoRA 이름 (repo_id의 마지막 부분)
  repo_id: string;                 // "owner/repo-name"
  url: string;                     // HuggingFace URL
  description_ko: string;          // 한국어 설명 (Gemini 생성)
  effect_type: string;             // "style", "camera", "motion", "character"
  estimated_size_mb: number;       // 파일 크기 (MB)
  compatibility_note: string;      // 호환성 메모 (예: "LTX 모델 호환")
  thumbnail: string | null;        // 썸네일 (현재 미사용)
  source?: 'huggingface';          // 소스 (HuggingFace만)
  download_url?: string;           // 다운로드 URL (선택적)

  // 트렌딩 통계
  downloads?: number;              // 다운로드 수
  likes?: number;                  // 좋아요 수
  last_modified?: string;          // 최종 수정일 (ISO 8601)
}

export interface AISearchResponse {
  success: boolean;                // 성공 여부
  results: AISearchResult[];       // 결과 배열
  error: string | null;            // 에러 메시지
}
```

---

## 11. 실제 API 응답 예시

### 요청

```bash
curl -X POST http://localhost:8189/api/ai-search/trending \
  -H "Content-Type: application/json" \
  -d '{"base_model": "LTX-2", "sort_by": "downloads"}'
```

### 응답

```json
{
  "success": true,
  "results": [
    {
      "name": "amgery-lora-for-ltxv-13b-0.9.7-video-model",
      "repo_id": "Burgstall/amgery-lora-for-ltxv-13b-0.9.7-video-model",
      "url": "https://huggingface.co/Burgstall/amgery-lora-for-ltxv-13b-0.9.7-video-model",
      "description_ko": "이 LoRA는 LTXV-13B 비디오 모델을 사용하여 화가 난 감정을 표현하는 데 사용됩니다. 다운로드 수가 높은 것으로 보아, 해당 감정을 비디오에 효과적으로 적용하는 데 유용할 것으로 예상됩니다.",
      "description": "",
      "effect_type": "style",
      "estimated_size_mb": 100,
      "compatibility_note": "LTX 모델 호환",
      "thumbnail": null,
      "downloads": 13,
      "likes": 0,
      "tags": [
        "diffusers",
        "lora",
        "ltxv",
        "concept",
        "license:mit",
        "region:us"
      ],
      "source": "huggingface",
      "has_safetensors": true,
      "last_modified": "2025-05-08T13:14:17.000Z"
    },
    {
      "name": "LTX-video_lora_bullet_time",
      "repo_id": "eisneim/LTX-video_lora_bullet_time",
      "url": "https://huggingface.co/eisneim/LTX-video_lora_bullet_time",
      "description_ko": "이 LoRA는 비디오에 '불릿 타임' 효과를 추가하는 데 사용될 수 있습니다. 불릿 타임은 시간의 흐름을 느리게 보여주는 시각 효과로, 영화 등에서 자주 사용됩니다.",
      "description": "",
      "effect_type": "style",
      "estimated_size_mb": 100,
      "compatibility_note": "LTX 모델 호환",
      "thumbnail": null,
      "downloads": 0,
      "likes": 0,
      "tags": [
        "region:us"
      ],
      "source": "huggingface",
      "has_safetensors": true,
      "last_modified": "2025-02-14T04:57:58.000Z"
    },
    {
      "name": "ltx_video_anime_landscape_early_lora",
      "repo_id": "svjack/ltx_video_anime_landscape_early_lora",
      "url": "https://huggingface.co/svjack/ltx_video_anime_landscape_early_lora",
      "description_ko": "이 LoRA는 LTX 비디오 모델을 사용하여 애니메이션 풍경을 생성하는 데 사용될 수 있습니다. 'Early'라는 이름에서 초기 버전임을 알 수 있습니다.",
      "description": "",
      "effect_type": "style",
      "estimated_size_mb": 100,
      "compatibility_note": "LTX 모델 호환",
      "thumbnail": null,
      "downloads": 0,
      "likes": 1,
      "tags": [
        "region:us"
      ],
      "source": "huggingface",
      "has_safetensors": true,
      "last_modified": "2025-02-22T06:23:07.000Z"
    },
    {
      "name": "ltx_video_pixel_early_lora",
      "repo_id": "svjack/ltx_video_pixel_early_lora",
      "url": "https://huggingface.co/svjack/ltx_video_pixel_early_lora",
      "description_ko": "이 LoRA는 LTX 비디오 모델을 사용하여 픽셀 아트 스타일의 비디오를 생성하는 데 사용될 수 있습니다. 역시 'Early'라는 이름에서 초기 버전임을 알 수 있습니다.",
      "description": "",
      "effect_type": "style",
      "estimated_size_mb": 100,
      "compatibility_note": "LTX 모델 호환",
      "thumbnail": null,
      "downloads": 0,
      "likes": 0,
      "tags": [
        "region:us"
      ],
      "source": "huggingface",
      "has_safetensors": true,
      "last_modified": "2025-02-22T12:42:46.000Z"
    },
    {
      "name": "LTX-Video-Squish-LoRA",
      "repo_id": "Lightricks/LTX-Video-Squish-LoRA",
      "url": "https://huggingface.co/Lightricks/LTX-Video-Squish-LoRA",
      "description_ko": "이 LoRA는 LTX 비디오 모델을 사용하여 'Squish' 데이터셋 기반으로 특정 효과를 적용하는 데 사용됩니다. 데이터셋 이름에서 유추해볼 때, 비디오 내 객체를 찌그러뜨리거나 변형하는 효과와 관련 있을 수 있습니다.",
      "description": "",
      "effect_type": "style",
      "estimated_size_mb": 100,
      "compatibility_note": "LTX 모델 호환",
      "thumbnail": null,
      "downloads": 0,
      "likes": 14,
      "tags": [
        "dataset:Lightricks/Squish-Dataset",
        "base_model:Lightricks/LTX-Video",
        "base_model:finetune:Lightricks/LTX-Video"
      ],
      "source": "huggingface",
      "has_safetensors": true,
      "last_modified": "2025-03-15T10:22:33.000Z"
    }
  ],
  "error": null
}
```

---

## 12. 서버 로그 예시

### 정상 동작 시

```
[Trending] Base model: LTX-2 -> Filter: ltx
[Trending] Sort by: downloads
[Trending] Found 12 total, 12 passed quality filter
INFO:     127.0.0.1:49982 - "POST /api/ai-search/trending HTTP/1.1" 200 OK
```

### 품질 필터 거부 시 (이전 엄격 기준)

```
[Trending] Base model: LTX-2 -> Filter: ltx
[Trending] Sort by: downloads
[Quality] Rejected amgery-lora-for-ltxv-13b-0.9.7-video-model: downloads < 50
[Quality] Rejected LTX-video_lora_bullet_time: downloads < 50
[Quality] Rejected ltx_video_anime_landscape_early_lora: downloads < 50
[Quality] Rejected ltx_video_pixel_early_lora: downloads < 50
[Quality] Rejected LTX-Video-Squish-LoRA: downloads < 50
[Trending] Found 12 total, 0 passed quality filter
INFO:     127.0.0.1:45626 - "POST /api/ai-search/trending HTTP/1.1" 200 OK
```

### 서버 자동 리로드 시

```
WARNING:  WatchFiles detected changes in 'app/services/ai_search.py'. Reloading...
INFO:     Shutting down
INFO:     Waiting for application shutdown.
INFO:     Application shutdown complete.
INFO:     Finished server process [1145928]
Shutting down Video LoRA Manager...
INFO:     Started server process [1147185]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

## 요약

| 구성요소 | 파일 위치 | 역할 |
|---------|----------|------|
| **프론트엔드 UI** | `service/frontend/src/components/AISearchModal.tsx` | 모달 UI, 상태 관리, API 호출, WebSocket 다운로드 |
| **타입 정의** | `service/frontend/src/types/index.ts` | `AISearchResult`, `AISearchResponse` |
| **API Router** | `service/backend/app/api/ai_search.py` | HTTP 엔드포인트, WebSocket 핸들러 |
| **서비스 레이어** | `service/backend/app/services/ai_search.py` | `AILoraSearcher` 클래스, HuggingFace/Gemini 연동 |

---

## 외부 의존성

| 서비스 | 용도 | API |
|--------|------|-----|
| **HuggingFace** | LoRA 검색 및 다운로드 | `https://huggingface.co/api/models` |
| **Google Gemini** | 한국어 설명 생성 | `gemini-2.0-flash` |

---

**문서 끝**
