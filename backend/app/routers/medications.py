"""Medication name autocomplete, backed by the NLM RxTerms API (free, no key).

Proxied server-side so the browser doesn't deal with CORS, and so we can degrade
gracefully to an empty list if the external service is unavailable.
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, Query

from ..models import Patient
from ..security import get_current_user

router = APIRouter(prefix="/api/medications", tags=["medications"])

_RXTERMS = "https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search"
_OPENFDA = "https://api.fda.gov/drug/label.json"


def _clean_name(name: str) -> str:
    """'Amoxicillin (Oral Pill)' / 'glyBURIDE/metFORMIN' -> 'Amoxicillin'."""
    base = re.split(r"[(/]", name)[0].strip()
    return base.split()[0] if base else name.strip()


@router.get("/search")
def search_medications(
    q: str = Query(min_length=1, max_length=80),
    _: Patient = Depends(get_current_user),
) -> dict:
    """Return up to 8 medication-name suggestions matching `q`."""
    url = f"{_RXTERMS}?terms={urllib.parse.quote(q)}&maxList=8"
    req = urllib.request.Request(url, headers={"User-Agent": "VHN-HealthNav/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        # RxTerms format: [count, [codes], extra, [[display_name], ...]]
        rows = data[3] if isinstance(data, list) and len(data) > 3 else []
        results = [row[0] for row in rows if row]
        return {"results": results}
    except Exception:
        return {"results": []}


def _fetch_label(field: str, name: str) -> str | None:
    q = urllib.parse.quote(f'{field}:"{name}"')
    url = f"{_OPENFDA}?search={q}&limit=1"
    req = urllib.request.Request(url, headers={"User-Agent": "VHN-HealthNav/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        res = data.get("results") or []
        if not res:
            return None
        for key in ("indications_and_usage", "purpose", "description"):
            val = res[0].get(key)
            if val:
                text = val[0] if isinstance(val, list) else str(val)
                text = re.sub(r"\s+", " ", text).strip()
                # Drop leading label-section headers like "1 INDICATIONS AND USAGE".
                text = re.sub(r"^\s*[\d.]*\s*(INDICATIONS AND USAGE|PURPOSES?|DESCRIPTION)\s*",
                              "", text, flags=re.IGNORECASE).strip()
                return text[:600] + ("…" if len(text) > 600 else "")
        return None
    except Exception:
        return None


@router.get("/info")
def medication_info(
    name: str = Query(min_length=1, max_length=120),
    _: Patient = Depends(get_current_user),
) -> dict:
    """A plain-language 'what it's for' blurb from the openFDA drug label API."""
    base = _clean_name(name)
    info = _fetch_label("openfda.generic_name", base) or _fetch_label("openfda.brand_name", base)
    return {"name": base, "info": info}
