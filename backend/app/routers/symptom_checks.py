"""Read access to the signed-in patient's recent symptom checks (Recent activity)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, SymptomCheck
from ..schemas import SymptomCheckOut
from ..security import get_current_user

router = APIRouter(prefix="/api/symptom-checks", tags=["symptom-checks"])


@router.get("", response_model=list[SymptomCheckOut])
def list_symptom_checks(
    limit: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> list[SymptomCheck]:
    """Most recent checks for the logged-in patient, newest first.

    Each row already carries `urgency` (self_care | routine | urgent | emergency),
    which the UI maps to the self / soon / er severity badges.
    """
    stmt = (
        select(SymptomCheck)
        .where(SymptomCheck.patient_id == current.id)
        .order_by(SymptomCheck.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())
