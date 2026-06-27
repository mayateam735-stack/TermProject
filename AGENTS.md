# AGENTS.md — Guidance for AI coding agents

Context for any agentic AI (Claude Code, Cursor, etc.) working in this repo.
Read this before making changes.

## What this project is

**Virtual Health Navigator (VHN / "HealthNav")** — a cross-platform health-guidance
PWA. Users describe symptoms in plain language and receive direction on the right
**level of care**. The guiding principle is **guidance, not diagnosis**: anything
serious routes the user to a real clinician.

> ⚠️ Educational student project (CSIS 4495, Team MAYA). **Not a medical device.**
> Never present output as a medical diagnosis.

## Architecture (three tiers)

| Tier | Tech | Location |
| --- | --- | --- |
| Frontend | React PWA (Vite + vite-plugin-pwa) | `frontend/` |
| API / service | Python · FastAPI · SQLAlchemy | `backend/app/` |
| Data + AI | SQLite + medical LLM (OpenBioLLM-8B, stubbed) | `backend/app/models.py`, `backend/app/services/` |

## 🚨 Safety rules — do not violate

1. **The rule-based triage engine is a permanent safety floor.** Any LLM/RAG work
   in `backend/app/services/llm.py` may *refine wording* but must **never downgrade**
   the urgency decided by `triage_engine.assess()`. Emergencies are returned
   unchanged — see the guard in `generate_guidance()`.
2. **Red-flag detection always wins.** If you add symptom logic, emergency red flags
   (chest pain, can't breathe, stroke signs, suicidal ideation, etc.) must still
   short-circuit to `EMERGENCY` regardless of other inputs.
3. **Unrecognized symptoms stay cautious** — default to "see a clinician" (`ROUTINE`),
   never to reassurance.
4. **Keep the disclaimer + 911 / HealthLink BC 8-1-1 fallback** in any user-facing
   guidance.

The triage logic lives in `backend/app/services/triage_engine.py` and is the most
safety-critical file in the repo. Changes there deserve extra review and tests.

## How to run

**Backend** (from `backend/`):
```bash
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env                              # copy .env.example on Windows
python -m app.seed                                # seed sample BC clinics
uvicorn app.main:app --reload                     # http://localhost:8000  (docs at /docs)
```

**Frontend** (from `frontend/`):
```bash
npm install
npm run dev                                       # http://localhost:5173
```
The Vite dev server proxies `/api/*` to the backend on port 8000 (see `vite.config.js`).

## Project map

```
backend/app/
  main.py                 FastAPI app + CORS + table creation on startup
  config.py               Env settings (DATABASE_URL, CORS, LLM_MODEL_PATH)
  database.py             Engine, SessionLocal, get_db() dependency
  models.py               Patient, SymptomCheck, Reminder, Clinic
  schemas.py              Pydantic request/response models
  seed.py                 Sample clinics (run: python -m app.seed)
  routers/
    triage.py             POST /api/triage         (symptom checker / ER flow)
    locator.py            GET  /api/clinics         (distance + wait times)
    reminders.py          /api/reminders           (CRUD)
    profile.py            /api/patients, /history
  services/
    triage_engine.py      SAFETY-CRITICAL rule engine
    llm.py                OpenBioLLM-8B + RAG integration point (stubbed)
frontend/src/
  App.jsx                 App shell: header + icon tab bar + routes
  api.js                  Thin fetch client for the backend
  pages/                  SymptomChecker, Locator, Reminders, Profile
  styles.css              Design tokens + mobile app-shell styling
```

## Conventions

- **Backend:** FastAPI + SQLAlchemy 2.0 typed models (`Mapped[...]`), Pydantic v2
  schemas (`model_config = ConfigDict(from_attributes=True)`). Routers are thin;
  business logic lives in `services/`.
- **Frontend:** React function components + hooks, `react-router-dom`, `lucide-react`
  icons. No CSS framework — styling is hand-rolled in `styles.css` using CSS custom
  properties (the design tokens). Keep the mobile app-shell feel (fixed header +
  bottom tab bar, scrollable content).
- **Do not commit:** `node_modules/`, `.venv/`, `*.db`, `dist/`, `.env` (see `.gitignore`).

## Verifying changes

- **Backend:** quick end-to-end check with FastAPI's `TestClient` (seed, then hit
  `/api/health`, `/api/triage`, `/api/clinics`, `/api/reminders`).
- **Frontend:** `npm run build` must pass; check the dev server has no HMR errors.
- For any change to `triage_engine.py`, manually test an **emergency** phrase
  ("crushing chest pain, can't breathe" → `emergency`) and a **self-care** phrase
  ("runny nose and sneezing" → `self_care`).

## The AI roadmap (intended product AI)

`services/llm.py` is the integration point for **OpenBioLLM-8B served via
`llama-cpp-python`, grounded with RAG** over trusted medical sources. It currently
falls back to the rule engine when no model path is configured (`LLM_MODEL_PATH`).
When wiring the model: retrieve context → build a grounded prompt → generate
guidance text, but **always** keep the rule-based urgency as the safety floor.
