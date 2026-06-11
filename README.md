# Virtual Health Navigator (VHN)

CSIS 4495 – 071 Group Project · Team **MAYA** (Amish Nanda, Lovepreet Singh, Shinsuke Tomita)

A cross-platform mobile health-guidance app. Users describe symptoms in plain
language and get clear direction on the appropriate level of care — **guidance,
not diagnosis**. Any result warranting clinical attention routes the user toward
a real clinician.

> ⚠️ This is an educational student project. It is **not** a medical device and
> must not be used for real medical decisions.

## Architecture

A three-tier system, mirroring the proposal:

| Tier | Technology | Location |
| --- | --- | --- |
| Frontend | React PWA (Vite) | [`frontend/`](frontend/) |
| API / service | Python · FastAPI | [`backend/app/`](backend/app/) |
| Data + AI | PostgreSQL on [Neon](https://neon.tech) (SQLAlchemy) · medical LLM stub | [`backend/app/models.py`](backend/app/models.py), [`backend/app/services/`](backend/app/services/) |

### Core features in this scaffold
- **Symptom checker + "Should I go to the ER?" flow** — safety-first triage that
  always errs toward caution ([`triage_engine.py`](backend/app/services/triage_engine.py)).
- **Clinic / pharmacy locator** with estimated wait times and distance sorting.
- **Medication reminders** (create / list / delete).
- **Private health history** — every symptom check is persisted per patient.
- **LLM integration point** for OpenBioLLM-8B + RAG, stubbed so the app runs
  without a model ([`llm.py`](backend/app/services/llm.py)). The rule-based
  engine acts as a permanent safety floor the model can never downgrade.

## Running it

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
python -m app.seed              # load sample BC clinics
uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)
```

#### Database
The app uses **PostgreSQL hosted on [Neon](https://neon.tech)**. Set the
connection string in `backend/.env` (never commit this file):
```
DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
```
Tables are created automatically on startup; run `python -m app.seed` once to
load the sample clinics. Without a `DATABASE_URL`, the app falls back to a
local SQLite file (`vhn.db`) — handy for quick experiments.

### 2. Frontend (React PWA)
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```
The dev server proxies `/api/*` to the backend on port 8000.

## API overview
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/triage` | Symptom checker / ER decision |
| GET | `/api/clinics` | Locator (`?kind=&lat=&lng=`) |
| GET/POST/DELETE | `/api/reminders` | Medication reminders |
| POST/GET | `/api/patients`, `/api/patients/{id}/history` | Profile & history |
| GET | `/api/health` | Health check |

Interactive docs: <http://localhost:8000/docs>

## Roadmap (from the proposal)
- Wire up OpenBioLLM-8B via `llama-cpp-python` + RAG over trusted sources.
- Doctor / clinic portal and patient roster (multi-sided routing tier).
- AI summary, voice input, PDF export, wearable integration.
- Integration with B.C.'s Health Connect Registry and live clinic queues.
