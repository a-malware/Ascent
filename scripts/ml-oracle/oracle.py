"""
oracle.py
---------
Main entry-point for the ColdStart-PoR ML Misbehavior Oracle.

Wires together:
  chain_listener  → polls Python Node for registry state
  detector        → maintains per-node history and runs Isolation Forest
  penalize_node   → submits POST /coldstart/penalize when anomaly detected

Usage:
    python oracle.py                      # runs live (auto-submits slashes via local node)
    python oracle.py --dry-run            # anomaly detection only, no slashes
"""

import asyncio
import argparse
import logging
import sys
import time
import requests
from typing import Optional

from chain_listener import listen_to_node_state
from detector import VotingAnomalyDetector

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("oracle")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

NODE_URL = "http://localhost:5000"

# How often to run the model re-fit + full network scan (seconds)
SCAN_INTERVAL_SEC = 20

# After flagging a node as anomalous, don't re-propose for this many seconds
COOLDOWN_SEC = 300

# ---------------------------------------------------------------------------
# Oracle class
# ---------------------------------------------------------------------------

class MisbehaviorOracle:
    def __init__(
        self,
        node_url: str = NODE_URL,
        dry_run: bool = False,
    ):
        self.node_url = node_url
        self.dry_run   = dry_run
        self.detector  = VotingAnomalyDetector()

        # Tracks when we last penalized each node (anti-spam)
        self._last_slash_proposed: dict[str, float] = {}

    # ── Event handler ──────────────────────────────────────────────────────

    async def on_event(self, event: dict):
        """Dispatched for every polled NodeStateUpdate."""
        kind = event.get("event")

        if kind == "NodeStateUpdate":
            self.detector.record_state_update(
                node_id=event["node_id"],
                phase=event["phase"],
                honest_rounds=event["honest_rounds"],
                score=event["reputation_score"],
            )

    # ── Anomaly check + Action ─────────────────────────────────────────────

    async def _check_node(self, node_id: str):
        """
        Check if a node is anomalous and, if so, trigger a slash.
        """
        if not self.detector.is_anomalous(node_id):
            return

        # Respect cooldown to avoid spamming
        last = self._last_slash_proposed.get(node_id, 0)
        if time.time() - last < COOLDOWN_SEC:
            log.info(f"Anomaly cooldown active for {node_id[:16]}... — skipping")
            return

        score = self.detector.anomaly_score(node_id)
        log.warning(
            f"⚠  ANOMALY: {node_id[:16]}... score={score:.4f} — "
            f"{'[DRY RUN] would trigger penalize' if self.dry_run else 'triggering penalize...'}"
        )

        if self.dry_run:
            return

        await self._submit_penalize(node_id)

    async def _submit_penalize(self, node_id: str):
        """
        Submit the penalize request to the local FULL_NODE.
        The node itself will sign and broadcast the transaction.
        """
        try:
            url = f"{self.node_url}/coldstart/penalize"
            payload = {"node_id": node_id}
            
            # Using synchronous requests since we don't have aiohttp installed, 
            # and this is a low-frequency administrative action.
            # We run it in a thread to not block the asyncio loop.
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: requests.post(url, json=payload, timeout=5))
            
            if resp.status_code == 200:
                self._last_slash_proposed[node_id] = time.time()
                log.warning(
                    f"✓ Penalize successful for {node_id[:16]}... "
                )
            else:
                log.error(f"Failed to penalize: {resp.status_code} - {resp.text}")

        except Exception as e:
            log.error(f"Failed to submit penalize request: {e}")

    # ── Periodic scan ──────────────────────────────────────────────────────

    async def _periodic_scan(self):
        """
        Every SCAN_INTERVAL_SEC seconds:
        - Re-fit the model on all available data
        - Scan every tracked node for anomalies
        """
        while True:
            await asyncio.sleep(SCAN_INTERVAL_SEC)

            self.detector.maybe_refit(force=True)
            summary = self.detector.summary()
            log.info(
                f"Periodic scan — tracked={summary['total_nodes_tracked']} "
                f"with_history={summary['nodes_with_history']} "
                f"model_ready={summary['model_trained']}"
            )

            # Scan all nodes with enough history
            for node in list(self.detector._histories.keys()):
                await self._check_node(node)

    # ── Main run loop ──────────────────────────────────────────────────────

    async def run(self):
        log.info(
            f"Oracle starting "
            f"{'[DRY RUN — no penalizing]' if self.dry_run else '[LIVE MODE]'}"
        )

        # Run both coroutines concurrently: listener + periodic scan
        await asyncio.gather(
            listen_to_node_state(self.on_event, self.node_url),
            self._periodic_scan(),
        )

# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="ColdStart-PoR ML Misbehavior Oracle (Sidecar)"
    )
    parser.add_argument(
        "--node",
        type=str,
        default=NODE_URL,
        help=f"URL of the local Python PoR-Chain node (default: {NODE_URL})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run anomaly detection only — do not trigger any penalties",
    )
    args = parser.parse_args()

    oracle = MisbehaviorOracle(node_url=args.node, dry_run=args.dry_run)

    try:
        asyncio.run(oracle.run())
    except KeyboardInterrupt:
        log.info("Oracle stopped.")


if __name__ == "__main__":
    main()
