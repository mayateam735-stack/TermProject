"""Conversational 'Health AI' endpoint.

Same safety-bounded AI as triage: the rule engine is the floor (red flags ->
emergency), the LLM (when configured) refines wording. For small talk we reply
conversationally instead of triaging, so 'hi' doesn't get a clinical answer.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..models import Patient
from ..schemas import ChatRequest, ChatResponse
from ..security import get_current_user
from ..services import llm
from ..services.triage_engine import DISCLAIMER

router = APIRouter(prefix="/api/chat", tags=["chat"])

GREETINGS = {"hi", "hello", "hey", "yo", "thanks", "thank you", "ok", "okay", "bye"}
INTRO = (
    "Hi! I'm your Health AI assistant. Tell me what symptoms you're feeling — "
    "in your own words — and I'll suggest the right level of care. I can't "
    "diagnose, and anything urgent I'll point you to real care."
)


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest, current: Patient = Depends(get_current_user)) -> ChatResponse:
    msg = req.message.strip().lower()
    if msg in GREETINGS or len(msg) < 3:
        return ChatResponse(reply=INTRO, urgency=None, disclaimer=DISCLAIMER, source="assistant")

    result = llm.generate_guidance(req.message)
    reply = f"{result.headline} {result.guidance}"
    if result.recommended_action:
        reply += f"\n\n→ {result.recommended_action}"
    return ChatResponse(
        reply=reply,
        urgency=result.urgency,
        disclaimer=DISCLAIMER,
        source=result.source,
    )
