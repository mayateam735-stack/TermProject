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
| Data + AI | PostgreSQL on [Neon](https://neon.tech) (SQLAlchemy) · OpenBioLLM-8B (hosted) | [`backend/app/models.py`](backend/app/models.py), [`backend/app/services/`](backend/app/services/) |

### Core features in this scaffold
- **Account creation, login, and session auth** — cookie-based sessions backed
  by hashed passwords ([`auth.py`](backend/app/routers/auth.py)).
- **Symptom checker + "Should I go to the ER?" flow** — safety-first triage that
  always errs toward caution ([`triage_engine.py`](backend/app/services/triage_engine.py)).
- **Clinic / pharmacy locator** with live ED/urgent-care wait times from
  [edwaittimes.ca](https://edwaittimes.ca) ([`wait_times.py`](backend/app/services/wait_times.py))
  and distance sorting. Falls back to the seeded clinic list if the feed is
  unreachable.
- **Medication reminders** (create / list / delete).
- **Private health history** — every symptom check is persisted per patient.
- **Health AI chat** — conversational front-end over the same safety-bounded
  triage logic; small talk gets a friendly reply, symptom descriptions get
  guidance ([`chat.py`](backend/app/routers/chat.py)).
- **OpenBioLLM-8B** wired up via Hugging Face's hosted Inference API
  ([`llm.py`](backend/app/services/llm.py), `LLM_BACKEND=hf_api`) — the model
  rewords self-care guidance in plain language, but the rule-based triage
  engine is a permanent safety floor the model can never downgrade
  (emergencies always bypass the model). Local backends (`transformers`,
  `llamacpp`) are also supported for offline/GPU setups.
- **Doctor dashboard** — doctors can view their assigned patients and
  symptom-check history ([`doctor.py`](backend/app/routers/doctor.py)).

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

> ⚠️ `create_all` only creates **missing tables** — it never adds columns to
> a table that already exists. If you add a field to a model
> (`backend/app/models.py`) and an old table is already sitting in your
> database (local or Neon), you'll get `UndefinedColumn` / 500 errors until
> you either `ALTER TABLE` to add the column manually or drop and recreate
> the table.

#### Enabling OpenBioLLM
By default (`LLM_BACKEND=` empty) the app runs on the rule-based triage engine
only. To turn on real OpenBioLLM-8B guidance, set in `backend/.env`:
```
LLM_BACKEND=hf_api
HF_TOKEN=<your token from https://huggingface.co/settings/tokens>
```
Check `GET /api/ai/status` to confirm which engine is active. The hosted
Featherless provider can return a cold-start `503` on the first request; the
app retries a few times before falling back to the rule engine, so guidance
always comes back either way.

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
| POST | `/api/auth/signup` | Create an account (sets session cookie) |
| POST | `/api/auth/login` | Log in (sets session cookie) |
| POST | `/api/auth/logout` | Log out (clears session cookie) |
| GET | `/api/auth/me` | Current logged-in patient |
| POST | `/api/triage` | Symptom checker / ER decision |
| GET | `/api/symptom-checks` | Recent checks for the logged-in patient |
| POST | `/api/chat` | Conversational Health AI (same safety floor) |
| GET | `/api/clinics` | Locator (`?kind=&lat=&lng=`) |
| GET/POST/DELETE | `/api/reminders` | Medication reminders |
| PATCH | `/api/reminders/{id}/taken` | Mark a dose taken today |
| GET/PATCH | `/api/patients/me` | View / update profile |
| GET | `/api/patients/me/history` | Full symptom-check history |
| GET | `/api/doctors` | List doctors patients can choose from |
| GET | `/api/doctor/patients` | Doctor's assigned patients |
| GET | `/api/doctor/patients/{id}` | A specific patient's profile (doctor view) |
| GET | `/api/doctor/patients/{id}/history` | A specific patient's symptom-check history |
| GET | `/api/ai/status` | Which AI engine (rule-based or OpenBioLLM) is currently active |
| GET | `/api/health` | Health check |

Interactive docs: <http://localhost:8000/docs>

## Project documentation
| File | Purpose |
| --- | --- |
| [README.md](README.md) | Project overview, setup, API |
| [AGENTS.md](AGENTS.md) | Instructions & workflows for AI agents |
| [CLAUDE.md](CLAUDE.md) | Vendor-specific guidance for Claude / Claude Code |
| [DESIGN.md](DESIGN.md) | UI/UX guidelines — layout, colors, components |
| [MEMORY.md](MEMORY.md) | Long-term project context & decisions |
| [TASKS.md](TASKS.md) | Task list & progress tracking |
| [SKILLS.md](SKILLS.md) | Capabilities & specialized workflows |

## Roadmap (from the proposal)
- RAG over trusted medical sources to ground OpenBioLLM's guidance further.
- AI summary, voice input, PDF export, wearable integration.
- Integration with B.C.'s Health Connect Registry.
