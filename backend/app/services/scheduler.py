"""Background job: send a push when a medication reminder is due.

Runs every minute. For each patient we resolve "now" in their device's timezone
and notify for any active reminder that is due, hasn't been acted on today (taken
OR skipped), and hasn't already been pushed today.

A short GRACE window means a reminder still fires if the exact minute was missed
(e.g. the free-tier server was briefly asleep). An in-process guard keeps it to a
single push per reminder per day so the grace window doesn't spam.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select

from ..database import SessionLocal
from ..models import DoseLog, PushSubscription, Reminder
from . import push

# How long after the scheduled minute we'll still send (covers a missed tick).
GRACE_MINUTES = 10
# (reminder_id, local date) already pushed today — prevents per-minute repeats.
_notified: set[tuple[int, date]] = set()


def _tz(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except Exception:
        return ZoneInfo("UTC")


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

            # Use the first device's timezone as the patient's local clock.
            now = datetime.now(_tz(devices[0].timezone))
            today = now.date()

            for r in reminders:
                if (r.id, today) in _notified:
                    continue
                if r.start_date and r.start_date > today:
                    continue  # scheduled to begin on a future date

                # Acted on today (taken or skipped) → nothing to remind about.
                acted = db.scalar(select(DoseLog).where(
                    DoseLog.reminder_id == r.id, DoseLog.dose_date == today
                ))
                if acted is not None:
                    continue

                try:
                    hh, mm = (int(x) for x in r.time_of_day.split(":"))
                except (ValueError, AttributeError):
                    continue
                due = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
                minutes_late = (now - due).total_seconds() / 60
                if not (0 <= minutes_late <= GRACE_MINUTES):
                    continue

                for device in devices:
                    push.send(
                        {"endpoint": device.endpoint,
                         "keys": {"p256dh": device.p256dh, "auth": device.auth}},
                        {"title": f"Time for {r.medication}",
                         "body": f"{r.dosage or 'Your dose'} — Take or Skip below.",
                         "url": "/meds", "reminderId": r.id, "tag": f"med-{r.id}"},
                    )
                _notified.add((r.id, today))

        _prune_notified()


def _prune_notified() -> None:
    """Drop entries older than yesterday so the guard set can't grow unbounded.

    Keeps a 1-day margin so timezones ahead of/behind UTC aren't cleared early.
    """
    cutoff = datetime.now(timezone.utc).date() - timedelta(days=1)
    stale = {key for key in _notified if key[1] < cutoff}
    _notified.difference_update(stale)
