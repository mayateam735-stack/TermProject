"""Patient profile and private health history."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, SymptomCheck
from ..schemas import PatientCreate, PatientOut, SymptomCheckOut

router = APIRouter(prefix="/api/patients", tags=["profile"])


@router.post("", response_model=PatientOut, status_code=201)
def create_patient(body: PatientCreate, db: Session = Depends(get_db)) -> Patient:
    patient = Patient(**body.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db)) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/{patient_id}/history", response_model=list[SymptomCheckOut])
def get_history(patient_id: int, db: Session = Depends(get_db)) -> list[SymptomCheck]:
    stmt = (
        select(SymptomCheck)
        .where(SymptomCheck.patient_id == patient_id)
        .order_by(SymptomCheck.created_at.desc())
    )
    return list(db.scalars(stmt).all())
