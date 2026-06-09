"""Seed the database with sample clinics for the locator.

Run once after creating tables:  python -m app.seed
"""
from __future__ import annotations

from sqlalchemy import select

from .database import Base, SessionLocal, engine
from .models import Clinic

# A few real-ish locations around Metro Vancouver / New Westminster, BC.
SAMPLE_CLINICS = [
    Clinic(name="Royal Columbian Hospital ER", kind="hospital",
           address="330 E Columbia St, New Westminster, BC",
           latitude=49.2257, longitude=-122.8893, open_hours="24/7",
           estimated_wait_min=180),
    Clinic(name="New Westminster Walk-In Clinic", kind="clinic",
           address="500 Sixth St, New Westminster, BC",
           latitude=49.2126, longitude=-122.9120, open_hours="9:00–18:00",
           estimated_wait_min=45),
    Clinic(name="Sapperton Family Practice", kind="clinic",
           address="318 E Columbia St, New Westminster, BC",
           latitude=49.2261, longitude=-122.8901, open_hours="8:00–16:00",
           estimated_wait_min=30),
    Clinic(name="Shoppers Drug Mart Pharmacy", kind="pharmacy",
           address="555 Sixth St, New Westminster, BC",
           latitude=49.2118, longitude=-122.9131, open_hours="8:00–22:00",
           estimated_wait_min=10),
    Clinic(name="Eagle Ridge Hospital ER", kind="hospital",
           address="475 Guildford Way, Port Moody, BC",
           latitude=49.2790, longitude=-122.8330, open_hours="24/7",
           estimated_wait_min=120),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.scalar(select(Clinic).limit(1)) is not None:
            print("Clinics already seeded; skipping.")
            return
        db.add_all(SAMPLE_CLINICS)
        db.commit()
        print(f"Seeded {len(SAMPLE_CLINICS)} clinics.")


if __name__ == "__main__":
    seed()
