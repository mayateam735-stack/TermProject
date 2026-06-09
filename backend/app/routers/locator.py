"""Clinic / pharmacy locator with estimated wait times."""
from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Clinic
from ..schemas import ClinicOut

router = APIRouter(prefix="/api/clinics", tags=["locator"])


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    r = 6371.0
    d_lat, d_lon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return round(2 * r * asin(sqrt(a)), 2)


@router.get("", response_model=list[ClinicOut])
def list_clinics(
    db: Session = Depends(get_db),
    kind: str | None = Query(default=None, description="clinic | pharmacy | hospital"),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
) -> list[ClinicOut]:
    stmt = select(Clinic)
    if kind:
        stmt = stmt.where(Clinic.kind == kind)
    clinics = db.scalars(stmt).all()

    results = []
    for c in clinics:
        out = ClinicOut.model_validate(c)
        if lat is not None and lng is not None:
            out.distance_km = _haversine_km(lat, lng, c.latitude, c.longitude)
        results.append(out)

    # Nearest first when a location is provided.
    if lat is not None and lng is not None:
        results.sort(key=lambda c: (c.distance_km if c.distance_km is not None else 1e9))
    return results
