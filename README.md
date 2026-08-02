# Virtual Health Navigator (VHN)

CSIS 4495 – 071 Group Project · Team **MAYA** (Amish Nanda, Lovepreet Singh, Shinsuke Tomita)

**Live demo:** <https://termproject-production-b7d3.up.railway.app/home>

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
  always errs toward caution. Red-flag matching is apostrophe-insensitive
  ("cant breathe" matches the same rule as "can't breathe") so a missing
  apostrophe in typed input can't silently skip an emergency
  ([`triage_engine.py`](backend/app/services/triage_engine.py)).
- **Clinic / pharmacy locator** with live ED/urgent-care wait times from
  [edwaittimes.ca](https://edwaittimes.ca) ([`wait_times.py`](backend/app/services/wait_times.py)),
  distance sorting from the user's geolocation, and a free
  [Leaflet](https://leafletjs.com) + OpenStreetMap view with color-coded,
  filterable markers — no API key or billing account needed
  ([`ClinicMap.jsx`](frontend/src/components/ClinicMap.jsx)). Clicking a
  clinic in the list pans/zooms the map to it and opens its popup. Falls
  back to the seeded clinic list if the feed is unreachable.
- **Medication reminders** (create / list / delete / skip) with a
  configurable `start_date` — "ongoing daily from a chosen day," not just
  "since created." That start date is threaded through everywhere adherence
  gets computed: weekly **adherence tracking** (daily and time-of-day
  breakdowns, weekday vs. weekend averages), a **current/best streak**
  stat (`GET /api/reminders/streak`), per-reminder lifetime detail, the
  doctor-facing medications view, and the due-dose push scheduler — so a
  reminder that starts next week doesn't count as "missed" today
  ([`reminders.py`](backend/app/routers/reminders.py)).
- **Web Push reminders** — a background scheduler ([`scheduler.py`](backend/app/services/scheduler.py))
  checks every minute for due doses (with a 10-minute grace window in case a
  tick is missed, and a same-day dedupe guard so grace doesn't turn into
  spam) and sends a browser push (via
  [`push.py`](backend/app/services/push.py) / [`pywebpush`](https://pypi.org/project/pywebpush/))
  with Take/Skip actions. VAPID keys are auto-generated for local dev; see
  [Web Push reminders](#web-push-reminders) below for making them persist
  in production.
- **Medication autocomplete + label info** — name search backed by the NLM
  RxTerms API and drug info from openFDA, proxied server-side
  ([`medications.py`](backend/app/routers/medications.py)).
- **Insurance cost estimator** — given expected annual out-of-pocket spending,
  ranks sample extended-health plans by total yearly cost
  ([`insurance.py`](backend/app/routers/insurance.py)). Illustrative sample
  plans, not real quotes.
- **Private health history** — every symptom check is persisted per patient.
- **Conversational, multi-turn Health AI chat** — small talk gets a friendly
  reply; a vague message ("I feel unwell") gets ONE clarifying question at a
  time (OpenBioLLM phrases it when configured, with a fixed fallback
  sequence otherwise) until a concrete symptom emerges, then hands off to
  triage guidance. Red flags are scanned across the **whole conversation**,
  not just the latest message, so "I feel sick" → *(a turn later)* → "and
  now I can't breathe" still forces an immediate `EMERGENCY` reply — the
  same rule-based floor as the symptom checker, never the model
  ([`chat.py`](backend/app/routers/chat.py)).
- **Self-care remedies** — a `self_care` result (checker or chat) includes a
  short list of OTC/home-care suggestions plus a "search remedies for your
  symptoms" link; guaranteed empty for routine/urgent/emergency results
  ([`triage_engine.py`](backend/app/services/triage_engine.py),
  [`SelfCareTips.jsx`](frontend/src/components/SelfCareTips.jsx)).
- **OpenBioLLM-8B** wired up via Hugging Face's hosted Inference API
  ([`llm.py`](backend/app/services/llm.py), `LLM_BACKEND=hf_api`) — the model
  rewords self-care guidance in plain language, but the rule-based triage
  engine is a permanent safety floor the model can never downgrade
  (emergencies always bypass the model). Local backends (`transformers`,
  `llamacpp`) are also supported for offline/GPU setups.
- **Doctor triage-priority inbox** — a doctor's patient list is sorted by
  clinical urgency first (emergency → urgent → routine → self-care), then
  recency, so whoever needs attention most surfaces at the top; each patient
  shows 30-day medication adherence and a `needs_attention` flag. Drilling
  into a patient shows their full symptom-check history plus a
  **medications view** with lifetime adherence per prescription
  ([`doctor.py`](backend/app/routers/doctor.py),
  [`DoctorDashboard.jsx`](frontend/src/pages/DoctorDashboard.jsx)).
- **Admin dashboard** — population-level analytics (signups, symptom checks
  by urgency, medication adherence, top medications, common symptom words,
  total logins/app-opens) rendered as [Recharts](https://recharts.org)
  charts, including a 30-day signups/checks/doses time series
  (`GET /api/admin/timeseries`), plus full CRUD over any user account
  ([`admin.py`](backend/app/routers/admin.py),
  [`AdminDashboard.jsx`](frontend/src/pages/AdminDashboard.jsx)). Admins
  can't self-register — see [Creating an admin](#creating-an-admin) below.
- **Engagement tracking** — every login and app open increments
  `login_count` / `app_opens` on the patient record, rolled up into the
  admin analytics above.
- **Installable PWA** — an enriched manifest (`id`, `scope`, `shortcuts` for
  Symptoms/Chat/Meds, maskable icon; see `frontend/vite.config.js`) plus an
  in-app **Install** banner that
  captures the browser's `beforeinstallprompt` event (which fires before
  React mounts, so it's stashed at module load — see
  [`pwa.js`](frontend/src/pwa.js)) and shows a native install button, or an
  "Add to Home Screen" hint on iOS Safari where no native prompt exists
  ([`InstallBanner.jsx`](frontend/src/components/InstallBanner.jsx)).
- **Toast notifications** — a lightweight in-app toast system
  (success/error/info) for action feedback across the app
  ([`toast.jsx`](frontend/src/toast.jsx)).

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
> a table that already exists. This bit us for real: after pulling model
> changes that added `login_count` / `last_login` / `app_opens` to
> `Patient`, login against the shared Neon database started 500ing for
> every existing account (schema drift, not bad credentials). Startup now
> runs [`migrate.py`](backend/app/services/migrate.py) right after
> `create_all`, which diffs each model against the live table and issues an
> `ALTER TABLE ... ADD COLUMN` for anything missing — so a new *column* on
> an existing table is handled automatically on the next restart/deploy. It
> deliberately does **not** drop, rename, or retype columns (and skips a
> `NOT NULL` column with no default on a populated table, logging why) —
> those still need a manual fix.

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

#### Creating an admin
Admin accounts can't self-register — sign up normally first (as `patient`,
the signup default; the role gets overwritten either way), then promote
that account from the backend:
```bash
cd backend
python -m app.make_admin someone@example.com
```
This works against whichever database `backend/.env`'s `DATABASE_URL`
points to — if that's the same Neon database your deployed app uses, an
account created through the deployed site can be promoted this way too.
Once promoted, log in as that user to reach `/admin`.

#### Web Push reminders
No setup needed for local dev — a VAPID keypair is generated on first run,
cached to `backend/vapid_private.pem` / `vapid_public.txt` (git-ignored), and
the values to promote are printed to the console. A background scheduler
checks every minute for reminders due "now" (per device timezone) and pushes
a notification with Take/Skip actions.

**In production**, set both env vars so the keypair survives redeploys —
otherwise every redeploy generates a fresh pair and every existing push
subscription silently breaks:
```
VAPID_PUBLIC_KEY=<printed to the console on first local run>
VAPID_PRIVATE_KEY=<same — a PKCS8 PEM, newlines written as literal \n>
```

### 2. Frontend (React PWA)
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```
The dev server proxies `/api/*` to the backend on port 8000. No `.env` setup
needed — the clinic map uses free Leaflet + OpenStreetMap tiles, no API key
or billing account required. `frontend/.env.example` is kept as a
placeholder for any future `VITE_*` vars.

> ⚠️ This is a PWA with a service worker (`vite-plugin-pwa`,
> `registerType: "autoUpdate"`). If a fix or deploy doesn't seem to take
> effect — stale-looking UI, requests that appear to silently no-op — try
> an incognito/private window first before assuming the backend is broken.
> To clear it in your regular browser: DevTools → Application → Service
> Workers → Unregister, then hard refresh.

## Deploying (Railway)

The app deploys as a **single Railway service**: FastAPI serves the built
React app as static files alongside the `/api/*` routes, so the session
cookie stays same-origin instead of splitting across two domains.

Root-level files Railway's build picks up automatically:
- [`nixpacks.toml`](nixpacks.toml) — installs Python (in a venv at
  `/opt/venv`, since the nix-store Python's site-packages isn't writable)
  and Node, then runs `npm run build` for the frontend.
- [`requirements.txt`](requirements.txt) — points to
  [`backend/requirements.txt`](backend/requirements.txt).
- [`railway.json`](railway.json) — start command: seed clinics, then run
  uvicorn bound to Railway's `$PORT`.
- [`.python-version`](.python-version) — pins Python 3.12.

Set these environment variables on the Railway service:
| Variable | Value |
| --- | --- |
| `DATABASE_URL` | A Railway Postgres plugin connection string — the local disk isn't persisted across deploys, so SQLite will lose data on every redeploy. |
| `COOKIE_SECURE` | `true` — Railway serves over HTTPS. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | So the Web Push keypair survives redeploys — see [Web Push reminders](#web-push-reminders). Without these, every redeploy breaks existing push subscriptions. |
| `CORS_ORIGINS` | Optional now that frontend and backend share an origin. |

No "Root Directory" dashboard setting is needed — the build runs from the
repo root and produces one deployable service.

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
| PATCH | `/api/reminders/{id}/skip` | Mark a dose skipped today |
| GET | `/api/reminders/adherence` | Weekly adherence stats (`?week_offset=`) |
| GET | `/api/reminders/streak` | Current/best consecutive-day adherence streak |
| GET | `/api/reminders/{id}` | Reminder detail + lifetime adherence |
| GET | `/api/medications/search` | Medication name autocomplete (NLM RxTerms) |
| GET | `/api/medications/info` | Drug label info (openFDA) |
| GET | `/api/insurance/plans` | List sample extended-health plans |
| POST | `/api/insurance/estimate` | Rank plans by estimated annual cost |
| GET | `/api/push/vapid-key` | Public VAPID key for browser Push subscription |
| POST | `/api/push/subscribe` | Register a device for Web Push |
| POST | `/api/push/unsubscribe` | Remove a device's Push subscription |
| POST | `/api/push/test` | Send a test push to the current patient |
| GET/PATCH | `/api/patients/me` | View / update profile |
| GET | `/api/patients/me/history` | Full symptom-check history |
| GET | `/api/doctors` | List doctors patients can choose from |
| GET | `/api/doctor/patients` | Doctor's assigned patients, sorted by triage priority |
| GET | `/api/doctor/patients/{id}` | A specific patient's profile (doctor view) |
| GET | `/api/doctor/patients/{id}/medications` | A specific patient's medications + lifetime adherence |
| GET | `/api/doctor/patients/{id}/history` | A specific patient's symptom-check history |
| GET | `/api/admin/stats` | Population-level analytics (admin only) |
| GET | `/api/admin/timeseries` | Daily signups/checks/doses over N days (admin only) |
| GET | `/api/admin/users` | List all users with usage counts (admin only) |
| GET/PATCH/DELETE | `/api/admin/users/{id}` | View, edit, or delete any user (admin only) |
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
