"""Live BC emergency-department / urgent-care wait times.

Source: edwaittimes.ca (sponsored by Vancouver Coastal Health, Fraser Health,
Providence, PHSA, BC Children's). This is an **undocumented public endpoint** —
so we are deliberately good citizens about it:
  * called only from the backend (never the browser),
  * cached in-memory (short TTL) to minimise load on their servers,
  * attributed in the UI and labelled "estimated",
  * failures fall back to the seeded clinics — the app never breaks if it changes.
"""
from __future__ import annotations

import json
import time
import urllib.request

FEED_URL = "https://edwaittimes.ca/api/wait-times"
_TTL_SECONDS = 120
_UA = "VHN-HealthNav/0.1 (CSIS 4495 student project)"

# edwaittimes facility type -> our locator "kind".
_KIND_MAP = {"ed": "hospital", "upcc": "clinic"}

# Age-eligibility codes -> friendly labels.
_AUDIENCE = {
    "seventeenPlus": "Ages 17+ (adults)",
    "eighteenPlus": "Ages 18+ (adults)",
    "nineteenPlus": "Ages 19+ (adults)",
    "allAges": "All ages",
    "pediatric": "Children & youth",
    "under17": "Under 17 (pediatric)",
}


def _audience_label(code: str | None) -> str | None:
    if not code:
        return None
    return _AUDIENCE.get(code, code)

_cache: dict[str, object] = {"ts": 0.0, "data": None}


def _fetch() -> list[dict]:
    req = urllib.request.Request(FEED_URL, headers={"User-Agent": _UA})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def _normalise(entry: dict) -> dict | None:
    """Map one feed entry to a locator-friendly dict, or None if unusable."""
    lat, lng = entry.get("latitude"), entry.get("longitude")
    if lat is None or lng is None:
        return None
    wait = entry.get("waitTime") or {}
    show = entry.get("showWaitTimes", True)

    alert = None
    if entry.get("alertShow"):
        parts = [entry.get("alertTitle"), entry.get("alertDescription")]
        alert = " — ".join(p for p in parts if p) or None

    return {
        "id": str(entry.get("id")),
        "name": entry.get("name") or "Unknown facility",
        "kind": _KIND_MAP.get(entry.get("type"), "clinic"),
        "address": entry.get("address") or "",
        "latitude": float(lat),
        "longitude": float(lng),
        "open_hours": "24/7" if entry.get("open247") else None,
        "estimated_wait_min": wait.get("waitTimeMinutes") if show else None,
        "phone": entry.get("phone"),
        "website": entry.get("website"),
        "source": "edwaittimes.ca",
        # Extra detail surfaced when the card is expanded.
        "elos_min": wait.get("elosMinutes") if show else None,
        "wait_status": wait.get("status") if show else None,
        "updated_at": wait.get("createdAt") if show else None,
        "description": entry.get("description") or None,
        "audience": _audience_label(entry.get("audience")),
        "additional_info": entry.get("additionalInfo") or None,
        "alert": alert,
        "open247": bool(entry.get("open247")),
    }


def get_live_facilities() -> list[dict] | None:
    """Return normalised live facilities, or None if the feed is unavailable.

    Serves a cached copy within the TTL; on fetch failure returns the last good
    cache if we have one, otherwise None (caller falls back to seeded data).
    """
    now = time.time()
    if _cache["data"] is not None and now - float(_cache["ts"]) < _TTL_SECONDS:
        return _cache["data"]  # type: ignore[return-value]

    try:
        raw = _fetch()
    except Exception:
        return _cache["data"]  # type: ignore[return-value]  # stale cache or None

    facilities = [f for f in (_normalise(e) for e in raw) if f is not None]
    _cache["data"] = facilities
    _cache["ts"] = now
    return facilities
