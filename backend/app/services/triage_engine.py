"""Safety-first triage logic — the heart of "guidance, not diagnosis".

The engine always errs toward caution. It first scans for emergency "red flags";
if any are present the result is escalated to EMERGENCY regardless of anything
else. Only when no red flags are found does it weigh the softer signals — the
symptom keywords/tags, the reported pain level, and how long symptoms have
lasted — and pick an urgency band. Pain and duration can only ever *raise*
urgency, never lower it. This directly addresses the central patient-safety
concern raised in the symptom-checker literature (Wallace et al., 2022).
"""
from __future__ import annotations

import re
import urllib.parse
from dataclasses import dataclass, field

# Urgency levels, ordered from least to most severe (higher rank = more urgent).
SELF_CARE = "self_care"
ROUTINE = "routine"
URGENT = "urgent"
EMERGENCY = "emergency"

RANK = {SELF_CARE: 0, ROUTINE: 1, URGENT: 2, EMERGENCY: 3}
BY_RANK = {rank: name for name, rank in RANK.items()}

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

# Mild symptoms (including the quick-select tags) that are usually self-manageable.
SELF_CARE_RULES: dict[str, tuple[str, ...]] = {
    "cold symptoms": ("runny nose", "sore throat", "sneezing", "cough", "stuffy nose"),
    "mild headache": ("headache",),
    "nausea": ("nausea", "queasy"),
    "tiredness": ("muscle ache", "tired", "fatigue"),
    "mild fever": ("mild fever", "slight fever"),
}

# Over-the-counter / home-care suggestions, shown ONLY for a self_care result.
# General drugstore options — not prescriptions or dosing. The UI pairs these
# with a "read the label / ask your pharmacist" note.
SELF_CARE_REMEDIES: dict[str, list[str]] = {
    "cold symptoms": [
        "Rest and drink plenty of warm fluids",
        "Saline nasal spray or a decongestant for a stuffy nose",
        "Throat lozenges, or warm water with honey and lemon for a sore throat",
        "An over-the-counter cough syrup (e.g. dextromethorphan) can ease a bothersome cough",
    ],
    "mild headache": [
        "Rest, hydrate, and cut down on screen time",
        "An OTC pain reliever such as acetaminophen (Tylenol) or ibuprofen (Advil)",
        "A cool compress on the forehead can help",
    ],
    "nausea": [
        "Sip clear fluids slowly; ginger tea or ginger candies can settle the stomach",
        "Eat small, bland foods (crackers, toast, rice)",
        "An OTC antacid may help if it feels like indigestion",
    ],
    "tiredness": [
        "Prioritize rest and gentle stretching",
        "Stay hydrated; an OTC pain reliever can ease muscle aches",
    ],
    "mild fever": [
        "Rest and drink plenty of fluids",
        "Acetaminophen or ibuprofen can help bring a fever down",
        "Dress lightly and keep your room cool",
    ],
}

_GENERIC_REMEDIES = [
    "Rest and stay well hydrated",
    "An OTC pain/fever reliever (acetaminophen or ibuprofen) can ease aches or fever",
    "Ask your pharmacist to recommend an over-the-counter option for your symptoms",
]


def remedy_search_url(symptom_text: str) -> str:
    """A Google search for home/OTC remedies for what the user described."""
    q = urllib.parse.quote_plus(
        f"home remedies and over-the-counter treatment for {symptom_text.strip()}"
    )
    return f"https://www.google.com/search?q={q}"


# Pain thresholds (0–10 self-reported scale).
PAIN_SEVERE = 8   # 8–10 -> at least urgent
PAIN_MODERATE = 5  # 5–7  -> at least routine

# Per-band copy. EMERGENCY is built separately because it references red flags.
BAND_COPY: dict[str, tuple[str, str, str]] = {
    URGENT: (
        "You should be seen soon.",
        "Your symptoms suggest you should be assessed today. Consider a walk-in "
        "clinic, urgent care, or calling HealthLink BC at 8-1-1. If things get "
        "worse or you develop any emergency warning signs, go to the ER.",
        "Visit a walk-in / urgent care clinic today",
    ),
    ROUTINE: (
        "It's worth checking with a clinician.",
        "Your symptoms aren't clearly an emergency, but they're worth getting "
        "looked at. Consider booking with your family doctor or a walk-in clinic, "
        "or call HealthLink BC at 8-1-1. Seek emergency care if anything suddenly "
        "worsens.",
        "Book a routine clinic / family doctor visit",
    ),
    SELF_CARE: (
        "This can likely be managed at home.",
        "Your symptoms are usually mild and can often be managed with rest, "
        "fluids, and over-the-counter remedies. Monitor how you feel. If symptoms "
        "last more than a few days or get worse, see a clinician.",
        "Self-care and monitor",
    ),
}


