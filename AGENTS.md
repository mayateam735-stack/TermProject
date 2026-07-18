# AGENTS.md — Guidance for AI coding agents

Context for any agentic AI (Claude Code, Cursor, etc.) working in this repo.
Read this first. Companion docs: [CLAUDE.md](CLAUDE.md), [DESIGN.md](DESIGN.md),
[MEMORY.md](MEMORY.md), [TASKS.md](TASKS.md), [SKILLS.md](SKILLS.md).

## What this project is

**Virtual Health Navigator (VHN / "HealthNav")** — a cross-platform health-guidance
PWA. Users describe symptoms in plain language and receive direction on the right
**level of care**. Guiding principle: **guidance, not diagnosis** — anything serious
routes the user to a real clinician.

> ⚠️ Educational student project (CSIS 4495, Team MAYA). **Not a medical device.**
> Never present output as a medical diagnosis.

## Architecture (three tiers)

| Tier | Tech | Location |
| --- | --- | --- |
| Frontend | React PWA (Vite + vite-plugin-pwa) | `frontend/` |
| API / service | Python · FastAPI · SQLAlchemy | `backend/app/` |
| Data | PostgreSQL on Neon (SQLite fallback) | `backend/app/models.py` |
| AI | OpenBioLLM-8B + RAG (stubbed) | `backend/app/services/` |

## 🚨 Safety rules — do not violate

1. **The rule-based triage engine is a permanent safety floor.** LLM/RAG work in
   `services/llm.py` may *refine wording* but must **never downgrade** the urgency
   from `triage_engine.assess()`. Emergencies are returned unchanged.
2. **Red-flag detection always wins** — chest pain, can't breathe, stroke signs,
   suicidal ideation, etc. short-circuit to `EMERGENCY` regardless of other inputs
   (including pain level / duration).
3. **Unrecognized symptoms stay cautious** — default to `ROUTINE` ("see a
   clinician"), never reassurance.
4. The same floor applies to the **chat endpoint** (`routers/chat.py`).
5. Keep the disclaimer + 911 / HealthLink BC 8-1-1 fallback in user-facing guidance.

`services/triage_engine.py` is the most safety-critical file. Changes there need
extra review and the emergency/self-care tests below.

## Auth & data rules

- **Auth = server-side sessions in the DB + an HTTP-only cookie.** No JWT, **no
  tokens in `localStorage`** — the user explicitly required all state in the DB.
  Passwords hashed with stdlib PBKDF2 (`security.py`). See [MEMORY.md](MEMORY.md).
- All app data (profiles, history, reminders, taken-state, sessions) lives in the
  database, scoped per-user via the `get_current_user` dependency.

## How to run

**Backend** (from `backend/`):
```bash
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env        # set DATABASE_URL (Neon) — or leave blank for SQLite
python -m app.seed          # seed sample BC clinics
uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)
```
**Frontend** (from `frontend/`): `npm install && npm run dev` → http://localhost:5173
(proxies `/api/*` to port 8000).

> ⚠️ **Schema changes:** `create_all` only creates *missing tables* — it never adds
> columns to an existing one. After editing a model, either `ALTER TABLE` or drop &
> recreate the table (locally: delete `vhn.db` and re-seed).

## Project map

```
backend/app/
  main.py            FastAPI app, CORS, create_all on startup, router includes
  config.py          Settings: DATABASE_URL, CORS_ORIGINS, LLM_MODEL_PATH
  database.py        Engine, SessionLocal, Base, get_db
  security.py        Password hashing, DB sessions, get_current_user
  models.py          Patient, Session, SymptomCheck, Reminder, Clinic
  schemas.py         Pydantic request/response models
  seed.py            Sample BC clinics (python -m app.seed)
  routers/
    auth.py          signup / login / logout / me
    triage.py        POST /api/triage  (symptom checker / ER flow)
    symptom_checks.py GET /api/symptom-checks  (recent activity)
    chat.py          POST /api/chat  (Health AI, same safety floor)
    locator.py       GET /api/clinics  (distance + wait times)
    reminders.py     /api/reminders CRUD + /{id}/taken
    profile.py       /api/patients/me (+ PATCH), /me/history
  services/
    triage_engine.py SAFETY-CRITICAL rule engine (tags + pain + duration scoring)
    llm.py           OpenBioLLM-8B + RAG integration point (stubbed)
frontend/src/
  main.jsx           AuthProvider + BrowserRouter
  App.jsx            App shell: header, tab bar, routes, floating chat button
  auth.jsx           AuthProvider / useAuth (session via cookie)
  api.js             Fetch client (credentials: include)
  styles.css         Design tokens (see DESIGN.md)
  components/PulseLine.jsx
  pages/             Home, SymptomChecker, Locator, Reminders, Profile,
                     History, Chat, SignIn, SignUp
```

## Conventions

- **Backend:** FastAPI + SQLAlchemy 2.0 typed models (`Mapped[...]`), Pydantic v2
  (`ConfigDict(from_attributes=True)`). Thin routers; logic in `services/`.
- **Frontend:** React function components + hooks, `react-router-dom`, `lucide-react`
  icons, hand-rolled CSS via custom-property design tokens. Keep the mobile
  app-shell (fixed header + bottom tab bar, scrollable content). Follow [DESIGN.md](DESIGN.md).
- **Never commit:** `node_modules/`, `.venv/`, `*.db`, `dist/`, `.env`, `.claude/`.

## Verifying changes

- **Backend:** end-to-end check with FastAPI `TestClient` or a cookie-jar HTTP
  script (signup → authed call → logout).
- **Frontend:** `npm run build` must pass; dev server has no HMR errors.
- **Triage:** always test an **emergency** ("crushing chest pain, can't breathe" →
  `emergency`) and a **self-care** ("runny nose and sneezing" → `self_care`) input
  after touching `triage_engine.py`.

## Product AI roadmap

`services/llm.py` is the integration point for **OpenBioLLM-8B via `llama-cpp-python`,
grounded with RAG**. It falls back to the rule engine when `LLM_MODEL_PATH` is unset.
When wiring it: retrieve trusted context → grounded prompt → generate — but **always**
keep the rule-based urgency as the safety floor.
