"""Patient profile and private health history (scoped to the signed-in user)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, SymptomCheck
from ..schemas import PatientOut, PatientUpdate, SymptomCheckOut
from ..security import get_current_user

router = APIRouter(prefix="/api/patients", tags=["profile"])


@router.get("/me", response_model=PatientOut)
def get_me(current: Patient = Depends(get_current_user)) -> Patient:
    return current


@router.patch("/me", response_model=PatientOut)
def update_me(
    body: PatientUpdate,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Patient:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current, field, value)
    db.commit()
    db.refresh(current)
    return current


@router.get("/me/history", response_model=list[SymptomCheckOut])
def get_history(
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> list[SymptomCheck]:
    stmt = (
        select(SymptomCheck)
        .where(SymptomCheck.patient_id == current.id)
        .order_by(SymptomCheck.created_at.desc())
    )
    return list(db.scalars(stmt).all())
