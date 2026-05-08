"""
networking.py — P2P broadcast and receive with message deduplication.
Uses httpx async client to broadcast concurrently to all peers.
"""
import asyncio
import time
import uuid
from collections import deque

import httpx

import config
from modules import identity, storage

_PEERS_FILE = "peers.json"
_seen_ids: deque = deque(maxlen=1000)   # in-memory dedup ring buffer

# ── Peer Management ───────────────────────────────────────────────────────────

async def load_peers() -> list[str]:
    stored = await storage.read_or_default(_PEERS_FILE, [])
    combined = list(set(stored + config.PEERS))
    return combined


async def add_peer(url: str) -> None:
    peers = await load_peers()
    if url not in peers:
        peers.append(url)
        await storage.write(_PEERS_FILE, peers)


async def remove_peer(url: str) -> None:
    peers = await load_peers()
    peers = [p for p in peers if p != url]
    await storage.write(_PEERS_FILE, peers)


# ── Message Envelope ──────────────────────────────────────────────────────────

def build_message(msg_type: str, payload: dict) -> dict:
    node = identity.get()
    body = {
        "message_id": str(uuid.uuid4()),
        "type": msg_type,
        "sender_id": node["node_id"],
        "sender_pubkey": node["public_key"],
        "timestamp": time.time(),
        "payload": payload,
    }
    body["signature"] = identity.sign(identity.canonical({
        k: v for k, v in body.items() if k != "signature"
    }))
    return body


def is_duplicate(message_id: str) -> bool:
    if message_id in _seen_ids:
        return True
    _seen_ids.append(message_id)
    return False


def verify_message(msg: dict) -> bool:
    """Verify sender signature on a received message."""
    try:
        payload_to_verify = {k: v for k, v in msg.items() if k != "signature"}
        return identity.verify(
            identity.canonical(payload_to_verify),
            msg["signature"],
            msg["sender_pubkey"],
        )
    except Exception:
        return False


# ── Broadcast ─────────────────────────────────────────────────────────────────

async def broadcast(msg_type: str, payload: dict) -> dict:
    """Build, sign, and broadcast a new message to all peers."""
    message = build_message(msg_type, payload)
    return await forward(message)


async def forward(message: dict) -> dict:
    """Forward an already-built message to all peers (used for gossip rebroadcast)."""
    peers = await load_peers()
    results = {"sent": [], "failed": []}
    async with httpx.AsyncClient(timeout=5.0) as client:
        tasks = [_post_to_peer(client, peer, message) for peer in peers]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        for peer, resp in zip(peers, responses):
            if isinstance(resp, Exception):
                results["failed"].append(peer)
            else:
                results["sent"].append(peer)
    return results


async def _post_to_peer(client: httpx.AsyncClient, peer_url: str, message: dict):
    return await client.post(f"{peer_url}/broadcast", json=message)


# ── Health Check ──────────────────────────────────────────────────────────────

async def check_peers() -> dict:
    peers = await load_peers()
    status = {}
    async with httpx.AsyncClient(timeout=1.0) as client:
        async def _check(peer):
            try:
                r = await client.get(f"{peer}/node_state")
                return peer, "online" if r.status_code == 200 else "error"
            except Exception:
                return peer, "offline"

        results = await asyncio.gather(*[_check(p) for p in peers])
        for peer, stat in results:
            status[peer] = stat
            
    return status


# ── Discovery ─────────────────────────────────────────────────────────────────
async def discover_local_peers(port_range=(5000, 5010)) -> list[str]:
    """
    Search for other nodes running locally and add them as peers.
    This allows 'Magic Join' without manually passing peer URLs.
    """
    my_port = config.NODE_PORT
    found = []
    
    # We use a very short timeout for discovery so we don't block startup
    async with httpx.AsyncClient(timeout=0.2) as client:
        tasks = []
        for port in range(port_range[0], port_range[1] + 1):
            if port == my_port:
                continue
            url = f"http://127.0.0.1:{port}"
            tasks.append(_check_and_join(client, url))
        
        results = await asyncio.gather(*tasks)
        found = [url for url in results if url]
            
    return found


async def _check_and_join(client: httpx.AsyncClient, url: str):
    """Ping a potential peer and add if it responds."""
    try:
        r = await client.get(f"{url}/node_state")
        if r.status_code == 200:
            await add_peer(url)
            return url
    except Exception:
        pass
    return None
