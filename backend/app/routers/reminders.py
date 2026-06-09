"""Medication reminders CRUD."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Reminder
from ..schemas import ReminderCreate, ReminderOut

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    patient_id: int | None = None, db: Session = Depends(get_db)
) -> list[Reminder]:
    stmt = select(Reminder).order_by(Reminder.time_of_day)
    if patient_id is not None:
        stmt = stmt.where(Reminder.patient_id == patient_id)
    return list(db.scalars(stmt).all())


@router.post("", response_model=ReminderOut, status_code=201)
def create_reminder(body: ReminderCreate, db: Session = Depends(get_db)) -> Reminder:
    reminder = Reminder(**body.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=204, response_class=Response)
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)) -> Response:
    reminder = db.get(Reminder, reminder_id)
    if reminder is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(reminder)
    db.commit()
    return Response(status_code=204)
