# TASKS.md — Task list & progress

Living checklist for HealthNav. Update as work lands. See [MEMORY.md](MEMORY.md) for
context and the proposal roadmap.

## ✅ Done
- [x] Three-tier scaffold (FastAPI backend, React PWA, SQLAlchemy)
- [x] Safety-first triage engine (red-flag short-circuit, "guidance not diagnosis")
- [x] Triage scoring by **tags + pain level + duration**
- [x] LLM integration point stubbed with rule-engine safety floor (`services/llm.py`)
- [x] Clinic / pharmacy locator with distance sort + wait-time estimates
- [x] Medication reminders (CRUD) + DB-persisted "taken today" state
- [x] Per-user symptom-check history
- [x] Auth: DB sessions + HTTP-only cookie, PBKDF2 hashing (signup/login/logout/me)
- [x] Signup collects age / sex / conditions; editable via `PATCH /api/patients/me`
- [x] Native-app UI: phone shell, header, bottom tab bar, design tokens
- [x] Home dashboard: greeting, "How can we help?" tiles, Upcoming reminders,
      Recent activity (wired to real data)
- [x] Health AI chat page + floating button with hover tooltip (same safety floor)
- [x] Profile actions: edit basics, history page, share summary, privacy panel
- [x] Animated pulse-line brand visual on auth screens
- [x] Migrated DB target to PostgreSQL on Neon (SQLite fallback)
- [x] Agentic docs: README, AGENTS, CLAUDE, DESIGN, MEMORY, TASKS, SKILLS

## 🔜 Next
- [ ] Wire the real **OpenBioLLM-8B + RAG** (download GGUF, prompt + retrieval,
      keep the safety floor) — see [SKILLS.md](SKILLS.md)
- [ ] Real wait-time / clinic data (vs. seeded samples); map view for the locator
- [ ] Local push/notification reminders (the PWA install + reminder times)
- [ ] Tests: automated triage suite (emergency vs self-care), API integration tests
- [ ] Proper migrations (Alembic) instead of `create_all` drop/recreate

## 🧭 Roadmap (from the proposal — later milestones)
- [ ] Doctor / clinic portal + patient roster (multi-sided routing tier)
- [ ] AI symptom summarizer, PDF export for clinicians
- [ ] Voice input polish, wearable integration
- [ ] Integration with B.C. Health Connect Registry & live clinic queues

## ⚠️ Known gotchas
- `create_all` won't add columns to existing tables — recreate after model changes.
- `uvicorn --reload` can miss new router files — fully restart if a route 404s.
- `navigator.share` / clipboard need a secure context (OK on `localhost`, not plain-HTTP LAN IPs).
