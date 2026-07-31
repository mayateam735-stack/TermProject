"""Web Push helpers: VAPID key management + sending notifications.

Key resolution order (see `ensure_keys`):
  1. Environment (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`) — use in production so
     the keypair survives redeploys and existing subscriptions keep working.
  2. Files next to the app (git-ignored) — a previously generated local pair.
  3. Freshly generated — cached to disk for local dev; the values to promote to
     env for production are printed once so you can copy them.
The public "application server key" is handed to the browser; pushes are signed
with the private key via pywebpush.
"""
from __future__ import annotations

import base64
import json
import tempfile
from pathlib import Path

from ..config import settings

_KEY_DIR = Path(__file__).resolve().parents[2]  # backend/
_PRIV = _KEY_DIR / "vapid_private.pem"
_PUB = _KEY_DIR / "vapid_public.txt"

# Resolved once per process: (public app-server key, path to the private PEM).
_cached: tuple[str, str] | None = None


def _write_private(pem: str) -> str:
    """Persist the private PEM to a file pywebpush can read; return its path.

    Prefers the app dir; falls back to a temp file if that isn't writable
    (e.g. a read-only container filesystem)."""
    pem = pem.replace("\\n", "\n").strip() + "\n"
    for target in (_PRIV, Path(tempfile.gettempdir()) / "vhn_vapid_private.pem"):
        try:
            target.write_text(pem)
            return str(target)
        except OSError:
            continue
    raise RuntimeError("Could not write VAPID private key to any writable location")


def _resolve() -> tuple[str, str]:
    # 1. Environment-provided (production).
    if settings.vapid_public_key and settings.vapid_private_key:
        return settings.vapid_public_key.strip(), _write_private(settings.vapid_private_key)

    # 2. Previously generated files.
    if _PRIV.exists() and _PUB.exists():
        return _PUB.read_text().strip(), str(_PRIV)

    # 3. Generate a fresh pair (local dev), cache to disk, print for promotion.
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    pk = ec.generate_private_key(ec.SECP256R1())
    pem = pk.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    point = pk.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    app_key = base64.urlsafe_b64encode(point).rstrip(b"=").decode()

    priv_path = _write_private(pem)
    try:
        _PUB.write_text(app_key)
    except OSError:
        pass
    print("[push] Generated a VAPID keypair. To keep push working across "
          "production redeploys, set these env vars:")
    print(f"[push]   VAPID_PUBLIC_KEY={app_key}")
    print("[push]   VAPID_PRIVATE_KEY=" + pem.replace("\n", "\\n"))
    return app_key, priv_path


def ensure_keys() -> str:
    """Resolve the keypair once; return the public app-server key."""
    global _cached
    if _cached is None:
        _cached = _resolve()
    return _cached[0]


def public_key() -> str:
    return ensure_keys()


def send(subscription: dict, payload: dict) -> bool:
    """Send one push. Returns True on success; False (and swallows) on failure."""
    ensure_keys()
    assert _cached is not None
    try:
        from pywebpush import webpush

        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=_cached[1],
            vapid_claims={"sub": settings.vapid_subject},
            timeout=10,
        )
        return True
    except Exception:
        return False
