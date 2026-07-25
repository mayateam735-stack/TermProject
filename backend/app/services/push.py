"""Web Push helpers: VAPID key management + sending notifications.

VAPID keys are auto-generated on first use and stored next to the app (git-ignored),
so nothing manual is required. The public "application server key" is handed to the
browser; pushes are signed with the private key via pywebpush.
"""
from __future__ import annotations

import base64
import json
from pathlib import Path

from ..config import settings

_KEY_DIR = Path(__file__).resolve().parents[2]  # backend/
_PRIV = _KEY_DIR / "vapid_private.pem"
_PUB = _KEY_DIR / "vapid_public.txt"


def ensure_keys() -> str:
    """Generate the VAPID keypair on first call; return the public app-server key."""
    if _PRIV.exists() and _PUB.exists():
        return _PUB.read_text().strip()

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    pk = ec.generate_private_key(ec.SECP256R1())
    _PRIV.write_text(pk.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode())
    point = pk.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    app_key = base64.urlsafe_b64encode(point).rstrip(b"=").decode()
    _PUB.write_text(app_key)
    return app_key


def public_key() -> str:
    return ensure_keys()


def send(subscription: dict, payload: dict) -> bool:
    """Send one push. Returns True on success; False (and swallows) on failure."""
    ensure_keys()
    try:
        from pywebpush import webpush

        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=str(_PRIV),
            vapid_claims={"sub": settings.vapid_subject},
            timeout=10,
        )
        return True
    except Exception:
        return False
