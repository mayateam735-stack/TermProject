"""Conversational 'Health AI' endpoint.

Safety-bounded, multi-turn AI:
  * The rule engine is the floor — red flags ANYWHERE in the conversation force
    an EMERGENCY reply, bypassing the model.
  * When the user is vague ("I feel unwell"), we ask ONE clarifying question at a
    time (OpenBioLLM phrases it from the conversation; a fixed sequence is the
    fallback) until they name a symptom.
  * Once there's something concrete, we hand off to triage guidance.
Small talk ('hi') gets a friendly intro, not a clinical answer.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..models import Patient
from ..schemas import ChatRequest, ChatResponse
from ..security import get_current_user
from ..services import llm
from ..services import triage_engine
from ..services.triage_engine import DISCLAIMER

router = APIRouter(prefix="/api/chat", tags=["chat"])

GREETINGS = {"hi", "hello", "hey", "yo", "thanks", "thank you", "ok", "okay", "bye"}
INTRO = (
    "Hi! I'm your Health AI assistant. Tell me what symptoms you're feeling — "
    "in your own words — and I'll suggest the right level of care. I can't "
    "diagnose, and anything urgent I'll point you to real care."
)
# Appended to the FIRST clarifying reply so the 911 safety net is never missing.
SAFETY_NET = (
    "And if you have any of these right now — trouble breathing, chest pain, "
    "fainting, one-sided weakness or slurred speech, or a sudden severe headache — "
    "please treat it as an emergency and call 911."
)
# One-at-a-time fallback questions (used when no model is available), by turn.
CLARIFY_QUESTIONS = [
    "I'm sorry you're not feeling well. What's bothering you most right now — "
    "pain, a fever, a cough, an upset stomach, or something else?",
    "Thanks for telling me. How long have you been feeling this way?",
    "Got it. Is there any pain? If so, where is it and how bad from 0 to 10?",
]
MAX_CLARIFY = len(CLARIFY_QUESTIONS)  # after this many turns, give guidance anyway


def _guidance_response(symptom_text: str) -> ChatResponse:
    result = llm.generate_guidance(symptom_text)
    # For a model reply the guidance is already a self-contained sentence; don't
    # prepend the rule headline (that caused the awkward double intro).
    reply = result.guidance if result.source == "llm" else f"{result.headline} {result.guidance}"
    if result.recommended_action:
        reply += f"\n\n→ {result.recommended_action}"
    return ChatResponse(
        reply=reply,
        urgency=result.urgency,
        disclaimer=DISCLAIMER,
        source=result.source,
        self_care_tips=result.self_care_tips,
        remedy_search_url=result.remedy_search_url,
    )


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest, current: Patient = Depends(get_current_user)) -> ChatResponse:
    msg = req.message.strip()
    low = msg.lower()
    history = req.history
    prior_user_turns = sum(1 for t in history if t.role == "user")

    # Small talk only at the very start of a conversation.
    if prior_user_turns == 0 and (low in GREETINGS or len(low) < 3):
        return ChatResponse(reply=INTRO, urgency=None, disclaimer=DISCLAIMER, source="assistant")

    # SAFETY FLOOR: scan the whole conversation for red flags → emergency, always.
    combined = ". ".join([t.content for t in history if t.role == "user"] + [msg])
    assessed = triage_engine.assess(combined)
    if assessed.urgency == triage_engine.EMERGENCY:
        reply = f"{assessed.headline} {assessed.guidance}"
        if assessed.recommended_action:
            reply += f"\n\n→ {assessed.recommended_action}"
        return ChatResponse(reply=reply, urgency="emergency", disclaimer=DISCLAIMER, source="rule-based")

    # Still vague (this message names no symptom) and we haven't over-asked →
    # ask ONE next question, informed by the conversation so far.
    if triage_engine.is_vague_illness(msg) and prior_user_turns < MAX_CLARIFY:
        model_q = llm.next_question(
            [{"role": t.role, "content": t.content} for t in history], msg
        )
        if model_q and len(model_q.strip()) >= 8:
            reply, source = model_q, "llm"
        else:
            reply, source = CLARIFY_QUESTIONS[min(prior_user_turns, MAX_CLARIFY - 1)], "assistant"
        # Guarantee the emergency safety net on the first clarifying turn.
        if prior_user_turns == 0 and "911" not in reply:
            reply = f"{reply}\n\n{SAFETY_NET}"
        return ChatResponse(reply=reply, urgency=None, disclaimer=DISCLAIMER, source=source)

    # We have something concrete (or have asked enough) → triage on the whole thread.
    return _guidance_response(combined)
