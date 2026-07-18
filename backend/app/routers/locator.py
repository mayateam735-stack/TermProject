"""Clinic / pharmacy locator with estimated wait times."""
from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Clinic
from ..schemas import ClinicOut
from ..services import wait_times

router = APIRouter(prefix="/api/clinics", tags=["locator"])


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    r = 6371.0
    d_lat, d_lon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return round(2 * r * asin(sqrt(a)), 2)


def _seeded_out(c: Clinic) -> ClinicOut:
    return ClinicOut(
        id=str(c.id), name=c.name, kind=c.kind, address=c.address,
        latitude=c.latitude, longitude=c.longitude, open_hours=c.open_hours,
        estimated_wait_min=c.estimated_wait_min, source="seed",
    )


@router.get("", response_model=list[ClinicOut])
def list_clinics(
    db: Session = Depends(get_db),
    kind: str | None = Query(default=None, description="clinic | pharmacy | hospital"),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
) -> list[ClinicOut]:
    live = wait_times.get_live_facilities()

    results: list[ClinicOut] = []
    if live:
        # Live EDs / urgent care (with real wait times) + seeded pharmacies
        # (the feed doesn't cover pharmacies).
        results.extend(ClinicOut(**f) for f in live)
        pharmacies = db.scalars(select(Clinic).where(Clinic.kind == "pharmacy")).all()
        results.extend(_seeded_out(c) for c in pharmacies)
    else:
        # Feed unavailable — fall back entirely to seeded clinics.
        results.extend(_seeded_out(c) for c in db.scalars(select(Clinic)).all())

    if kind:
        results = [c for c in results if c.kind == kind]

    if lat is not None and lng is not None:
        for c in results:
            c.distance_km = _haversine_km(lat, lng, c.latitude, c.longitude)
        results.sort(key=lambda c: (c.distance_km if c.distance_km is not None else 1e9))
    return results
