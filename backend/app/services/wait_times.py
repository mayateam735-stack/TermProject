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
