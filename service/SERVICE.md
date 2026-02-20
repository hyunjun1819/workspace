# Video LoRA Manager - 기능 명세서

> ComfyUI 기반 AI 영상 생성 LoRA 모델 관리 웹 대시보드

---

## 1. 시스템 개요

| 항목 | 내용 |
|------|------|
| 서비스 포트 | 8189 (설정 가능) |
| ComfyUI 포트 | 8188 |
| Backend | FastAPI (Python 3.10+) |
| Frontend | React + TypeScript + Tailwind CSS (Vite) |
| Database | SQLite (`backend/data/lora_manager.db`) |
| 외부 API | Google Gemini AI, HuggingFace API |

### 지원 비디오 모델

| 모델명 | T2V | I2V | MoE | 파일 형식 |
|--------|-----|-----|-----|----------|
| LTX-2 | O | O | X | `.gguf` / `.safetensors` |
| Wan2.2-T2V | O | X | O (HIGH+LOW) | `.gguf` |
| Wan2.2-I2V | X | O | O (HIGH+LOW) | `.gguf` |

---

## 2. Frontend 탭 구성 (6개 탭)

### 2.1 가이드 탭 (`GuideTab`)

AI 영상 생성 초보자를 위한 시각적 가이드 페이지.

**주요 섹션:**
- **T2V (텍스트→영상)**: 텍스트 프롬프트로 영상 생성하는 기본 방법 설명
- **I2V (이미지→영상)**: 이미지를 기반으로 영상을 만드는 방법 설명
- **Ref 모드**: 참조 이미지를 활용한 영상 생성 안내
- **카메라 LoRA 데모**: Dolly In/Out, Zoom, Pan 등 카메라 효과 시연 영상
- **업스케일 가이드**: 생성된 영상의 해상도 향상 방법

### 2.2 LoRA 탭 (`LoraTab`)

LoRA 모델 탐색, 검색, 필터, 다운로드, 업로드를 위한 메인 관리 화면.

**기능:**
- **필터링**: 베이스 모델, 작업 유형(T2V/I2V), 카테고리, 다운로드 여부로 필터
- **검색**: 이름/설명 기반 텍스트 검색
- **정렬**: 이름순, 다운로드순, 평점순, 최신순
- **페이지네이션**: 페이지당 20개 항목
- **LoRA 카드**: 각 LoRA의 이름, 베이스 모델, 카테고리, MoE 여부, 다운로드 상태 표시
- **상세 모달**: 클릭 시 LoRA 상세 정보 + 다운로드/삭제 기능
- **AI 검색**: HuggingFace에서 인기 LoRA를 검색하고 Gemini AI가 한국어 설명을 생성

### 2.3 ComfyUI 탭 (`ComfyTab`)

ComfyUI를 처음 사용하는 비전공자를 위한 단계별 튜토리얼.

**내용:**
- ComfyUI 기본 개념 (노드, 워크플로우)
- 워크플로우 불러오기/저장 방법
- 기본 노드 연결 안내
- 영상 생성 실행 방법

### 2.4 팁 탭 (`TipsTab`)

영상 생성 품질 향상을 위한 실용적인 팁 모음.

**내용:**
- 피부 질감 개선 팁
- 프롬프트 작성 요령
- 영상 품질 최적화 방법

### 2.5 도움말 탭 (`HelpTab`)

Gemini AI를 활용한 워크플로우 Q&A 챗봇.

**동작 흐름:**
1. 사용자가 워크플로우 JSON 파일 선택 (서버의 `/opt/comfyui-server/workflows/` 디렉토리에서 로드)
2. 한국어로 질문 입력
3. Gemini AI가 워크플로우 JSON 전체를 컨텍스트로 받아 비전공자 눈높이에 맞게 답변
4. 전문용어 대신 비유와 클릭 순서로 설명

**시스템 프롬프트 특징:**
- "Noise Seed는 요리의 레시피 번호 같은 것" 식의 비유
- "Latent" → "AI가 이해하는 이미지" 식의 용어 변환
- 핵심 3줄 + 상세 설명 형식

### 2.6 설정 탭 (`SettingsTab`)

서버 상태 모니터링 및 시스템 정보 확인.

