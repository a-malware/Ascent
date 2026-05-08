"""
chain_listener.py
-----------------
Monitors the local Python PoR-Chain node for reputation and state changes.

Instead of listening to Solana WebSocket logs, this listener polls the
local Python Node's REST API (/node/registry) and yields node state updates.
"""

import asyncio
import logging
import requests
from typing import Callable, Awaitable

log = logging.getLogger(__name__)

NODE_URL = "http://localhost:5000"
POLL_INTERVAL_SEC = 10

EventCallback = Callable[[dict], Awaitable[None]]

async def listen_to_node_state(callback: EventCallback, api_url: str = NODE_URL):
    """
    Periodically poll the Python node's registry and emit state updates.
    """
    last_state = {}

    while True:
        try:
            resp = requests.get(f"{api_url}/node/registry", timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                nodes = data.get("nodes", {})

                for node_id, current_data in nodes.items():
                    # We always yield the current state so the detector can track histories
                    event = {
                        "event": "NodeStateUpdate",
                        "node_id": node_id,
                        "phase": current_data.get("phase"),
                        "honest_rounds": current_data.get("honest_rounds", 0),
                        "reputation_score": current_data.get("reputation_score", 0.0),
                    }
                    
                    # Call the async callback
                    try:
                        await callback(event)
                    except Exception as e:
                        log.error(f"Callback error: {e}")

                last_state = nodes

        except requests.RequestException as e:
            log.warning(f"Failed to connect to node at {api_url}: {e}")
        except Exception as e:
            log.error(f"Unexpected error in listener: {e}")

        await asyncio.sleep(POLL_INTERVAL_SEC)
