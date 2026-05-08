"""
identity.py — Ed25519 keypair management, signing, and verification.
node_id = SHA-256(public_key_bytes) encoded as hex.
Private key is NEVER shared over the network.
"""
import base64
import hashlib
import json

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
    PrivateFormat,
    NoEncryption,
)

from modules import storage

_IDENTITY_FILE = "identity.json"

# Module-level cache so we only load once per process
_identity: dict | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _priv_to_bytes(key: Ed25519PrivateKey) -> bytes:
    return key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())


def _pub_to_bytes(key: Ed25519PublicKey) -> bytes:
    return key.public_bytes(Encoding.Raw, PublicFormat.Raw)


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def _unb64(s: str) -> bytes:
    return base64.b64decode(s)


def _node_id_from_pub(pub_bytes: bytes) -> str:
    # Use raw hex of public key for absolute consistency across all devices
    return pub_bytes.hex()


# ── Public API ────────────────────────────────────────────────────────────────

async def init() -> dict:
    """Load existing identity or generate a new keypair."""
    global _identity
    if _identity:
        return _identity

    saved = await storage.read(_IDENTITY_FILE)
    if saved:
        _identity = saved
        return _identity

    # Generate fresh keypair
    priv = Ed25519PrivateKey.generate()
    pub = priv.public_key()
    pub_bytes = _pub_to_bytes(pub)

    _identity = {
        "node_id": _node_id_from_pub(pub_bytes),
        "public_key": _b64(pub_bytes),
        "private_key": _b64(_priv_to_bytes(priv)),  # stored locally only
    }
    await storage.write(_IDENTITY_FILE, _identity)
    return _identity


def get() -> dict:
    """Return cached identity (call init() first)."""
    if not _identity:
        raise RuntimeError("Identity not initialised — call await identity.init()")
    return _identity


def sign(message: str | bytes) -> str:
    """Sign a message with this node's private key. Returns base64 signature."""
    if isinstance(message, str):
        message = message.encode()
    priv_bytes = _unb64(_identity["private_key"])
    priv = Ed25519PrivateKey.from_private_bytes(priv_bytes)
    return _b64(priv.sign(message))


def verify(message: str | bytes, signature: str, public_key_b64: str) -> bool:
    """Verify a signature against a given public key. Returns True/False."""
    if isinstance(message, str):
        message = message.encode()
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        pub = Ed25519PublicKey.from_public_bytes(_unb64(public_key_b64))
        pub.verify(_unb64(signature), message)
        return True
    except Exception:
        return False


def canonical(data: dict) -> str:
    """Deterministic JSON string for signing dicts."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"))
