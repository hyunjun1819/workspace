# ComfyUI Video LoRA Manager

ComfyUI 서버와 연동하여 비디오 생성 LoRA 모델을 관리하는 웹 애플리케이션입니다.

## 기능

- **모델 자동 감지**: LTX-2, Wan2.2-T2V, Wan2.2-I2V 모델 자동 감지
- **LoRA 스캐닝**: 설치된 비디오 LoRA 자동 분류
- **MoE 지원**: Wan2.2 Lightning LoRA의 HIGH/LOW 파일 쌍 관리
- **필터링**: 베이스 모델, 태스크 타입(T2V/I2V), 카테고리별 필터링
- **실시간 다운로드**: WebSocket을 통한 다운로드 진행률 표시

## 기술 스택

- **Backend**: FastAPI (Python 3.10+)
- **Frontend**: React + TypeScript + Tailwind CSS
- **Database**: SQLite
- **Build Tool**: Vite

## 빠른 시작

### 개발 모드

```bash
cd /opt/comfyui-server/service

# 백엔드만 실행 (포트 8189)
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8189 --reload

# 프론트엔드 개발 서버 (별도 터미널, 포트 3000)
cd frontend
npm install
npm run dev
```

### 프로덕션 모드

```bash
cd /opt/comfyui-server/service

# 프론트엔드 빌드
cd frontend && npm install && npm run build

# 정적 파일 복사
cp -r frontend/dist backend/static

# 서버 실행 (API + 정적 파일)
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8189
```

### Docker 실행

```bash
cd /opt/comfyui-server/service
docker-compose up -d
```

## API 엔드포인트

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/models/detect` | GET | 비디오 모델 감지 |
| `/api/models/installed` | GET | 설치된 모델 목록 |
| `/api/loras/scan` | GET | LoRA 파일 스캔 |
| `/api/loras` | GET | LoRA 목록 (필터 지원) |
| `/api/loras/{id}` | GET | LoRA 상세 정보 |
| `/api/loras/validate-download` | POST | 다운로드 검증 |
| `/ws/download/{id}` | WebSocket | LoRA 다운로드 |
| `/health` | GET | 헬스 체크 |

## 필터 파라미터

```
GET /api/loras?base_model=LTX-2&task_type=T2V&category=distilled
```

- `base_model`: LTX-2, Wan2.2-T2V, Wan2.2-I2V
- `task_type`: T2V, I2V, BOTH
- `category`: lightning, distilled, camera, style, ic-lora, motion
- `search`: 검색 키워드
- `downloaded`: true/false

## 디렉토리 구조

```
service/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI 앱
│   │   ├── config.py         # 설정
│   │   ├── database.py       # DB
│   │   ├── models/           # SQLAlchemy 모델
│   │   ├── services/         # 비즈니스 로직
│   │   └── api/              # API 엔드포인트
│   ├── data/                 # SQLite DB 저장
│   ├── static/               # 프론트엔드 빌드 (프로덕션)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/       # React 컴포넌트
│   │   ├── hooks/            # Custom hooks
│   │   └── types/            # TypeScript 타입
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 지원 모델

| 모델 | T2V | I2V | 구조 |
|------|-----|-----|------|
| LTX-2 | O | O | 단일 파일 |
| Wan2.2-T2V | O | X | MoE (HIGH + LOW) |
| Wan2.2-I2V | X | O | MoE (HIGH + LOW) |

## 포트 설정

- **8189**: Video LoRA Manager (Backend + Frontend)
- **8188**: ComfyUI (기존)
- **3000**: Frontend 개발 서버 (개발 모드)

## 라이선스

MIT License