**표시 항목:**
- **서버 상태**: ComfyUI 연결 상태 (실시간, 30초 주기 폴링)
- **설치된 모델**: 감지된 비디오 모델 목록 (T2V/I2V/MoE 뱃지)
- **경로 설정**: ComfyUI, LoRA, UNET 디렉토리 경로
- **API 설정**: Gemini API 키 설정 여부, ComfyUI API 연결 상태
- **버전 정보**: 앱 버전

---

## 3. Backend API 엔드포인트

### 3.1 모델 관리 (`/api/models`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/models/detect` | 파일시스템에서 비디오 모델을 감지하고 DB에 저장 |
| GET | `/api/models/installed` | 설치된 모델 목록 조회 |
| GET | `/api/models/{model_name}` | 특정 모델 상세 정보 |
| GET | `/api/models/validate/{model_name}` | 모델 설치 상태 검증 (MoE 파일 완전성 포함) |

**모델 감지 로직 (`VideoModelDetector`):**
- LTX-2: `unet/ltx-2*.gguf` 또는 `checkpoints/ltx-2*.safetensors` 파일 존재 확인
- Wan2.2-T2V: `unet/Wan2.2-T2V*HighNoise*.gguf` + `*LowNoise*.gguf` 쌍 필요
- Wan2.2-I2V: `unet/Wan2.2-I2V*HighNoise*.gguf` + `*LowNoise*.gguf` 쌍 필요

### 3.2 LoRA 관리 (`/api/loras`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/loras/scan` | 파일시스템 스캔 → DB 동기화 |
| GET | `/api/loras` | LoRA 목록 조회 (필터/정렬/페이지네이션) |
| GET | `/api/loras/stats` | 통계 (모델별, 카테고리별 수량) |
| GET | `/api/loras/{lora_id}` | LoRA 상세 정보 |
| DELETE | `/api/loras/{lora_id}` | LoRA 삭제 (옵션: 파일도 삭제) |
| POST | `/api/loras/upload` | LoRA 파일 업로드 |
| GET | `/api/loras/upload/check` | 파일 중복 확인 |
| GET | `/api/loras/upload/disk-info` | 디스크 공간 정보 |

**LoRA 스캔 로직 (`LoraScanner`):**
1. `models/loras/*.safetensors` 파일 전체 스캔
2. 파일명에서 베이스 모델 감지 (정규식: `ltx[-_]?2`, `Wan2.?2.*T2V` 등)
3. 카테고리 자동 분류: lightning, distilled, camera, style, motion, general
4. MoE 파일 자동 그룹화: `_HIGH`/`_LOW` 키워드 → 동일 pair_key로 묶음
5. 불완전한 MoE 쌍은 `(incomplete)` 표시로 경고

**업로드 제한:**
- 허용 확장자: `.safetensors`, `.pt`, `.pth`, `.ckpt`, `.bin`
- 최대 파일 크기: 10GB
- 스트리밍 처리 (1MB 청크)
- 파일명 새니타이즈, 디렉토리 탐색 방어

### 3.3 다운로드 (`/api`)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/loras/validate-download` | 다운로드 사전 검증 |
| WebSocket | `/api/ws/download/{lora_id}` | 실시간 진행률 다운로드 |
| GET | `/api/disk-space` | 디스크 공간 조회 |

**다운로드 검증 항목 (`DownloadValidator`):**
- 이미 다운로드 완료 여부
- 베이스 모델 설치 여부 (미설치 시 차단)
- MoE 파일 완전성 (HIGH + LOW 모두 필요)
- 디스크 공간 (부족 시 차단, 90% 이상 시 경고)

**WebSocket 다운로드:**
- 실시간 진행률 메시지: `{"type": "progress", "progress": 75, "message": "..."}`
- 완료 메시지: `{"type": "complete", "files": [...]}`
- 에러 메시지: `{"type": "error", "error": "..."}`
- 실패 시 부분 파일 자동 정리

### 3.4 AI 검색 (`/api/ai-search`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/ai-search/trending/{base_model}` | 인기 LoRA Top 10 |
| POST | `/api/ai-search/search` | AI 기반 LoRA 검색 |

**Pin & Fill 전략 (`AILoraSearcher.get_trending_loras`):**
1. **Pin (공식)**: 모델 제작사 리포지토리에서 공식 LoRA 수집
   - LTX-2 → Lightricks 계정
   - Wan2.2 → Wan-AI 계정
