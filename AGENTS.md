# Repository Guidelines

> **Agent instruction:** Whatever action you can do yourself, please do yourself, including starting apps and verification.

## Project Structure & Module Organization

GridSense is a FastAPI/Python backend with a Next.js 16 frontend. `backend/api/` contains routes, `backend/ml/` the GNN pipeline and datasets, `backend/simulation/` power-flow logic, and `backend/tests/` pytest coverage. The UI lives in `frontend/src/`: routes in `app/`, shared modules in `components/` and `lib/`, and Zustand state in `store/`. Keep browser assets in `frontend/public/`. Preserve ML data and API-backed behavior.

## Build, Test, and Development Commands

Run commands from repository root unless noted otherwise.

- `pip install -r requirements.txt` installs backend, simulation, and ML dependencies.
- `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload` starts the API; visit `/docs` for Swagger.
- `python -m pytest backend/tests -v` runs the backend suite. Run a focused test with `python -m pytest backend/tests/test_api.py -v`.
- `cd frontend; npm ci` installs the locked frontend dependencies.
- `cd frontend; npm run dev -- --port 3000` launches Next.js locally.
- `cd frontend; npm run lint` checks ESLint rules; `npm run build` validates a production build.

## Coding Style & Naming Conventions

Use four spaces and type hints in Python. Prefer `snake_case` for Python files, variables, and functions; use Pydantic models for API contracts. Use TypeScript for frontend code, two-space indentation, `PascalCase` React component filenames (for example, `NodeDetailPanel.tsx`), and `camelCase` functions, hooks, and state. Keep page routes lowercase and hyphenated where needed. Follow existing Tailwind and CSS patterns; run the linter before submitting UI changes.

## Testing Guidelines

Add or update pytest tests in `backend/tests/test_<feature>.py` when API, ML, causal, or simulation behavior changes. Tests must be deterministic and avoid relying on live services or private utility data. For frontend changes, run lint and build; manually verify affected routes with the backend running when they consume `/api/*` endpoints.

## Commit & Pull Request Guidelines

History uses short, imperative summaries such as `Organize frontend backend and ML structure`. Keep commits focused and action-oriented. PRs should explain the user-facing change, note API/model implications, link issues, include test results, and attach screenshots for visual changes. Do not commit `.env.local`, generated `.next/` output, or unversioned datasets and model artifacts.

## Configuration & Integration

Keep local secrets in `.env.local` and document any new required variable in the README. Preserve the frontend API client in `frontend/src/lib/api.ts` and the backend response shapes when integrating UI work; coordinate contract changes across both layers.
