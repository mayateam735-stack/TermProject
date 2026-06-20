"""Medication reminders CRUD."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, Reminder
from ..schemas import ReminderCreate, ReminderOut, ReminderTakenUpdate
from ..security import get_current_user

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _owned_reminder(reminder_id: int, current: Patient, db: Session) -> Reminder:
    reminder = db.get(Reminder, reminder_id)
    if reminder is None or reminder.patient_id != current.id:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> list[Reminder]:
    stmt = (
        select(Reminder)
        .where(Reminder.patient_id == current.id)
        .order_by(Reminder.time_of_day)
    )
    return list(db.scalars(stmt).all())


@router.post("", response_model=ReminderOut, status_code=201)
def create_reminder(
    body: ReminderCreate,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Reminder:
    reminder = Reminder(patient_id=current.id, **body.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.patch("/{reminder_id}/taken", response_model=ReminderOut)
def set_taken(
    reminder_id: int,
    body: ReminderTakenUpdate,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Reminder:
    """Mark a dose taken (today) or not — persisted, so it survives reloads."""
    reminder = _owned_reminder(reminder_id, current, db)
    reminder.last_taken_date = date.today() if body.taken else None
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=204, response_class=Response)
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Response:
    reminder = _owned_reminder(reminder_id, current, db)
    db.delete(reminder)
    db.commit()
    return Response(status_code=204)