@dataclass
class TriageResult:
    urgency: str
    headline: str
    guidance: str
    red_flags: list[str] = field(default_factory=list)  # reasons that drove the result
    recommended_action: str = ""
    source: str = "rule-based"
    # Populated ONLY for self_care — never for routine/urgent/emergency.
    self_care_tips: list[str] = field(default_factory=list)
    remedy_search_url: str | None = None


def _norm(s: str) -> str:
    """Lowercase and drop apostrophes so 'cant breathe' matches \"can't breathe\".

    Missing apostrophes are extremely common in typed input; without this a
    red flag like \"can't breathe\" would silently fail to match — a safety bug.
    """
    return re.sub(r"[’'`]", "", s.lower())


def _match(text: str, rules: dict[str, tuple[str, ...]]) -> list[str]:
    """Return the rule labels whose keywords appear in `text` (apostrophe-insensitive)."""
    t = _norm(text)
    return [label for label, kws in rules.items() if any(_norm(kw) in t for kw in kws)]


# "I feel unwell" style phrases that state illness without naming a symptom.
VAGUE_PHRASES: tuple[str, ...] = (
    "sick", "unwell", "not feeling well", "not feeling good", "dont feel well",
    "dont feel good", "i am ill", "im ill", "feeling off", "under the weather",
    "not myself", "something is wrong", "somethings wrong", "not well", "not right",
    "out of sorts", "run down", "rundown",
)
# "feel [a bit/really/so] bad/awful/…" — catches intensifiers between the words.
_VAGUE_RE = re.compile(
    r"\bfeel(?:ing)?\b(?:\s+\w+){0,2}\s+"
    r"(bad|sick|unwell|ill|awful|terrible|horrible|rough|lousy|crappy|gross|"
    r"weird|funny|strange|off|poorly|nauseous)\b"
)


def is_vague_illness(symptom_text: str) -> bool:
    """True when the user says they feel unwell but names no concrete symptom.

    Used to ask clarifying questions instead of triaging thin air. Returns False
    the moment any red-flag / urgent / self-care keyword is present, so a message
    like "I feel sick and can't breathe" still goes straight to triage.
    """
    text = _norm(symptom_text)
    if not (_VAGUE_RE.search(text) or any(p in text for p in VAGUE_PHRASES)):
        return False
    return not (
        _match(symptom_text, RED_FLAG_RULES)
        or _match(symptom_text, URGENT_RULES)
        or _match(symptom_text, SELF_CARE_RULES)
    )


def _is_prolonged(duration: str | None) -> bool:
    """True when the reported duration indicates a lingering, non-acute problem."""
    if not duration:
        return False
    d = duration.lower()
    return "week" in d or "more" in d or "6 day" in d


def assess(
    symptom_text: str,
    age: int | None = None,
    pain_level: int = 0,
    duration: str | None = None,
) -> TriageResult:
    """Classify symptoms into a safety-first urgency band.

    Tags/keywords set the baseline; pain level and duration can only escalate it.
    """
    text = symptom_text.lower().strip()

    # 1) Red flags always win — the safety floor.
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

    reasons: list[str] = []

    # 2) Baseline from symptom keywords / quick-select tags.
    urgent_hits = _match(text, URGENT_RULES)
    self_care_hits = _match(text, SELF_CARE_RULES)
    if urgent_hits:
        rank = RANK[URGENT]
        reasons += urgent_hits
    elif self_care_hits:
        rank = RANK[SELF_CARE]
        reasons += self_care_hits
    else:
        # Nothing recognised -> stay cautious rather than reassure.
        rank = RANK[ROUTINE]

    # 3) Pain level can raise the band (never lower it).
    if pain_level >= PAIN_SEVERE:
        if RANK[URGENT] > rank:
            rank = RANK[URGENT]
        reasons.append(f"severe pain ({pain_level}/10)")
    elif pain_level >= PAIN_MODERATE:
        if RANK[ROUTINE] > rank:
            rank = RANK[ROUTINE]
        reasons.append(f"moderate pain ({pain_level}/10)")

    # 4) Prolonged symptoms nudge an otherwise mild case up to a clinician visit.
    if _is_prolonged(duration) and rank < RANK[URGENT]:
        if RANK[ROUTINE] > rank:
            rank = RANK[ROUTINE]
        reasons.append(f"symptoms lasting {duration.lower()}")

    urgency = BY_RANK[rank]
    headline, guidance, action = BAND_COPY[urgency]

    # Attach OTC/home-care suggestions only when the result is self_care.
    tips: list[str] = []
    search_url: str | None = None
    if urgency == SELF_CARE:
        seen: set[str] = set()
        for label in self_care_hits:
            for tip in SELF_CARE_REMEDIES.get(label, []):
                if tip not in seen:
                    seen.add(tip)
                    tips.append(tip)
        tips = (tips or list(_GENERIC_REMEDIES))[:5]
        search_url = remedy_search_url(symptom_text)

    return TriageResult(
        urgency=urgency,
        headline=headline,
        guidance=guidance,
        red_flags=reasons,
        recommended_action=action,
        self_care_tips=tips,
        remedy_search_url=search_url,
    )
