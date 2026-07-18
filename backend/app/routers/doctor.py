"""Doctor dashboard — a clinician's roster of patients and their history."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, SymptomCheck
from ..schemas import PatientOut, PatientSummary, SymptomCheckOut
from ..security import get_current_doctor

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


def _owned_patient(patient_id: int, doctor: Patient, db: Session) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None or patient.doctor_id != doctor.id:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/patients", response_model=list[PatientSummary])
def my_patients(
    db: Session = Depends(get_db),
    doctor: Patient = Depends(get_current_doctor),
) -> list[PatientSummary]:
    patients = db.scalars(
        select(Patient).where(Patient.doctor_id == doctor.id).order_by(Patient.name)
    ).all()

    summaries = []
    for p in patients:
        last = db.scalar(
            select(SymptomCheck)
            .where(SymptomCheck.patient_id == p.id)
            .order_by(SymptomCheck.created_at.desc())
            .limit(1)
        )
        count = db.scalar(
            select(func.count()).select_from(SymptomCheck).where(SymptomCheck.patient_id == p.id)
        )
        summaries.append(PatientSummary(
            id=p.id, name=p.name, age=p.age, sex=p.sex, conditions=p.conditions,
            check_count=count or 0,
            last_check_at=last.created_at if last else None,
            last_urgency=last.urgency if last else None,
        ))
    return summaries


@router.get("/patients/{patient_id}", response_model=PatientOut)
def patient_detail(
    patient_id: int,
    db: Session = Depends(get_db),
    doctor: Patient = Depends(get_current_doctor),
) -> Patient:
    return _owned_patient(patient_id, doctor, db)


@router.get("/patients/{patient_id}/history", response_model=list[SymptomCheckOut])
def patient_history(
    patient_id: int,
    db: Session = Depends(get_db),
    doctor: Patient = Depends(get_current_doctor),
) -> list[SymptomCheck]:
    _owned_patient(patient_id, doctor, db)
    stmt = (
        select(SymptomCheck)
        .where(SymptomCheck.patient_id == patient_id)
        .order_by(SymptomCheck.created_at.desc())
    )
    return list(db.scalars(stmt).all())
