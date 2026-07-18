# MEMORY.md — Long-term project context

Durable decisions and context that aren't obvious from the code. Keep this current;
agents should read it before making architectural choices. See also [AGENTS.md](AGENTS.md).

## Project
- **Virtual Health Navigator (VHN / "HealthNav")** — CSIS 4495 term project, Team
  MAYA (Amish Nanda, Lovepreet Singh, Shinsuke Tomita). Instructor: Michael Ma.
- It is an **educational project, not a medical device**. The whole design is
  positioned around the research finding that symptom-checker apps trail clinicians
  on diagnosis but the real risk is unsafe triage (Wallace et al. 2022; Gilbert et
  al. 2020) — hence "guidance, not diagnosis" and a safety-first engine.
- Localized for **British Columbia** (HealthLink BC 8-1-1, 911, BC clinics).

## Standing user requirements (do not violate)
- **Everything in the database, nothing in browser `localStorage`.** This drove the
  auth design: **DB-backed sessions + HTTP-only cookie**, not JWT/localStorage.
  Even the medication "taken today" state is persisted (`reminders.last_taken_date`).
- **The PWA must feel like a native app**, not a website — phone-shell layout, app
  header, bottom tab bar, FAB. Match the mockups the user provides.
- When given a generic prompt that conflicts with the above (JWT, passlib/bcrypt,
  store-token-in-localStorage, a `src/mockups/*.jsx` file that doesn't exist),
  **adapt it to the project and explain the divergence** — don't follow literally.

## Key technical decisions
- **DB:** PostgreSQL on **Neon** (primary), SQLite fallback when `DATABASE_URL` is
  unset. `psycopg2-binary` is the driver.
- **Password hashing:** stdlib **PBKDF2-HMAC-SHA256** (salted, 200k rounds) — chosen
  over passlib/bcrypt to avoid native build pain on Windows.
- **Safety floor:** `triage_engine.assess()` decides urgency from tags + pain level
  (≥8 → urgent, ≥5 → routine) + duration ("a week or more" escalates). Red flags
  short-circuit to EMERGENCY. The LLM and chat may only refine wording.
- **LLM:** OpenBioLLM-8B GGUF via `llama-cpp-python`, grounded with RAG — currently
  **stubbed**; `services/llm.py` falls back to the rule engine. An 8B model won't run
  on Vercel/Heroku app tiers (run it as a separate service or local GGUF).
- **Migrations:** none. `create_all` only adds missing tables. Schema changes require
  manual `ALTER` or drop/recreate (locally: delete `vhn.db`, re-seed).

## Auth model
- A signed-in user **is** a `Patient` (auth columns live on `patients`, not a
  separate `users` table) because history/reminders/sessions already FK to it.
- Signup collects name, email, password, **age, sex, conditions**. Profile basics
  are editable via `PATCH /api/patients/me`.

## Status / what exists
See [TASKS.md](TASKS.md) for the live checklist. Built: auth, home dashboard with
quick-action tiles, symptom checker (tags/pain/duration), clinic locator, medication
reminders, per-user history, editable profile + share summary, Health AI chat with a
floating button, animated pulse-line auth visual.

## Conventions reminder
Cookie auth (`credentials: include`), `lucide-react` icons, design tokens in
`styles.css` (see [DESIGN.md](DESIGN.md)), thin routers + `services/` logic.
