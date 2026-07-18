"""Medical LLM integration (OpenBioLLM) — with the rule engine as a safety floor.

Two backends are supported, chosen via LLM_BACKEND:
  * "transformers" — OpenBioLLM via Hugging Face Transformers (AutoModelForCausalLM
    + AutoTokenizer). GPU strongly recommended; use the 8B, not the 70B.
  * "llamacpp"     — a local GGUF quant served by llama-cpp-python (lighter).
  * ""  (default)  — no model; guidance comes straight from the rule engine.

Whatever the backend, the rule-based urgency is a HARD floor: emergencies are
returned untouched and the model is only ever allowed to reword the *guidance*
for non-emergencies. Any missing dependency / load failure degrades gracefully to
the rule engine, so the app always runs.
"""
from __future__ import annotations

import time

from ..config import settings
from . import triage_engine
from .triage_engine import TriageResult

# Grounding + guardrails. Note: we deliberately do NOT use OpenBioLLM's default
# "medical expert" system prompt — inside a triage app the model must stay in
# safe-guidance mode (no diagnosis, no specific dosing/treatment instructions)
# and must never contradict the rule-engine urgency.
SYSTEM_PROMPT = (
    "You are OpenBioLLM, a biomedical assistant used inside a British Columbia "
    "triage app. Draw on accurate medical knowledge but explain in plain language "
    "a general audience can follow. You are NOT a doctor: do NOT diagnose and do "
    "NOT give specific medication dosing or treatment instructions — direct those "
    "to a pharmacist or clinician. The safety system has already set the urgency "
    "to '{urgency}'; never contradict or downplay it. Give brief (2-4 sentence) "
    "self-care guidance, and always remind the user this is guidance, not a "
    "diagnosis, and to call 911 or HealthLink BC at 8-1-1 if things worsen."
)

_pipeline = None  # transformers text-generation pipeline
_model = None     # llama_cpp model
_load_failed = False


# ---- Transformers backend (OpenBioLLM via pipeline) ------------------------
def _load_transformers():
    """Lazy-load OpenBioLLM as a text-generation pipeline. Returns it or None."""
    global _pipeline, _load_failed
    if _pipeline is not None:
        return _pipeline
    if _load_failed:
        return None
    try:
        import torch
        import transformers

        _pipeline = transformers.pipeline(
            "text-generation",
            model=settings.llm_model_id,
            model_kwargs={"torch_dtype": torch.bfloat16},
            device_map="auto",
        )
        return _pipeline
    except Exception:
        _load_failed = True  # missing torch/transformers, no GPU, bad id, OOM…
        return None


def _generate_transformers(user_text: str, urgency: str) -> str | None:
    pipe = _load_transformers()
    if pipe is None:
        return None
    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT.format(urgency=urgency)},
            {"role": "user", "content": user_text},
        ]
        prompt = pipe.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        terminators = [
            pipe.tokenizer.eos_token_id,
            pipe.tokenizer.convert_tokens_to_ids("<|eot_id|>"),
        ]
        outputs = pipe(
            prompt,
            max_new_tokens=256,
            eos_token_id=terminators,
            do_sample=True,
            temperature=0.3,
            top_p=0.9,
        )
        text = outputs[0]["generated_text"][len(prompt):]
        return text.strip() or None
    except Exception:
        return None


# ---- llama-cpp (GGUF) backend ---------------------------------------------
def _load_llamacpp():
    global _model, _load_failed
    if _model is not None:
        return _model
    if _load_failed or not settings.llm_model_path:
        return None
    try:
        from llama_cpp import Llama

        _model = Llama(model_path=settings.llm_model_path, n_ctx=2048, verbose=False)
        return _model
    except Exception:
        _load_failed = True
        return None


