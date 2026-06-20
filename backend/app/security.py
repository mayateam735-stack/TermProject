"""Authentication: password hashing + DB-backed sessions.

No third-party crypto deps — uses the stdlib PBKDF2-HMAC-SHA256. Sessions are
stored server-side in the `sessions` table; the browser only holds an opaque,
HTTP-only cookie. Nothing sensitive lives in client storage.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session as DbSession

from .database import get_db
from .models import Patient, Session

SESSION_COOKIE = "vhn_session"
SESSION_DAYS = 30
_PBKDF2_ROUNDS = 200_000


# ---- Password hashing ------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


# ---- Sessions --------------------------------------------------------------
def create_session(db: DbSession, patient: Patient) -> Session:
    session = Session(
        token=secrets.token_urlsafe(32),
        patient_id=patient.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
    )
    db.add(session)
    db.commit()
    return session


def get_current_user(
    vhn_session: str | None = Cookie(default=None),
    db: DbSession = Depends(get_db),
) -> Patient:
    """FastAPI dependency: resolve the signed-in patient or raise 401."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
    )
    if not vhn_session:
        raise credentials_error

    session = db.get(Session, vhn_session)
    if session is None:
        raise credentials_error

    expires = session.expires_at
    if expires.tzinfo is None:  # SQLite returns naive datetimes
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise credentials_error

    return session.patient
