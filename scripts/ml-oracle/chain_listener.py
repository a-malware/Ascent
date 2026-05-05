"""
chain_listener.py
-----------------
Subscribes to Solana program logs via WebSocket and parses ColdStart-PoR
Anchor events into structured Python dicts.

Anchor emits events inside program logs as base64-encoded borsh data prefixed
with "Program data: ".  We decode each log line and match the 8-byte
discriminator to identify the event type, then decode the fields.

Events we care about:
  VoteCast             { node: Pubkey, round: u64 }
  RoundOutcomeRecorded { node: Pubkey, round: u64, was_honest: bool, new_reputation_bps: u64 }
  SlashProposed        { candidate: Pubkey, proposer: Pubkey, vote_count: u8 }
  MisbehaviorReported  { candidate: Pubkey, voucher: Pubkey, slashed_bps: u64 }
"""

import asyncio
import base64
import struct
import hashlib
import logging
from typing import Callable, Awaitable, Optional
import websockets
import json

log = logging.getLogger(__name__)

PROGRAM_ID = "CFK9b4RXvcmJKfxodF5HNshWGfkvoQ2iAaN9eyRJnGfh"
DEVNET_WS  = "wss://api.devnet.solana.com"

# ---------------------------------------------------------------------------
# Anchor discriminator helper
# ---------------------------------------------------------------------------

def _anchor_discriminator(event_name: str) -> bytes:
    """
    Anchor event discriminators are the first 8 bytes of
    SHA256("event:<EventName>").
    """
    digest = hashlib.sha256(f"event:{event_name}".encode()).digest()
    return digest[:8]


DISC_VOTE_CAST              = _anchor_discriminator("VoteCast")
DISC_ROUND_OUTCOME          = _anchor_discriminator("RoundOutcomeRecorded")
DISC_SLASH_PROPOSED         = _anchor_discriminator("SlashProposed")
DISC_MISBEHAVIOR_REPORTED   = _anchor_discriminator("MisbehaviorReported")

# ---------------------------------------------------------------------------
# Borsh / binary decoders
# ---------------------------------------------------------------------------

def _read_pubkey(data: bytes, offset: int) -> tuple[str, int]:
    """Read a 32-byte public key and return base58 string + new offset."""
    import base58
    key_bytes = data[offset:offset + 32]
    return base58.b58encode(key_bytes).decode(), offset + 32


def _read_u64(data: bytes, offset: int) -> tuple[int, int]:
    value = struct.unpack_from("<Q", data, offset)[0]
    return value, offset + 8


def _read_bool(data: bytes, offset: int) -> tuple[bool, int]:
    value = bool(data[offset])
    return value, offset + 1


def _read_u8(data: bytes, offset: int) -> tuple[int, int]:
    return data[offset], offset + 1


def _decode_vote_cast(data: bytes) -> Optional[dict]:
    try:
        offset = 8  # skip discriminator
        node, offset   = _read_pubkey(data, offset)
        round_, offset = _read_u64(data, offset)
        return {"event": "VoteCast", "node": node, "round": round_}
    except Exception as e:
        log.warning(f"Failed to decode VoteCast: {e}")
        return None


def _decode_round_outcome(data: bytes) -> Optional[dict]:
    try:
        offset = 8
        node, offset           = _read_pubkey(data, offset)
        round_, offset         = _read_u64(data, offset)
        was_honest, offset     = _read_bool(data, offset)
        new_rep_bps, offset    = _read_u64(data, offset)
        return {
            "event": "RoundOutcomeRecorded",
            "node": node,
            "round": round_,
            "was_honest": was_honest,
            "new_reputation_bps": new_rep_bps,
        }
    except Exception as e:
        log.warning(f"Failed to decode RoundOutcomeRecorded: {e}")
        return None


def _decode_slash_proposed(data: bytes) -> Optional[dict]:
    try:
        offset = 8
        candidate, offset   = _read_pubkey(data, offset)
        proposer, offset    = _read_pubkey(data, offset)
        vote_count, offset  = _read_u8(data, offset)
        return {
            "event": "SlashProposed",
            "candidate": candidate,
            "proposer": proposer,
            "vote_count": vote_count,
        }
    except Exception as e:
        log.warning(f"Failed to decode SlashProposed: {e}")
        return None


def _decode_misbehavior_reported(data: bytes) -> Optional[dict]:
    try:
        offset = 8
        candidate, offset   = _read_pubkey(data, offset)
        voucher, offset     = _read_pubkey(data, offset)
        slashed_bps, offset = _read_u64(data, offset)
        return {
            "event": "MisbehaviorReported",
            "candidate": candidate,
            "voucher": voucher,
            "slashed_bps": slashed_bps,
        }
    except Exception as e:
        log.warning(f"Failed to decode MisbehaviorReported: {e}")
        return None


_DECODERS = {
    DISC_VOTE_CAST:            _decode_vote_cast,
    DISC_ROUND_OUTCOME:        _decode_round_outcome,
    DISC_SLASH_PROPOSED:       _decode_slash_proposed,
    DISC_MISBEHAVIOR_REPORTED: _decode_misbehavior_reported,
}

# ---------------------------------------------------------------------------
# Log parser
# ---------------------------------------------------------------------------

def parse_program_log(log_line: str) -> Optional[dict]:
    """
    Anchor emits events in log lines like:
        "Program data: <base64-encoded borsh>"
    Attempt to decode and match a known discriminator.
    """
    PREFIX = "Program data: "
    if not log_line.startswith(PREFIX):
        return None

    b64_payload = log_line[len(PREFIX):].strip()
    try:
        data = base64.b64decode(b64_payload)
    except Exception:
        return None

    if len(data) < 8:
        return None

    discriminator = bytes(data[:8])
    decoder = _DECODERS.get(discriminator)
    if decoder is None:
        return None

    return decoder(data)


# ---------------------------------------------------------------------------
# WebSocket listener
# ---------------------------------------------------------------------------

EventCallback = Callable[[dict], Awaitable[None]]


async def listen_to_program_logs(callback: EventCallback, ws_url: str = DEVNET_WS):
    """
    Connect to Solana via WebSocket, subscribe to all logs mentioning the
    ColdStart-PoR program, parse events, and invoke `callback` for each one.

    Reconnects automatically on disconnect.
    """
    subscribe_msg = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "logsSubscribe",
        "params": [
            {"mentions": [PROGRAM_ID]},
            {"commitment": "confirmed"},
        ],
    })

    while True:
        try:
            log.info(f"Connecting to {ws_url}...")
            async with websockets.connect(ws_url, ping_interval=30) as ws:
                await ws.send(subscribe_msg)
                log.info("Subscribed to program logs.")

                async for raw_msg in ws:
                    try:
                        msg = json.loads(raw_msg)
                    except json.JSONDecodeError:
                        continue

                    # Subscription confirmation — ignore
                    if "result" in msg:
                        continue

                    logs = (
                        msg.get("params", {})
                           .get("result", {})
                           .get("value", {})
                           .get("logs", [])
                    )

                    for line in logs:
                        event = parse_program_log(line)
                        if event:
                            log.debug(f"Event parsed: {event}")
                            try:
                                await callback(event)
                            except Exception as e:
                                log.error(f"Callback error: {e}")

        except (websockets.ConnectionClosed, ConnectionResetError, OSError) as e:
            log.warning(f"WebSocket disconnected: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)
        except Exception as e:
            log.error(f"Unexpected error in listener: {e}. Reconnecting in 10s...")
            await asyncio.sleep(10)
