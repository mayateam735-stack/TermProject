"""SQLAlchemy ORM models for profiles, history, reminders, and clinics."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(20), nullable=True)
    conditions: Mapped[str | None] = mapped_column(Text, nullable=True)  # free text / comma list
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    history: Mapped[list["SymptomCheck"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    reminders: Mapped[list["Reminder"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )


class SymptomCheck(Base):
    """A single triage interaction, persisted for continuity of care."""

    __tablename__ = "symptom_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int | None] = mapped_column(
        ForeignKey("patients.id"), nullable=True
    )
    symptom_text: Mapped[str] = mapped_column(Text)
    urgency: Mapped[str] = mapped_column(String(20))  # emergency | urgent | routine | self_care
    guidance: Mapped[str] = mapped_column(Text)
    red_flags: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma list
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="history")


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int | None] = mapped_column(
        ForeignKey("patients.id"), nullable=True
    )
    medication: Mapped[str] = mapped_column(String(120))
    dosage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    time_of_day: Mapped[str] = mapped_column(String(20))  # e.g. "08:00"
    active: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="reminders")


class Clinic(Base):
    """A care facility for the locator (clinic, pharmacy, or hospital ER)."""

    __tablename__ = "clinics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(40))  # clinic | pharmacy | hospital
    address: Mapped[str] = mapped_column(String(240))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    open_hours: Mapped[str | None] = mapped_column(String(120), nullable=True)
    estimated_wait_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