2. **Fill (커뮤니티)**: HuggingFace 전체에서 다운로드/좋아요 순으로 커뮤니티 LoRA 수집
3. **필터링**: 비호환 키워드 제외 (LTX-Video v1, Wan2.1 등)
4. **품질 검증**: safetensors 파일 존재 필수
5. **합산 정렬**: 공식/커뮤니티 구분 없이 다운로드 수 기준 통합 정렬
6. **Gemini Curator**: Top 10에 한국어 설명 + 효과 유형 + 뱃지(Official/Trending) 자동 부여

**한국어 쿼리 처리:**
- Gemini로 한국어 → 영어 검색어 변환 (예: "피부 질감" → "skin texture detail realistic")
- 폴백: 간단한 번역 딕셔너리 (`_simple_translate`)

### 3.5 워크플로우 도움말 (`/api/help`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/help/workflows` | 사용 가능한 워크플로우 목록 |
| POST | `/api/help/chat` | 워크플로우 기반 AI 채팅 |

**채팅 동작:**
1. 워크플로우 JSON 파일 전체를 Gemini 컨텍스트에 첨부
2. 비전공자를 위한 시스템 프롬프트 적용
3. API 키 할당량 초과 시 fallback 키로 자동 전환

### 3.6 헬스체크 (`/health`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 서비스 상태 확인 |

**응답:**
```json
{
  "status": "healthy",
  "comfyui": true,        // ComfyUI :8188 연결 상태 (3초 타임아웃)
  "gemini_configured": true // Gemini API 키 설정 여부
}
```

---

## 4. 데이터 모델

### 4.1 VideoModel (비디오 모델)

| 필드 | 타입 | 설명 |
|------|------|------|
| name | String | 모델 식별자 (`LTX-2`, `Wan2.2-T2V`, `Wan2.2-I2V`) |
| display_name | String | 표시명 |
| supports_t2v | Boolean | T2V 지원 여부 |
| supports_i2v | Boolean | I2V 지원 여부 |
| is_moe | Boolean | MoE 아키텍처 여부 |
| requires_paired_files | Boolean | HIGH+LOW 파일 쌍 필요 여부 |
| model_files | JSON String | 모델 파일 경로/크기/존재여부 |
| is_complete | Boolean | 모든 필수 파일 존재 여부 |
| is_installed | Boolean | 설치 완료 여부 |

### 4.2 LoraModel (LoRA 모델)

| 필드 | 타입 | 설명 |
|------|------|------|
| name | String | LoRA 이름 |
| description | Text (nullable) | 설명 (Gemini 생성 또는 사용자 입력) |
| base_model | String | 호환 베이스 모델 |
| task_type | String | `T2V` / `I2V` / `BOTH` |
| category | String | lightning, distilled, camera, style, motion, general |
| is_moe | Boolean | MoE 여부 |
| requires_paired_files | Boolean | HIGH+LOW 파일 쌍 필요 |
| files | JSON String | 파일 목록 (type, filename, path, size, is_downloaded) |
| total_size | Integer | 전체 파일 크기 (bytes) |
| trigger_words | JSON String | 트리거 단어 목록 |
| recommended_strength | Float | 권장 강도 |
| downloads | Integer | 다운로드 수 |
| rating | Float | 평점 |
| source | String | `local` / `huggingface` / `github` |
| source_url | String | 원본 URL |
| all_files_downloaded | Boolean | 모든 파일 다운로드 완료 여부 |
| download_progress | Float | 다운로드 진행률 (0~100) |

---

## 5. 핵심 서비스 흐름

### 5.1 앱 초기화

```
Frontend 로드
  → GET /api/models/detect (비디오 모델 파일시스템 스캔)
  → GET /api/loras/scan (LoRA 파일시스템 스캔 → DB 동기화)
  → GET /api/models/installed (설치된 모델 목록 가져오기)
  → GET /api/loras (LoRA 목록 가져오기)
```

### 5.2 LoRA 검색 & 다운로드

```
사용자: "LTX-2 카메라 LoRA 찾기"
  → GET /api/ai-search/trending/LTX-2
    → HuggingFace API (Pin: Lightricks 공식)
    → HuggingFace API (Fill: 커뮤니티)
    → Gemini API (한국어 설명 생성)
  ← Top 10 결과 (이름, 한국어 설명, 뱃지, 크기, 다운로드 수)

사용자: "다운로드"
  → POST /api/loras/validate-download (사전 검증)
  → WebSocket /api/ws/download/{id} (실시간 다운로드)
    ← progress 메시지 (0% → 100%)
    ← complete 메시지
  → DB 업데이트 (all_files_downloaded = true)
```

