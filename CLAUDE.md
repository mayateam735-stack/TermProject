# CLAUDE.md — Guidance for Claude / Claude Code

Vendor-specific notes for working in this repo with Claude. For the full picture
read [AGENTS.md](AGENTS.md) (architecture, safety rules, project map), [DESIGN.md](DESIGN.md)
(UI), and [MEMORY.md](MEMORY.md) (decisions). This file is the quick operating manual.

## Golden rules (in priority order)
1. **Safety floor is sacred.** Never let any change (especially LLM work in
   `backend/app/services/llm.py`) downgrade an `EMERGENCY` from the triage engine.
   Red flags → 911, always. Test it after touching triage or chat.
2. **No client-side storage of app state.** Auth is DB sessions + HTTP-only cookie.
   Do not introduce `localStorage`/JWT for auth or data — the user mandated
   everything in the database.
3. **Guidance, not diagnosis.** Keep disclaimers and the HealthLink BC 8-1-1 / 911
   framing in any user-facing copy.

## Environment (Windows)
- Shell is **PowerShell**; a Bash tool is also available. Use forward slashes and
  the venv python explicitly: `backend/.venv/Scripts/python.exe`.
- **Run servers in the background**, then verify over HTTP. They are not persistent
  across sessions — restart with the commands in [AGENTS.md](AGENTS.md) when asked
  to "run it".
- `uvicorn --reload` sometimes misses new router files — if a new route 404s,
  **fully restart** the backend rather than relying on the watcher.

## Backend workflow
- New endpoint → add schema in `schemas.py`, route in `routers/`, include it in
  `main.py`, and protect it with `Depends(get_current_user)` unless it's public
  (`/api/health`, auth, clinics).
- **Schema/model change → recreate the table.** `create_all` won't ALTER. Locally:
  stop backend, delete `vhn.db`, `python -m app.seed`, restart. On Neon: migrate
  or drop/recreate.
- Verify with a cookie-jar script: signup → authed request → assert → logout.

## Frontend workflow
- Match [DESIGN.md](DESIGN.md): indigo→violet brand, `lucide-react` icons only,
  design-token CSS, mobile phone-shell. Reuse existing classes before adding new.
- `api.js` sends `credentials: "include"`; auth state comes from `useAuth()`.
- After changes, run `npm run build` to catch import/JSX errors (HMR can mask them).

## Tone for the user
- The user is a student building a course project; be concrete and teach the "why."
- When handed a generic prompt that conflicts with this project (JWT, localStorage,
  a missing mockup file), **adapt it** and explain the divergence rather than
  following it literally. This has happened repeatedly — see [MEMORY.md](MEMORY.md).
- State outcomes plainly with verification evidence; don't over-hedge.

## Do not
- Commit secrets, `.env`, or `.claude/`.
- Add heavy/native deps casually (e.g. bcrypt build chains) — prefer stdlib.
- Push or open PRs unless explicitly asked. Branch off `main` first.
