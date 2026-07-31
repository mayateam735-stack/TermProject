"""VHN FastAPI application entry point."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import settings
from .database import Base, engine
from .routers import (
    admin, auth, chat, directory, doctor, insurance, locator, medications, profile,
    push, reminders, symptom_checks, triage,
)
from .services import llm
from .services import push as push_service
from .services.scheduler import check_due_reminders

# How often to ping the hosted model so the provider keeps it loaded (warm).
_KEEP_WARM_SECONDS = 240


async def _keep_warm_loop() -> None:
    """Periodically warm the hosted LLM so demo requests don't hit cold-start 503s."""
    while True:
        try:
            await asyncio.to_thread(llm.warm)  # blocking HF call off the event loop
        except Exception:
            pass
        await asyncio.sleep(_KEEP_WARM_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create missing tables, then add any new model columns to existing tables
    # (create_all won't ALTER — see services/migrate.py).
    Base.metadata.create_all(bind=engine)
    from .services.migrate import ensure_columns
    added = ensure_columns()
    if added:
        print("[migrate] added columns:", ", ".join(added))
    push_service.ensure_keys()  # resolve/generate VAPID keys on first run

    warm_task = None
    if settings.llm_keep_warm and settings.llm_backend.strip().lower() == "hf_api" and settings.hf_token:
        warm_task = asyncio.create_task(_keep_warm_loop())

    # Send medication-reminder pushes when they're due (checks every minute).
    from apscheduler.schedulers.background import BackgroundScheduler
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(check_due_reminders, "cron", minute="*")
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)
    if warm_task:
        warm_task.cancel()


app = FastAPI(
    title="Virtual Health Navigator API",
    description="Triage guidance and self-care support. Guidance, not diagnosis.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(triage.router)
app.include_router(symptom_checks.router)
app.include_router(chat.router)
app.include_router(locator.router)
app.include_router(reminders.router)
app.include_router(profile.router)
app.include_router(directory.router)
app.include_router(doctor.router)
app.include_router(insurance.router)
app.include_router(medications.router)
app.include_router(push.router)
app.include_router(admin.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "virtual-health-navigator"}


@app.get("/api/ai/status", tags=["meta"])
def ai_status() -> dict:
    """Which AI engine backs the symptom checker and chat right now."""
    return llm.status()


# Serve the built React app (frontend/dist) from the same origin as the API,
# so the session cookie never has to cross origins. Only present when the
# frontend has been built (e.g. by the Railway build step) — local dev keeps
# using the Vite dev server on :5173 with its own proxy.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if _FRONTEND_DIST.is_dir():

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = _FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
