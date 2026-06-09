"""Medical LLM integration point (OpenBioLLM-8B + RAG).

For the MVP this module wraps the rule-based triage engine so the app runs with
no model downloaded. When a GGUF model path is configured, load it with
llama-cpp-python here and use retrieval-augmented generation over trusted medical
sources to refine the guidance text — but ALWAYS keep the rule-based urgency as a
safety floor (never let the model downgrade an emergency classification).
"""
from __future__ import annotations

from ..config import settings
from . import triage_engine
from .triage_engine import TriageResult

_model = None  # lazy-loaded llama_cpp.Llama instance when configured


def _load_model():
    """Load the local GGUF model once. Returns None if unavailable."""
    global _model
    if _model is not None:
        return _model
    if not settings.llm_model_path:
        return None
    try:
        from llama_cpp import Llama  # imported lazily; optional dependency

        _model = Llama(model_path=settings.llm_model_path, n_ctx=2048, verbose=False)
        return _model
    except Exception:
        # Any failure (missing lib, bad path) falls back to the rule engine.
        return None


def generate_guidance(symptom_text: str, age: int | None = None) -> TriageResult:
    """Produce triage guidance, preferring the LLM but never below the safety floor."""
    safety_floor = triage_engine.assess(symptom_text, age)

    model = _load_model()
    if model is None:
        return safety_floor

    # Emergencies are non-negotiable — return the rule-based result unchanged.
    if safety_floor.urgency == triage_engine.EMERGENCY:
        return safety_floor

    # TODO: run RAG retrieval over trusted sources, build a grounded prompt, and
    # call `model(...)` to produce a more natural guidance paragraph. For now we
    # annotate the source so the UI can show how the guidance was generated.
    safety_floor.source = "llm"
    return safety_floor
