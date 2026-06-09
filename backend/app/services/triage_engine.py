"""Safety-first triage logic — the heart of "guidance, not diagnosis".

The engine always errs toward caution. It first scans for emergency "red flags";
if any are present the result is escalated to EMERGENCY regardless of anything
else. Only when no red flags are found does it fall through to softer urgency
bands. This directly addresses the central patient-safety concern raised in the
symptom-checker literature (Wallace et al., 2022).
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Urgency levels, ordered from most to least severe.
EMERGENCY = "emergency"
URGENT = "urgent"
ROUTINE = "routine"
SELF_CARE = "self_care"

DISCLAIMER = (
    "This is general guidance, not a medical diagnosis. If you think this is an "
    "emergency, call 911. In British Columbia you can also call HealthLink BC at "
    "8-1-1 to speak with a nurse any time."
)

# Phrases that should immediately route a user to emergency care.
# Kept as plain keyword groups so they are easy to review and extend.
RED_FLAG_RULES: dict[str, tuple[str, ...]] = {
    "chest pain or pressure": ("chest pain", "chest pressure", "chest tightness"),
    "difficulty breathing": ("can't breathe", "cannot breathe", "trouble breathing",
                             "short of breath", "shortness of breath", "gasping"),
    "signs of stroke": ("face drooping", "slurred speech", "can't speak", "cannot speak",
                        "numb on one side", "weakness on one side", "sudden confusion"),
    "severe bleeding": ("heavy bleeding", "won't stop bleeding", "uncontrolled bleeding"),
    "loss of consciousness": ("passed out", "unconscious", "fainted", "unresponsive"),
    "anaphylaxis": ("throat closing", "swelling of the throat", "severe allergic"),
    "suicidal thoughts": ("suicidal", "kill myself", "end my life", "want to die"),
    "severe head injury": ("severe head injury", "head injury", "hit my head hard"),
}

# Symptoms that warrant same-day / urgent (but not necessarily 911) attention.
URGENT_RULES: dict[str, tuple[str, ...]] = {
    "high fever": ("high fever", "fever of 39", "fever of 40", "very high temperature"),
    "persistent vomiting": ("can't keep fluids down", "vomiting blood", "persistent vomiting"),
    "severe pain": ("severe pain", "worst pain", "unbearable pain", "10 out of 10 pain"),
    "dehydration": ("severe dehydration", "no urine", "very dizzy when standing"),
    "infected wound": ("spreading redness", "pus", "infected wound"),
}

# Mild symptoms that are usually safe to self-manage.
SELF_CARE_RULES: dict[str, tuple[str, ...]] = {
    "common cold": ("runny nose", "sore throat", "sneezing", "mild cough", "stuffy nose"),
    "mild headache": ("mild headache", "slight headache"),
    "minor aches": ("muscle ache", "tired", "fatigue", "mild fever"),
}


@dataclass
class TriageResult:
    urgency: str
    headline: str
    guidance: str
    red_flags: list[str] = field(default_factory=list)
    recommended_action: str = ""
    source: str = "rule-based"


def _match(text: str, rules: dict[str, tuple[str, ...]]) -> list[str]:
    """Return the rule labels whose keywords appear in `text`."""
    found = []
    for label, keywords in rules.items():
        if any(kw in text for kw in keywords):
            found.append(label)
    return found


def assess(symptom_text: str, age: int | None = None) -> TriageResult:
    """Classify free-text symptoms into a safety-first urgency band."""
    text = symptom_text.lower().strip()

    red_flags = _match(text, RED_FLAG_RULES)
    if red_flags:
        return TriageResult(
            urgency=EMERGENCY,
            headline="This may be an emergency.",
            guidance=(
                "Based on what you described, you should seek emergency care now. "
                "Call 911 or go to the nearest emergency department. Do not drive "
                "yourself if you feel faint or are having trouble breathing."
            ),
            red_flags=red_flags,
            recommended_action="Call 911 / go to the nearest ER",
        )

    urgent = _match(text, URGENT_RULES)
    if urgent:
        return TriageResult(
            urgency=URGENT,
            headline="You should be seen soon.",
            guidance=(
                "Your symptoms suggest you should be assessed today. Consider a "
                "walk-in clinic, urgent care, or calling HealthLink BC at 8-1-1. "
                "If things get worse or you develop any emergency warning signs, "
                "go to the ER."
            ),
            red_flags=urgent,
            recommended_action="Visit a walk-in / urgent care clinic today",
        )

    self_care = _match(text, SELF_CARE_RULES)
    if self_care:
        return TriageResult(
            urgency=SELF_CARE,
            headline="This can likely be managed at home.",
            guidance=(
                "Your symptoms are usually mild and can often be managed with rest, "
                "fluids, and over-the-counter remedies. Monitor how you feel. If "
                "symptoms last more than a few days or get worse, see a clinician."
            ),
            red_flags=[],
            recommended_action="Self-care and monitor",
        )

    # No rule matched — stay cautious and route to a clinician rather than
    # reassure the user about something we did not recognise.
    return TriageResult(
        urgency=ROUTINE,
        headline="It's worth checking with a clinician.",
        guidance=(
            "We couldn't confidently match your symptoms to a clear category. To be "
            "safe, consider booking with your family doctor or a walk-in clinic, or "
            "call HealthLink BC at 8-1-1. Seek emergency care if you develop severe "
            "or sudden symptoms."
        ),
        red_flags=[],
        recommended_action="Book a routine clinic / family doctor visit",
    )
