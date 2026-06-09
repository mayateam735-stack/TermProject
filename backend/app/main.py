"""VHN FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import locator, profile, reminders, triage


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic migrations for production).
    Base.metadata.create_all(bind=engine)
    yield


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

app.include_router(triage.router)
app.include_router(locator.router)
app.include_router(reminders.router)
app.include_router(profile.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "virtual-health-navigator"}
