"""Doctor dashboard — a clinician's roster of patients and their history."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DoseLog, Patient, Reminder, SymptomCheck
from ..schemas import PatientOut, PatientSummary, SymptomCheckOut
from ..security import get_current_doctor

router = APIRouter(prefix="/api/doctor", tags=["doctor"])

# Lower number = more clinically pressing. Drives the priority inbox ordering.
_URGENCY_RANK = {"emergency": 0, "urgent": 1, "routine": 2, "self_care": 3, None: 4}
_ATTENTION = {"emergency", "urgent"}


def _owned_patient(patient_id: int, doctor: Patient, db: Session) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None or patient.doctor_id != doctor.id:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def _reminder_start(r: Reminder) -> date:
    """The first day a reminder was scheduled (its start_date, else creation day)."""
    if r.start_date:
        return r.start_date
    ca = r.created_at if r.created_at.tzinfo else r.created_at.replace(tzinfo=timezone.utc)
    return ca.astimezone().date()


def _adherence(reminders: list[Reminder], taken_days: set, since: date, today: date) -> int | None:
    """Percent of scheduled doses marked taken across a window. None if nothing scheduled."""
    scheduled = taken = 0
    for r in reminders:
        r_start = _reminder_start(r)
        day = max(since, r_start)
        while day <= today:
            scheduled += 1
            if (r.id, day) in taken_days:
                taken += 1
            day += timedelta(days=1)
    return round(100 * taken / scheduled) if scheduled else None


def _recent_adherence(db: Session, patient_id: int, days: int = 30) -> int | None:
    today = date.today()
    since = today - timedelta(days=days - 1)
    reminders = list(db.scalars(select(Reminder).where(Reminder.patient_id == patient_id)).all())
    if not reminders:
        return None
    taken_days = {
        (l.reminder_id, l.dose_date)
        for l in db.scalars(
            select(DoseLog).where(
                DoseLog.patient_id == patient_id,
                DoseLog.status == "taken",
                DoseLog.dose_date >= since,
            )
        ).all()
    }
    return _adherence(reminders, taken_days, since, today)


@router.get("/patients", response_model=list[PatientSummary])
def my_patients(
    db: Session = Depends(get_db),
    doctor: Patient = Depends(get_current_doctor),
) -> list[PatientSummary]:
    patients = db.scalars(
        select(Patient).where(Patient.doctor_id == doctor.id)
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
        reminder_count = db.scalar(
            select(func.count()).select_from(Reminder).where(Reminder.patient_id == p.id)
        )
        last_urgency = last.urgency if last else None
        summaries.append(PatientSummary(
            id=p.id, name=p.name, age=p.age, sex=p.sex, conditions=p.conditions,
            check_count=count or 0,
            last_check_at=last.created_at if last else None,
            last_urgency=last_urgency,
            reminder_count=reminder_count or 0,
            adherence_pct=_recent_adherence(db, p.id),
            needs_attention=last_urgency in _ATTENTION,
        ))

    # Priority inbox: most pressing urgency first, then most recent activity.
    summaries.sort(key=lambda s: (
        _URGENCY_RANK.get(s.last_urgency, 4),
        -(s.last_check_at.timestamp() if s.last_check_at else 0),
        s.name.lower(),
    ))
    return summaries


@router.get("/patients/{patient_id}", response_model=PatientOut)
def patient_detail(
    patient_id: int,
    db: Session = Depends(get_db),
    doctor: Patient = Depends(get_current_doctor),
) -> Patient:
    return _owned_patient(patient_id, doctor, db)


@router.get("/patients/{patient_id}/medications")
def patient_medications(
    patient_id: int,
    db: Session = Depends(get_db),
    doctor: Patient = Depends(get_current_doctor),
) -> list[dict]:
    """The patient's medications with lifetime adherence — a clinician view."""
    _owned_patient(patient_id, doctor, db)
    today = date.today()
    reminders = list(db.scalars(
        select(Reminder).where(Reminder.patient_id == patient_id).order_by(Reminder.time_of_day)
    ).all())
    out = []
    for r in reminders:
        start = _reminder_start(r)
        taken_days = {
            (r.id, l.dose_date)
            for l in db.scalars(
                select(DoseLog).where(DoseLog.reminder_id == r.id, DoseLog.status == "taken")
            ).all()
        }
        pct = _adherence([r], taken_days, start, today)
        out.append({
            "id": r.id, "medication": r.medication, "dosage": r.dosage,
            "time_of_day": r.time_of_day, "adherence_pct": pct,
        })
    return out


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