def _generate_llamacpp(user_text: str, urgency: str) -> str | None:
    model = _load_llamacpp()
    if model is None:
        return None
    try:
        prompt = SYSTEM_PROMPT.format(urgency=urgency) + f"\n\nSymptoms: {user_text}\n\nGuidance:"
        out = model(prompt, max_tokens=256, temperature=0.3, stop=["\n\n"])
        return out["choices"][0]["text"].strip() or None
    except Exception:
        return None


def status() -> dict:
    """Report which AI backend is active — used by the UI to show the source."""
    backend = settings.llm_backend.strip().lower() or "stub"
    using_model = backend in ("hf_api", "transformers", "llamacpp")
    if backend == "hf_api":
        model, ready = settings.llm_model_id, bool(settings.hf_token)
    elif backend == "transformers":
        model, ready = settings.llm_model_id, _pipeline is not None
    elif backend == "llamacpp":
        model, ready = settings.llm_model_path or None, _model is not None
    else:
        model, ready = None, False
    return {
        "backend": backend,
        "model": model,
        "loaded": ready,
        "label": "OpenBioLLM" if using_model else "Safety-rules engine",
    }


# ---- Hugging Face hosted Inference API (no local download) -----------------
# OpenBioLLM-8B is served as a *text-generation* model (not chat) via the
# Featherless provider, so we build the Llama-3 instruct prompt ourselves.
_LLAMA3_TEMPLATE = (
    "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system}"
    "<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{user}"
    "<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
)


# Provider errors worth retrying: cold-start / overload / rate limit.
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 5


def warm() -> bool:
    """Ping the hosted model to keep it loaded (reduces cold-start 503s).

    Called periodically by a background task on startup. Returns True on success.
    """
    if settings.llm_backend.strip().lower() != "hf_api" or not settings.hf_token:
        return False
    return _generate_hf_api("mild cold symptoms", "self_care") is not None


def _generate_hf_api(user_text: str, urgency: str) -> str | None:
    """Run OpenBioLLM on Hugging Face's servers. Requires HF_TOKEN; no local download.

    The free Featherless provider intermittently returns 503 (cold-start/overload),
    so we retry a couple of times with a short backoff before falling back to rules.
    """
    if not settings.hf_token:
        return None
    try:
        from huggingface_hub import InferenceClient
    except Exception:
        return None

    client = InferenceClient(provider=settings.hf_provider or None, api_key=settings.hf_token)
    prompt = _LLAMA3_TEMPLATE.format(system=SYSTEM_PROMPT.format(urgency=urgency), user=user_text)

    for attempt in range(_MAX_ATTEMPTS):
        try:
            text = client.text_generation(
                prompt,
                model=settings.llm_model_id,
                max_new_tokens=256,
                temperature=0.3,
                stop=["<|eot_id|>"],
            )
            return (text or "").strip() or None
        except Exception as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in _RETRYABLE_STATUS and attempt < _MAX_ATTEMPTS - 1:
                time.sleep(1.5 * (attempt + 1))  # 1.5s, then 3s
                continue
            return None  # non-retryable, or out of attempts -> fall back to rules
    return None


def _run_model(user_text: str, urgency: str) -> str | None:
    backend = settings.llm_backend.strip().lower()
    if backend == "hf_api":
        return _generate_hf_api(user_text, urgency)
    if backend == "transformers":
        return _generate_transformers(user_text, urgency)
    if backend == "llamacpp":
        return _generate_llamacpp(user_text, urgency)
    return None  # stub: no model configured


def generate_guidance(
    symptom_text: str,
    age: int | None = None,
    pain_level: int = 0,
    duration: str | None = None,
) -> TriageResult:
    """Produce triage guidance. The rule-based urgency is the safety floor."""
    result = triage_engine.assess(symptom_text, age, pain_level, duration)

    # Emergencies are non-negotiable — never send them to the model.
    if result.urgency == triage_engine.EMERGENCY:
        return result

    reply = _run_model(symptom_text, result.urgency)
    if reply:
        result.guidance = reply       # model may reword the guidance…
        result.source = "llm"         # …but the urgency + red flags stay rule-based.
    return result