### 5.3 워크플로우 도움말

```
사용자: 워크플로우 선택 + "Noise Seed가 뭐예요?"
  → POST /api/help/chat
    → 워크플로우 JSON 전체 로드
    → Gemini API (비전공자 시스템 프롬프트 + JSON + 질문)
  ← "영상의 분위기를 바꾸고 싶으면, 'Samplers' 박스 안에 있는 숫자를 바꿔보세요..."
```

### 5.4 건강 상태 모니터링

```
Frontend (30초 주기)
  → GET /health
    → ComfyUI /system_stats 확인 (3초 타임아웃)
    → Gemini API 키 존재 확인
  ← { comfyui: true/false, gemini_configured: true/false }
  → 상태 표시등 업데이트 (초록/빨강)
```

---

## 6. 디렉토리 구조

```
service/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 앱 진입점, 라우터 등록, 헬스체크
│   │   ├── config.py            # 환경변수 설정 (Pydantic Settings)
│   │   ├── database.py          # SQLAlchemy 엔진/세션 설정
│   │   ├── api/
│   │   │   ├── models.py        # 비디오 모델 API
│   │   │   ├── loras.py         # LoRA CRUD API
│   │   │   ├── download.py      # WebSocket 다운로드 API
│   │   │   ├── ai_search.py     # AI 검색 API (HuggingFace + Gemini)
│   │   │   ├── help.py          # 워크플로우 도움말 채팅 API
│   │   │   └── upload.py        # LoRA 파일 업로드 API
│   │   ├── models/
│   │   │   ├── lora_model.py    # LoRA ORM 모델
│   │   │   └── video_model.py   # 비디오 모델 ORM 모델
│   │   └── services/
│   │       ├── ai_search.py     # Pin & Fill 검색 + Gemini Curator
│   │       ├── lora_scanner.py  # 파일시스템 LoRA 스캔/분류
│   │       └── model_detector.py # 비디오 모델 감지
│   ├── data/                    # SQLite DB 저장 위치
│   ├── static/                  # Frontend 빌드 결과물
│   └── .env                     # 환경변수 (API 키 등)
│
└── frontend/
    └── src/
        ├── App.tsx              # 메인 앱 (탭 전환, 상태 관리)
        ├── types/index.ts       # TypeScript 타입 정의
        └── components/
            ├── TabNavigation.tsx # 탭 네비게이션 바
            ├── ServerStatus.tsx  # 서버 상태 표시 컴포넌트
            ├── LoraCard.tsx      # LoRA 카드 UI
            ├── LoraGrid.tsx      # LoRA 그리드 레이아웃
            ├── LoraFilter.tsx    # 필터 UI
            ├── LoraDetailModal.tsx # LoRA 상세 모달
            └── tabs/
                ├── GuideTab.tsx    # 가이드
                ├── LoraTab.tsx     # LoRA 관리
                ├── ComfyTab.tsx    # ComfyUI 튜토리얼
                ├── TipsTab.tsx     # 팁
                ├── HelpTab.tsx     # AI 도움말
                └── SettingsTab.tsx # 설정
```

---

## 7. 외부 의존성

| 서비스 | 용도 | 필수 여부 |
|--------|------|----------|
| ComfyUI (`:8188`) | 영상 생성 엔진 | 모델 감지/생성에 필수 |
| Google Gemini API | 한국어 설명 생성, 워크플로우 Q&A, 검색어 번역 | AI 기능에 필수 (기본 기능은 동작) |
| HuggingFace API | LoRA 검색/메타데이터/다운로드 | AI 검색 기능에 필수 |

### Gemini API 키 구성

- `GOOGLE_API_KEY`: 주 API 키
- `GOOGLE_API_KEY_FALLBACK`: 429 Rate Limit 시 자동 전환되는 보조 키

---

## 8. 보안

- 파일 업로드/삭제 시 경로 탐색(Path Traversal) 방어: `is_relative_to()` 검증
- 파일명 새니타이즈: `Path(filename).name`으로 경로 컴포넌트 제거
- CORS: 허용 오리진 제한 (localhost + Vite dev 서버)
- 환경변수: `.env` 파일에서 API 키 관리, `.gitignore` 등록
- 다운로드 검증: 베이스 모델 미설치 시 다운로드 차단
- 정적 파일 서빙: `resolve()` + `is_relative_to()` 방어
