"""Admin module — population-level analytics over all stored data.

Read-only aggregates that could later drive suggestions to regular users
(e.g. common symptoms → featured self-care guides, popular meds → tips).
All data lives in the app DB (SQLite locally, PostgreSQL/Neon in production).
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DoseLog, Patient, PushSubscription, Reminder, SymptomCheck
from ..security import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

_STOP = {
    "and", "the", "for", "with", "have", "having", "been", "some", "this", "that",
    "from", "your", "you", "are", "was", "feel", "feeling", "like", "days", "day",
    "few", "two", "one", "couple", "week", "weeks", "mild", "really", "very", "bit",
    "little", "since", "last", "when", "what", "should", "get", "got", "not", "but",
    "out", "now", "today", "pain", "level", "duration",
}


@router.get("/stats")
def stats(
    db: Session = Depends(get_db),
    _: Patient = Depends(get_current_admin),
) -> dict:
    # Users by role
    roles = dict(db.execute(select(Patient.role, func.count()).group_by(Patient.role)).all())

    # Symptom checks
    total_checks = db.scalar(select(func.count()).select_from(SymptomCheck)) or 0
    by_urgency = dict(db.execute(
        select(SymptomCheck.urgency, func.count()).group_by(SymptomCheck.urgency)
    ).all())
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    checks_7d = db.scalar(
        select(func.count()).select_from(SymptomCheck).where(SymptomCheck.created_at >= week_ago)
    ) or 0

    # Top medications
    top_meds = [
        {"name": m, "count": n}
        for m, n in db.execute(
            select(Reminder.medication, func.count())
            .group_by(Reminder.medication).order_by(func.count().desc()).limit(6)
        ).all()
    ]

    # Adherence across everyone
    dose = dict(db.execute(select(DoseLog.status, func.count()).group_by(DoseLog.status)).all())

    # Common symptom words (basis for future suggestions)
    words: Counter = Counter()
    for (text,) in db.execute(select(SymptomCheck.symptom_text)).all():
        for w in re.findall(r"[a-z]{3,}", (text or "").lower()):
            if w not in _STOP:
                words[w] += 1
    common_symptoms = [{"word": w, "count": n} for w, n in words.most_common(10)]

    return {
        "users": {
            "patients": roles.get("patient", 0),
            "doctors": roles.get("doctor", 0),
            "admins": roles.get("admin", 0),
            "total": sum(roles.values()),
        },
        "checks": {
            "total": total_checks,
            "last_7_days": checks_7d,
            "by_urgency": {
                "emergency": by_urgency.get("emergency", 0),
                "urgent": by_urgency.get("urgent", 0),
                "routine": by_urgency.get("routine", 0),
                "self_care": by_urgency.get("self_care", 0),
            },
        },
        "reminders": {"total": db.scalar(select(func.count()).select_from(Reminder)) or 0},
        "engagement": {
            "total_logins": db.scalar(select(func.coalesce(func.sum(Patient.login_count), 0))) or 0,
            "total_app_opens": db.scalar(select(func.coalesce(func.sum(Patient.app_opens), 0))) or 0,
        },
        "adherence": {
            "taken": dose.get("taken", 0),
            "skipped": dose.get("skipped", 0),
            "logged": sum(dose.values()),
        },
        "top_medications": top_meds,
        "common_symptoms": common_symptoms,
    }


@router.get("/timeseries")
def timeseries(
    days: int = 30,
    db: Session = Depends(get_db),
    _: Patient = Depends(get_current_admin),
) -> dict:
    """Daily signups, symptom checks, and logged doses over the last N days."""
    days = max(7, min(days, 90))
    today = date.today()
    since = today - timedelta(days=days - 1)
    labels = [(since + timedelta(days=i)).isoformat() for i in range(days)]

    def _bucket(rows: list[date]) -> list[int]:
        counts = {lbl: 0 for lbl in labels}
        for d in rows:
            key = d.isoformat()
            if key in counts:
                counts[key] += 1
        return [counts[lbl] for lbl in labels]

    signup_dates = [
        c.date() for (c,) in db.execute(
            select(Patient.created_at).where(Patient.created_at >= since)
        ).all() if c
    ]
    check_dates = [
        c.date() for (c,) in db.execute(
            select(SymptomCheck.created_at).where(SymptomCheck.created_at >= since)
        ).all() if c
    ]
    dose_dates = [
        d for (d,) in db.execute(
            select(DoseLog.dose_date).where(DoseLog.dose_date >= since)
        ).all() if d
    ]

    signups = _bucket(signup_dates)
    checks = _bucket(check_dates)
    doses = _bucket(dose_dates)
    series = [
        {"date": labels[i][5:], "signups": signups[i], "checks": checks[i], "doses": doses[i]}
        for i in range(days)
    ]
    return {
        "days": days,
        "series": series,
        "totals": {"signups": sum(signups), "checks": sum(checks), "doses": sum(doses)},
    }


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: Patient = Depends(get_current_admin),
) -> list[dict]:
    check_counts = dict(db.execute(
        select(SymptomCheck.patient_id, func.count()).group_by(SymptomCheck.patient_id)
    ).all())
    users = db.scalars(select(Patient).order_by(Patient.created_at.desc())).all()
    return [
        {
            "id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "created_at": u.created_at.isoformat(),
            "checks": check_counts.get(u.id, 0),
            "login_count": u.login_count or 0,
            "app_opens": u.app_opens or 0,
        }
        for u in users
    ]


# ---- CRUD on any user (admin only) -----------------------------------------
class AdminUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    role: str | None = Field(default=None, pattern=r"^(patient|doctor|admin)$")
    age: int | None = Field(default=None, ge=0, le=120)
    sex: str | None = Field(default=None, max_length=20)
    conditions: str | None = Field(default=None, max_length=2000)
    height_cm: int | None = Field(default=None, ge=30, le=280)
    weight_kg: float | None = Field(default=None, ge=1, le=500)
    date_of_birth: date | None = None
    activity_level: int | None = Field(default=None, ge=1, le=4)
    doctor_id: int | None = None


def _user_dict(db: Session, u: Patient) -> dict:
    return {
        "id": u.id, "name": u.name, "email": u.email, "role": u.role,
        "age": u.age, "sex": u.sex, "conditions": u.conditions,
        "height_cm": u.height_cm, "weight_kg": u.weight_kg,
        "date_of_birth": u.date_of_birth.isoformat() if u.date_of_birth else None,
        "activity_level": u.activity_level, "avatar": u.avatar,
        "doctor_id": u.doctor_id, "theme": u.theme,
        "login_count": u.login_count or 0,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "app_opens": u.app_opens or 0,
        "created_at": u.created_at.isoformat(),
        "checks": db.scalar(select(func.count()).select_from(SymptomCheck).where(SymptomCheck.patient_id == u.id)) or 0,
        "reminders": db.scalar(select(func.count()).select_from(Reminder).where(Reminder.patient_id == u.id)) or 0,
    }


def _get_or_404(db: Session, user_id: int) -> Patient:
    u = db.get(Patient, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    return u


@router.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db), _: Patient = Depends(get_current_admin)) -> dict:
    return _user_dict(db, _get_or_404(db, user_id))


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    _: Patient = Depends(get_current_admin),
) -> dict:
    u = _get_or_404(db, user_id)
    data = body.model_dump(exclude_unset=True)

    if data.get("email"):
        clash = db.scalar(select(Patient).where(Patient.email == data["email"], Patient.id != user_id))
        if clash:
            raise HTTPException(status_code=409, detail="Email already in use")
    if data.get("doctor_id") is not None:
        doc = db.get(Patient, data["doctor_id"])
        if doc is None or doc.role != "doctor":
            raise HTTPException(status_code=400, detail="Selected doctor not found")

    for field, value in data.items():
        setattr(u, field, value)
    db.commit()
    db.refresh(u)
    return _user_dict(db, u)


@router.delete("/users/{user_id}", status_code=204, response_class=Response)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: Patient = Depends(get_current_admin),
) -> Response:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You can't delete your own admin account")
    u = _get_or_404(db, user_id)

    # Clean up references that aren't covered by cascade relationships.
    db.query(DoseLog).filter(DoseLog.patient_id == user_id).delete()
    db.query(PushSubscription).filter(PushSubscription.patient_id == user_id).delete()
    for p in db.scalars(select(Patient).where(Patient.doctor_id == user_id)).all():
        p.doctor_id = None  # un-assign patients from a deleted doctor

    db.delete(u)  # cascades symptom checks, reminders, sessions
    db.commit()
    return Response(status_code=204)
