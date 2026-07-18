"""Doctor directory — the list patients pick from when choosing a doctor."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient
from ..schemas import DoctorOut
from ..security import get_current_user

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


@router.get("", response_model=list[DoctorOut])
def list_doctors(
    db: Session = Depends(get_db),
    _: Patient = Depends(get_current_user),
) -> list[Patient]:
    stmt = select(Patient).where(Patient.role == "doctor").order_by(Patient.name)
    return list(db.scalars(stmt).all())
