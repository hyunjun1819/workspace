# Workspace

다양한 프로젝트를 모아두는 통합 작업 공간입니다.

## 구조

```
Workspace/
├── service/          # ComfyUI Video LoRA Manager
│   ├── backend/      # FastAPI (Python)
│   ├── frontend/     # React + TypeScript + Tailwind
│   ├── Dockerfile
│   └── docker-compose.yml
└── ...
```

각 프로젝트는 독립된 폴더로 관리되며, Docker 기반으로 구현됩니다.

## 프로젝트 목록

| 프로젝트 | 설명 | 포트 | 기술 스택 |
|----------|------|------|-----------|
| [service](./service/) | ComfyUI Video LoRA Manager | 8189 | FastAPI + React + SQLite |

## 실행 방법

```bash
# 원하는 프로젝트 폴더로 이동
cd service

# Docker 컨테이너 실행
docker-compose up -d
```
