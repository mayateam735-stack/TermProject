"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Triage ----------------------------------------------------------------
class TriageRequest(BaseModel):
    patient_id: int | None = None
    symptom_text: str = Field(min_length=1, max_length=2000)
    age: int | None = Field(default=None, ge=0, le=120)
    pain_level: int = Field(default=0, ge=0, le=10)
    duration: str | None = Field(default=None, max_length=40)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    reply: str
    urgency: str | None  # set when the message was triaged; None for small talk
    disclaimer: str
    source: str


class TriageResponse(BaseModel):
    urgency: str  # emergency | urgent | routine | self_care
    headline: str
    guidance: str
    red_flags: list[str]
    recommended_action: str
    disclaimer: str
    source: str  # "rule-based" | "llm" — transparency about how guidance was produced


# ---- Auth / Profile --------------------------------------------------------
class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
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
    medication: str = Field(min_length=1, max_length=120)
    dosage: str | None = None
    time_of_day: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")  # HH:MM


class ReminderTakenUpdate(BaseModel):
    taken: bool


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medication: str
    dosage: str | None
    time_of_day: str
    active: int
    last_taken_date: date | None
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
