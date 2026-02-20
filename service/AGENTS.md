# Repository Guidelines

## Project Structure & Module Organization
This repository is a full-stack service for ComfyUI video LoRA management.

- `backend/`: FastAPI app (`app/main.py`), API routers (`app/api/`), services (`app/services/`), DB setup (`app/database.py`), and runtime data (`backend/data/`).
- `frontend/`: React + TypeScript + Vite UI (`src/`), static assets (`public/`), and build output (`dist/`).
- `docs/`: product/feature notes and image references.
- `video/`: guide/demo media served by backend at `/videos`.
- Root scripts: `start-dev.sh`, `start-prod.sh`, `docker-compose.yml`, `Dockerfile`.

## Build, Test, and Development Commands
- `./start-dev.sh`: starts backend (`:8189`, reload) and frontend dev server (`:3000`).
- `./start-prod.sh`: builds frontend, copies `frontend/dist` to `backend/static`, then runs API + static server on `:8189`.
- `cd frontend && npm run dev`: frontend-only local development.
- `cd frontend && npm run build`: production frontend bundle.
- `cd frontend && npm run lint`: ESLint for TypeScript/React files.
- `cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8189 --reload`: backend-only development run.
- `docker-compose up -d`: containerized deployment.

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indentation, `snake_case` for functions/modules, `PascalCase` for classes.
- TypeScript/React: 2-space indentation, `PascalCase` for components (e.g., `LoraTab.tsx`), `camelCase` for variables/functions.
- Keep API route files focused by domain (`models.py`, `loras.py`, `help.py`).
- Run `npm run lint` before opening a PR.

## Testing Guidelines
Automated test suites are not yet established in this repository. Until added:
- Validate backend changes with `GET /health` and affected API endpoints.
- Validate frontend changes with `npm run dev` and a production build (`npm run build`).
- For UI changes, include before/after screenshots in PRs.

## Commit & Pull Request Guidelines
No existing commit history is available, so use Conventional Commits:
- `feat: add lora upload size validation`
- `fix: handle missing comfyui connection in settings tab`

PRs should include:
- clear scope and rationale,
- impacted paths (e.g., `backend/app/api/loras.py`),
- manual verification steps,
- screenshots/GIFs for UI updates,
- linked issue/task when available.

## Security & Configuration Tips
- Do not commit secrets (`.env`, API keys).
- Prefer environment variables for runtime config (`COMFYUI_PATH`, host/port, Gemini key).
- Keep mounted model paths read-only in Docker when possible.
