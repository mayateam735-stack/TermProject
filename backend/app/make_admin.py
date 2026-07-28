"""Promote an existing user to admin (admins can't self-register).

Usage:  python -m app.make_admin someone@example.com
"""
import sys

from sqlalchemy import select

from .database import SessionLocal
from .models import Patient


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m app.make_admin <email>")
        return
    email = sys.argv[1].strip().lower()
    with SessionLocal() as db:
        user = db.scalar(select(Patient).where(Patient.email == email))
        if user is None:
            print(f"No user found with email {email!r}. Sign up first, then run this.")
            return
        user.role = "admin"
        db.commit()
        print(f"[OK] {email} is now an admin.")


if __name__ == "__main__":
    main()
