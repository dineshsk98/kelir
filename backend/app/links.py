"""Private capsule links: a 256-bit random secret in the URL, only its SHA-256 hash stored."""

import hashlib
import secrets


def new_link_secret() -> tuple[str, str]:
    """Return (secret for the URL, hash to store)."""
    secret = secrets.token_urlsafe(32)
    return secret, hash_link_secret(secret)


def hash_link_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def capsule_url(base_url: str, secret: str) -> str:
    return f"{base_url.rstrip('/')}/c/{secret}"
