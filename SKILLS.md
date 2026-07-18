# SKILLS.md — Capabilities & specialized workflows

Repeatable, project-specific workflows for agents. Each is a recipe with the exact
steps and the verification that "done" requires. See [AGENTS.md](AGENTS.md) for the
map and [CLAUDE.md](CLAUDE.md) for environment notes.

---

## Skill: Run the app
**When:** "run it", demo, or manual verification.
1. Backend (background): `cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
2. Frontend (background): `cd frontend && npm run dev`
3. Verify over HTTP: `GET /api/health` (backend), `GET http://localhost:5173/`
   (frontend 200), and `GET http://localhost:5173/api/health` (proxy works).
**Done when** all three respond and an emergency triage returns `emergency`.

---

## Skill: Add an authenticated API endpoint
1. Add request/response models to `backend/app/schemas.py`.
2. Add the route in `backend/app/routers/<area>.py` with
   `current: Patient = Depends(get_current_user)`.
3. Include the router in `backend/app/main.py` (`include_router`).
4. Add a method to `frontend/src/api.js` (it already sends `credentials: include`).
**Verify:** cookie-jar script — unauth call → 401, then signup → authed call → 200.
**Done when** data is scoped to the signed-in patient and 401s without a session.

---

## Skill: Change a model / DB schema
1. Edit `backend/app/models.py` (typed `Mapped[...]`).
2. Update `schemas.py` to expose/accept the field.
3. **Recreate the table** — `create_all` won't ALTER. Locally: stop backend,
   delete `vhn.db`, `python -m app.seed`, restart. On Neon: migrate or drop/recreate.
**Done when** signup/PATCH round-trips the new field and `/me` reflects it.

---

## Skill: Touch the triage / safety logic
**File:** `backend/app/services/triage_engine.py` (most safety-critical).
- Red flags must still short-circuit to `EMERGENCY` before pain/duration scoring.
- Pain (≥8 urgent, ≥5 routine) and duration may only **raise** urgency.
**Verify (required):**
- "crushing chest pain, can't breathe" → `emergency`
- "runny nose and sneezing" → `self_care`
- same symptom with pain 0 vs 9 → band increases
**Done when** no input can downgrade an emergency, in both triage and chat.

---

## Skill: Wire the real medical LLM (OpenBioLLM-8B)
**File:** `backend/app/services/llm.py`. Currently stubbed → rule engine.
1. `pip install llama-cpp-python huggingface_hub` (uncomment in requirements).
2. Download a GGUF quant, e.g.
   `huggingface-cli download bartowski/OpenBioLLM-Llama3-8B-GGUF <file>.gguf --local-dir backend/models`.
3. Set `LLM_MODEL_PATH` in `backend/.env`.
4. In `generate_guidance`: build a grounded prompt (RAG over trusted sources) and
   call the model — but return the rule-based result unchanged for `EMERGENCY`, and
   only let the model rewrite the *guidance text*, never the urgency.
**Done when** replies read naturally yet the safety tests above still pass.
**Note:** 8B won't run on Vercel/Heroku app tiers — run it as a separate service.

---

## Skill: Add a frontend screen
1. Create `frontend/src/pages/<Name>.jsx` using existing card/chip/token classes
   (see [DESIGN.md](DESIGN.md)); add a back link if it's not a tab.
2. Register the route in `App.jsx`. Add a tab only if it's a primary destination.
3. Fetch through `api.js`; read auth from `useAuth()`.
**Verify:** `npm run build` passes; no HMR errors; matches the design language.

---

## Skill: Adapt a generic/external prompt to this project
The user often pastes prompts written for a different stack. Before implementing:
- Check for conflicts with the **standing requirements** in [MEMORY.md](MEMORY.md)
  (no localStorage/JWT, cookie auth, native-app feel) and whether referenced files
  (e.g. `src/mockups/*.jsx`) actually exist.
- Map each bullet to what already exists; mark deltas **[adapted]** with the reason.
- Recommend the project-consistent version; flag genuine decisions for the user.
**Done when** the result honors the standing requirements, not the prompt's letter.
