"""Authentication endpoints: signup, login, logout, current user."""
from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..database import get_db
from ..models import Patient, Session
from ..schemas import LoginRequest, PatientOut, SignupRequest
from ..security import (
    SESSION_COOKIE,
    SESSION_DAYS,
    create_session,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,          # not readable by JS — no token in the browser store
        samesite="lax",
        secure=False,           # set True behind HTTPS in production
        max_age=SESSION_DAYS * 24 * 3600,
        path="/",
    )


@router.post("/signup", response_model=PatientOut, status_code=201)
def signup(body: SignupRequest, response: Response, db: DbSession = Depends(get_db)) -> Patient:
    exists = db.scalar(select(Patient).where(Patient.email == body.email))
    if exists:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    patient = Patient(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        age=body.age,
        sex=body.sex,
        conditions=body.conditions,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    session = create_session(db, patient)
    _set_session_cookie(response, session.token)
    return patient


@router.post("/login", response_model=PatientOut)
def login(body: LoginRequest, response: Response, db: DbSession = Depends(get_db)) -> Patient:
    patient = db.scalar(select(Patient).where(Patient.email == body.email))
    if patient is None or not verify_password(body.password, patient.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    session = create_session(db, patient)
    _set_session_cookie(response, session.token)
    return patient


@router.post("/logout", status_code=204, response_class=Response)
def logout(
    vhn_session: str | None = Cookie(default=None),
    db: DbSession = Depends(get_db),
) -> Response:
    if vhn_session:
        session = db.get(Session, vhn_session)
        if session is not None:
            db.delete(session)
            db.commit()
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@router.get("/me", response_model=PatientOut)
def me(current: Patient = Depends(get_current_user)) -> Patient:
    return current
