"""Application configuration loaded from environment / .env."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./vhn.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Session cookie's Secure flag — browsers only send it back over HTTPS.
    # Leave False for local http://localhost dev; set True on Railway (HTTPS).
    cookie_secure: bool = False

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
    # VAPID keypair. Leave blank locally (auto-generated + cached to disk). In
    # production SET BOTH so the keys survive redeploys — otherwise a fresh pair
    # is generated each deploy and every existing push subscription breaks.
    # Private key is a PKCS8 PEM; newlines may be written as literal "\n".
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    # Periodically ping the hosted LLM to keep it warm. OFF by default — on a free
    # HF account this burns the limited monthly inference credit. Enable only with billing.
    llm_keep_warm: bool = False
    # GGUF path for the llamacpp backend. Empty => stub / fall back to rules.
    llm_model_path: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
