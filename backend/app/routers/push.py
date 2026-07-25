"""Web Push subscription management + a manual test-send."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, PushSubscription, Reminder
from ..security import get_current_user
from ..services import push

router = APIRouter(prefix="/api/push", tags=["push"])


class SubKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeBody(BaseModel):
    endpoint: str
    keys: SubKeys
    timezone: str = "UTC"


@router.get("/vapid-key")
def vapid_key() -> dict:
    return {"key": push.public_key()}


@router.post("/subscribe", status_code=204, response_class=Response)
def subscribe(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Response:
    existing = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))
    if existing:
        existing.patient_id = current.id
        existing.p256dh = body.keys.p256dh
        existing.auth = body.keys.auth
        existing.timezone = body.timezone
    else:
        db.add(PushSubscription(
            patient_id=current.id, endpoint=body.endpoint,
            p256dh=body.keys.p256dh, auth=body.keys.auth, timezone=body.timezone,
        ))
    db.commit()
    return Response(status_code=204)


@router.post("/unsubscribe", status_code=204, response_class=Response)
def unsubscribe(
    body: dict,
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> Response:
    endpoint = body.get("endpoint")
    if endpoint:
        sub = db.scalar(select(PushSubscription).where(
            PushSubscription.endpoint == endpoint, PushSubscription.patient_id == current.id))
        if sub:
            db.delete(sub)
            db.commit()
    return Response(status_code=204)


@router.post("/test")
def test_push(
    db: Session = Depends(get_db),
    current: Patient = Depends(get_current_user),
) -> dict:
    subs = db.scalars(select(PushSubscription).where(
        PushSubscription.patient_id == current.id)).all()
    # Use the user's first reminder so the test shows working Take/Skip buttons.
    r = db.scalar(select(Reminder).where(Reminder.patient_id == current.id).order_by(Reminder.time_of_day))
    if r:
        payload = {"title": f"Time for {r.medication}",
                   "body": f"{r.dosage or 'Your dose'} — Take or Skip below.",
                   "url": "/meds", "reminderId": r.id, "tag": f"med-{r.id}"}
    else:
        payload = {"title": "HealthNav", "body": "🔔 Test — notifications are working!", "url": "/meds"}
    sent = 0
    for s in subs:
        sent += 1 if push.send(
            {"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh, "auth": s.auth}}, payload
        ) else 0
    return {"subscriptions": len(subs), "sent": sent}
