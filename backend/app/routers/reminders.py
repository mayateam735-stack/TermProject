"""Medication reminders + adherence tracking."""
from __future__ import annotations

from datetime import date, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DoseLog, Patient, Reminder
from ..schemas import ReminderCreate, ReminderOut, ReminderTakenUpdate
from ..security import get_current_user

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _owned_reminder(reminder_id: int, current: Patient, db: Session) -> Reminder:
    reminder = db.get(Reminder, reminder_id)
    if reminder is None or reminder.patient_id != current.id:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


def _effective_start(r: Reminder) -> date:
    """The day this reminder's daily schedule begins (start_date, else created day)."""
    if r.start_date:
        return r.start_date
    ca = r.created_at if r.created_at.tzinfo else r.created_at.replace(tzinfo=timezone.utc)
    return ca.astimezone().date()


def _today_status(db: Session, reminder_id: int) -> str | None:
    log = db.scalar(
        select(DoseLog).where(
            DoseLog.reminder_id == reminder_id, DoseLog.dose_date == date.today()
        )
    )
    return log.status if log else None


def _set_status(db: Session, reminder: Reminder, status: str | None) -> None:
    """Record today's dose status (taken | skipped | None) for a reminder."""
    existing = db.scalar(
        select(DoseLog).where(
            DoseLog.reminder_id == reminder.id, DoseLog.dose_date == date.today()
        )
    )
    if existing:
        db.delete(existing)
    if status in ("taken", "skipped"):
        db.add(DoseLog(
            patient_id=reminder.patient_id, reminder_id=reminder.id,
            dose_date=date.today(), status=status, time_of_day=reminder.time_of_day,
        ))
    reminder.last_taken_date = date.today() if status == "taken" else None


def _with_status(db: Session, reminders: list[Reminder]) -> list[dict]:
    out = []
    for r in reminders:
        d = ReminderOut.model_validate(r).model_dump()
        d["today_status"] = _today_status(db, r.id)
        out.append(d)
    return out


