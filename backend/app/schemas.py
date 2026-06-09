"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---- Triage ----------------------------------------------------------------
class TriageRequest(BaseModel):
    patient_id: int | None = None
    symptom_text: str = Field(min_length=1, max_length=2000)
    age: int | None = Field(default=None, ge=0, le=120)


class TriageResponse(BaseModel):
    urgency: str  # emergency | urgent | routine | self_care
    headline: str
    guidance: str
    red_flags: list[str]
    recommended_action: str
    disclaimer: str
    source: str  # "rule-based" | "llm" — transparency about how guidance was produced


# ---- Profile ---------------------------------------------------------------
class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    age: int | None = Field(default=None, ge=0, le=120)
    sex: str | None = None
    conditions: str | None = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    age: int | None
    sex: str | None
    conditions: str | None
    created_at: datetime


class SymptomCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symptom_text: str
    urgency: str
    guidance: str
    red_flags: str | None
    created_at: datetime


# ---- Reminders -------------------------------------------------------------
class ReminderCreate(BaseModel):
    patient_id: int | None = None
    medication: str = Field(min_length=1, max_length=120)
    dosage: str | None = None
    time_of_day: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")  # HH:MM


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medication: str
    dosage: str | None
    time_of_day: str
    active: int
    created_at: datetime


# ---- Locator ---------------------------------------------------------------
class ClinicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    kind: str
    address: str
    latitude: float
    longitude: float
    open_hours: str | None
    estimated_wait_min: int | None
    distance_km: float | None = None
