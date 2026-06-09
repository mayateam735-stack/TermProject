"""Triage endpoint — the symptom checker and 'Should I go to the ER?' flow."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SymptomCheck
from ..schemas import TriageRequest, TriageResponse
from ..services import llm
from ..services.triage_engine import DISCLAIMER

router = APIRouter(prefix="/api/triage", tags=["triage"])


@router.post("", response_model=TriageResponse)
def triage(req: TriageRequest, db: Session = Depends(get_db)) -> TriageResponse:
    result = llm.generate_guidance(req.symptom_text, req.age)

    # Persist the interaction so the user keeps a private health history.
    db.add(
        SymptomCheck(
            patient_id=req.patient_id,
            symptom_text=req.symptom_text,
            urgency=result.urgency,
            guidance=result.guidance,
            red_flags=", ".join(result.red_flags) or None,
        )
    )
    db.commit()

    return TriageResponse(
        urgency=result.urgency,
        headline=result.headline,
        guidance=result.guidance,
        red_flags=result.red_flags,
        recommended_action=result.recommended_action,
        disclaimer=DISCLAIMER,
        source=result.source,
    )
