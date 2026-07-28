"""Background job: send a push when a medication reminder is due.

Runs every minute. For each subscribed device, it converts "now" to that device's
timezone and notifies for any active reminder whose time matches and hasn't been
taken today.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select

from ..database import SessionLocal
from ..models import PushSubscription, Reminder
from . import push


def check_due_reminders() -> None:
    with SessionLocal() as db:
        subs = list(db.scalars(select(PushSubscription)).all())
        if not subs:
            return

        by_patient: dict[int, list[PushSubscription]] = {}
        for s in subs:
            by_patient.setdefault(s.patient_id, []).append(s)

        for patient_id, devices in by_patient.items():
            reminders = list(db.scalars(
                select(Reminder).where(Reminder.patient_id == patient_id, Reminder.active == 1)
            ).all())
            if not reminders:
                continue

            for device in devices:
                try:
                    tz = ZoneInfo(device.timezone or "UTC")
                except Exception:
                    tz = ZoneInfo("UTC")
                now = datetime.now(tz)
                hhmm = now.strftime("%H:%M")
                today = now.date()

                for r in reminders:
                    if r.start_date and r.start_date > today:
                        continue  # scheduled to begin on a future date
                    if r.time_of_day == hhmm and r.last_taken_date != today:
                        push.send(
                            {"endpoint": device.endpoint,
                             "keys": {"p256dh": device.p256dh, "auth": device.auth}},
                            {"title": f"Time for {r.medication}",
                             "body": f"{r.dosage or 'Your dose'} — Take or Skip below.",
                             "url": "/meds", "reminderId": r.id, "tag": f"med-{r.id}"},
                        )
