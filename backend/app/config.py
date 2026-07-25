"""Application configuration loaded from environment / .env."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./vhn.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # LLM backend: "" (rule-based stub), "hf_api", "transformers", or "llamacpp".
    llm_backend: str = ""
    # Hugging Face model id (used by hf_api and transformers backends).
    llm_model_id: str = "aaditya/Llama3-OpenBioLLM-8B"
    # HF access token for the hosted Inference API (hf_api backend). Free from
    # https://huggingface.co/settings/tokens — nothing is downloaded locally.
    hf_token: str = ""
    # HF Inference provider that serves the model (OpenBioLLM-8B is on Featherless).
    hf_provider: str = "featherless-ai"
    # Web Push (VAPID) contact — required by push services in the JWT "sub" claim.
    vapid_subject: str = "mailto:healthnav@example.com"
    # GGUF path for the llamacpp backend. Empty => stub / fall back to rules.
    llm_model_path: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