@router.get("")
def list_reminders(
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> list[dict]:
    stmt = (
        select(Reminder).where(Reminder.patient_id == current.id).order_by(Reminder.time_of_day)
    )
    return _with_status(db, list(db.scalars(stmt).all()))


@router.post("", response_model=ReminderOut, status_code=201)
def create_reminder(
    body: ReminderCreate,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Reminder:
    data = body.model_dump()
    if data.get("start_date") is None:
        data["start_date"] = date.today()
    reminder = Reminder(patient_id=current.id, **data)
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.patch("/{reminder_id}/taken", response_model=ReminderOut)
def set_taken(
    reminder_id: int,
    body: ReminderTakenUpdate,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Reminder:
    reminder = _owned_reminder(reminder_id, current, db)
    _set_status(db, reminder, "taken" if body.taken else None)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.patch("/{reminder_id}/skip", response_model=ReminderOut)
def set_skipped(
    reminder_id: int,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Reminder:
    reminder = _owned_reminder(reminder_id, current, db)
    # Toggle: if already skipped today, clear it; otherwise mark skipped.
    _set_status(db, reminder, None if _today_status(db, reminder_id) == "skipped" else "skipped")
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=204, response_class=Response)
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Response:
    reminder = _owned_reminder(reminder_id, current, db)
    db.delete(reminder)
    db.commit()
    return Response(status_code=204)


# ---- Adherence --------------------------------------------------------------
def _bucket(hhmm: str) -> str:
    try:
        h = int(hhmm.split(":")[0])
    except (ValueError, IndexError):
        return "morning"
    if 5 <= h < 12:
        return "morning"
    if 12 <= h < 17:
        return "afternoon"
    if 17 <= h < 21:
        return "evening"
    return "night"


BUCKETS = [("morning", "Morning"), ("afternoon", "Afternoon"),
           ("evening", "Evening"), ("night", "Night")]
DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]  # Sunday-first


class DayAdherence(BaseModel):
    label: str
    pct: int
    scheduled: int
    taken: int


class BucketAdherence(BaseModel):
    key: str
    label: str
    scheduled: int
    pct: int


class AdherenceResult(BaseModel):
    range_label: str
    week_offset: int
    adherence_pct: int
    taken: int
    skipped: int
    missed: int
    scheduled: int
    weekday_avg: int
    weekend_avg: int
    days: list[DayAdherence]
    buckets: list[BucketAdherence]
    message: str


def _pct(taken: int, scheduled: int) -> int:
    return round(100 * taken / scheduled) if scheduled else 0


@router.get("/adherence", response_model=AdherenceResult)
def adherence(
    week_offset: int = Query(default=0, le=0, ge=-52),
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> AdherenceResult:
    today = date.today()
    start = today - timedelta(days=(today.weekday() + 1) % 7)  # this Sunday
    start += timedelta(days=7 * week_offset)
    end = start + timedelta(days=6)

    reminders = list(db.scalars(
        select(Reminder).where(Reminder.patient_id == current.id)
    ).all())
    logs = list(db.scalars(
        select(DoseLog).where(
            DoseLog.patient_id == current.id,
            DoseLog.dose_date >= start, DoseLog.dose_date <= end,
        )
    ).all())
    log_by = {(l.reminder_id, l.dose_date): l.status for l in logs}

    taken = skipped = scheduled = 0
    days = [{"scheduled": 0, "taken": 0} for _ in range(7)]
    buckets = {k: {"scheduled": 0, "taken": 0} for k, _ in BUCKETS}

    for r in reminders:
        r_start = _effective_start(r)
        b = _bucket(r.time_of_day)
        for i in range(7):
            day = start + timedelta(days=i)
            if day > today or day < r_start:
                continue  # not yet scheduled / before this reminder existed
            scheduled += 1
            days[i]["scheduled"] += 1
            buckets[b]["scheduled"] += 1
            st = log_by.get((r.id, day))
            if st == "taken":
                taken += 1
                days[i]["taken"] += 1
                buckets[b]["taken"] += 1
            elif st == "skipped":
                skipped += 1

    missed = max(0, scheduled - taken - skipped)

    wd_s = wd_t = we_s = we_t = 0
    for i in range(7):
        day = start + timedelta(days=i)
        if day.weekday() >= 5:  # Sat/Sun
            we_s += days[i]["scheduled"]; we_t += days[i]["taken"]
        else:
            wd_s += days[i]["scheduled"]; wd_t += days[i]["taken"]

    pct = _pct(taken, scheduled)
    message = (
        "Great work — you're staying on top of your medications!" if pct >= 80
        else "It looks like you missed some medications this week. Make sure you're "
        "taking every dose so you'll feel your best."
    )

    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    if start.month == end.month:
        range_label = f"{months[start.month - 1]} {start.day}–{end.day}"
    else:
        range_label = f"{months[start.month - 1]} {start.day} – {months[end.month - 1]} {end.day}"

    return AdherenceResult(
        range_label=range_label, week_offset=week_offset, adherence_pct=pct,
        taken=taken, skipped=skipped, missed=missed, scheduled=scheduled,
        weekday_avg=_pct(wd_t, wd_s), weekend_avg=_pct(we_t, we_s),
        days=[DayAdherence(label=DAY_LABELS[i], pct=_pct(days[i]["taken"], days[i]["scheduled"]),
                           scheduled=days[i]["scheduled"], taken=days[i]["taken"]) for i in range(7)],
        buckets=[BucketAdherence(key=k, label=lbl, scheduled=buckets[k]["scheduled"],
                                 pct=_pct(buckets[k]["taken"], buckets[k]["scheduled"])) for k, lbl in BUCKETS],
        message=message,
    )


class StreakResult(BaseModel):
    current_streak: int
    best_streak: int
    today_complete: bool
    has_meds: bool


# NOTE: declared before /{reminder_id} so the static route wins.
@router.get("/streak", response_model=StreakResult)
def streak(
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> StreakResult:
    """Consecutive days where every scheduled dose was taken (a motivation stat).

    Today doesn't break the streak until the day is over — an unfinished today
    is skipped so the count reflects yesterday-and-back until you complete today.
    """
    today = date.today()
    reminders = list(db.scalars(
        select(Reminder).where(Reminder.patient_id == current.id)
    ).all())
    if not reminders:
        return StreakResult(current_streak=0, best_streak=0, today_complete=False, has_meds=False)

    starts = [_effective_start(r) for r in reminders]
    earliest = min(starts)

    taken_by_day: dict[date, int] = {}
    for l in db.scalars(
        select(DoseLog).where(DoseLog.patient_id == current.id, DoseLog.status == "taken")
    ).all():
        taken_by_day[l.dose_date] = taken_by_day.get(l.dose_date, 0) + 1

    # No scheduled days yet (e.g. every reminder starts in the future).
    if earliest > today:
        return StreakResult(current_streak=0, best_streak=0, today_complete=False, has_meds=True)

    # flags[0] == today, going back to the earliest scheduled day.
    flags: list[bool] = []
    day = today
    while day >= earliest:
        scheduled = sum(1 for s in starts if s <= day)
        flags.append(scheduled > 0 and taken_by_day.get(day, 0) >= scheduled)
        day -= timedelta(days=1)

    today_complete = flags[0]
    i = 1 if not flags[0] else 0  # grace: an unfinished today doesn't reset
    current_streak = 0
    while i < len(flags) and flags[i]:
        current_streak += 1
        i += 1

    best = run = 0
    for f in flags:
        run = run + 1 if f else 0
        best = max(best, run)

    return StreakResult(
        current_streak=current_streak, best_streak=best,
        today_complete=today_complete, has_meds=True,
    )


class ReminderDetail(BaseModel):
    id: int
    medication: str
    dosage: str | None
    time_of_day: str
    active: int
    created_at: str
    today_status: str | None
    since_label: str
    taken: int
    skipped: int
    missed: int
    scheduled: int
    adherence_pct: int


# NOTE: declared after /adherence so that static route wins over /{reminder_id}.
@router.get("/{reminder_id}", response_model=ReminderDetail)
def reminder_detail(
    reminder_id: int,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> ReminderDetail:
    r = _owned_reminder(reminder_id, current, db)
    today = date.today()
    start = _effective_start(r)

    logs = list(db.scalars(select(DoseLog).where(DoseLog.reminder_id == r.id)).all())
    log_by = {l.dose_date: l.status for l in logs}
    scheduled = taken = skipped = 0
    day = start
    while day <= today:
        scheduled += 1
        st = log_by.get(day)
        if st == "taken":
            taken += 1
        elif st == "skipped":
            skipped += 1
        day += timedelta(days=1)
    missed = max(0, scheduled - taken - skipped)

    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return ReminderDetail(
        id=r.id, medication=r.medication, dosage=r.dosage, time_of_day=r.time_of_day,
        active=r.active, created_at=r.created_at.isoformat(),
        today_status=_today_status(db, r.id),
        since_label=f"{months[start.month - 1]} {start.day} to now",
        taken=taken, skipped=skipped, missed=missed, scheduled=scheduled,
        adherence_pct=_pct(taken, scheduled),
    )
