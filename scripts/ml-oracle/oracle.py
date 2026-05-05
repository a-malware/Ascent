"""
oracle.py
---------
Main entry-point for the ColdStart-PoR ML Misbehavior Oracle.

Wires together:
  chain_listener  → receives live Anchor events from Solana devnet
  detector        → maintains per-node voting history and runs Isolation Forest
  propose_slash   → submits on-chain propose_slash transactions when anomaly detected

Usage:
    python oracle.py                      # runs with oracle wallet (auto-submits slashes)
    python oracle.py --dry-run            # anomaly detection only, no on-chain writes
    python oracle.py --keypair path/to/key.json

The oracle wallet must be a Full-phase node in the ColdStart-PoR network to
be allowed to call propose_slash.
"""

import asyncio
import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Dependency check — give a helpful error before importing heavy deps
# ---------------------------------------------------------------------------

MISSING = []
try:
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solana.rpc.async_api import AsyncClient
    from solana.rpc.commitment import Confirmed
    from solana.transaction import Transaction
    import anchorpy
except ImportError as e:
    MISSING.append(str(e))

if MISSING:
    print("ERROR: Missing dependencies. Run:\n  pip install -r requirements.txt\n")
    for m in MISSING:
        print(f"  {m}")
    sys.exit(1)

from anchorpy import Program, Provider, Wallet, Idl
from anchorpy.idl import Idl as AnchorIdl
from solders.system_program import ID as SYS_PROGRAM_ID

from chain_listener import listen_to_program_logs
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

PROGRAM_ID_STR    = "CFK9b4RXvcmJKfxodF5HNshWGfkvoQ2iAaN9eyRJnGfh"
DEVNET_RPC        = "https://api.devnet.solana.com"
IDL_PATH          = Path(__file__).parent.parent.parent / "apps" / "web" / "src" / "chain" / "idl" / "coldstart_por.json"
DEFAULT_KEYPAIR   = Path.home() / ".config" / "solana" / "id.json"

# How often to run the model re-fit + full network scan (seconds)
SCAN_INTERVAL_SEC = 30

# After flagging a node as anomalous, don't re-propose for this many seconds
COOLDOWN_SEC      = 300

# ---------------------------------------------------------------------------
# PDA helpers  (mirrors program.ts)
# ---------------------------------------------------------------------------

def config_pda() -> Pubkey:
    program_id = Pubkey.from_string(PROGRAM_ID_STR)
    pda, _ = Pubkey.find_program_address([b"config"], program_id)
    return pda

def node_pda(owner: Pubkey) -> Pubkey:
    program_id = Pubkey.from_string(PROGRAM_ID_STR)
    pda, _ = Pubkey.find_program_address([b"node", bytes(owner)], program_id)
    return pda

def slash_vote_pda(candidate: Pubkey) -> Pubkey:
    program_id = Pubkey.from_string(PROGRAM_ID_STR)
    pda, _ = Pubkey.find_program_address([b"slash_vote", bytes(candidate)], program_id)
    return pda

# ---------------------------------------------------------------------------
# Oracle class
# ---------------------------------------------------------------------------

class MisbehaviorOracle:
    def __init__(
        self,
        keypair: Keypair,
        dry_run: bool = False,
    ):
        self.keypair   = keypair
        self.dry_run   = dry_run
        self.detector  = VotingAnomalyDetector()
        self._client: Optional[AsyncClient] = None
        self._program: Optional[Program]    = None

        # Tracks when we last proposed a slash for each node (anti-spam)
        self._last_slash_proposed: dict[str, float] = {}

    # ── Anchor program setup ───────────────────────────────────────────────

    async def _setup_program(self):
        """Load the Anchor IDL and create the Program client."""
        if not IDL_PATH.exists():
            log.error(f"IDL not found at {IDL_PATH}. Run 'anchor build' first.")
            sys.exit(1)

        with open(IDL_PATH) as f:
            idl_json = json.load(f)

        self._client  = AsyncClient(DEVNET_RPC, commitment=Confirmed)
        wallet        = Wallet(self.keypair)
        provider      = Provider(self._client, wallet)
        idl           = AnchorIdl.from_json(json.dumps(idl_json))
        program_id    = Pubkey.from_string(PROGRAM_ID_STR)
        self._program = Program(idl, program_id, provider)
        log.info(f"Oracle wallet: {self.keypair.pubkey()}")

    # ── Event handler ──────────────────────────────────────────────────────

    async def on_event(self, event: dict):
        """Dispatched for every parsed Anchor event from chain_listener."""
        kind = event.get("event")

        if kind == "VoteCast":
            self.detector.record_vote(event["node"], event["round"])
            log.debug(f"VoteCast: {event['node'][:16]}... round={event['round']}")

        elif kind == "RoundOutcomeRecorded":
            self.detector.record_outcome(
                node=event["node"],
                round_=event["round"],
                was_honest=event["was_honest"],
                reputation_bps=event["new_reputation_bps"],
            )
            log.info(
                f"Outcome: {event['node'][:16]}... round={event['round']} "
                f"honest={event['was_honest']} rep={event['new_reputation_bps']} bps"
            )

            # Re-fit + check the node immediately after its outcome is recorded
            self.detector.maybe_refit()
            await self._check_node(event["node"])

        elif kind == "SlashProposed":
            self.detector.record_slash_proposal(event["candidate"])
            log.info(
                f"SlashProposed: {event['candidate'][:16]}... "
                f"by {event['proposer'][:16]}... votes={event['vote_count']}"
            )

        elif kind == "MisbehaviorReported":
            log.warning(
                f"Node SLASHED: {event['candidate'][:16]}... "
                f"slashed={event['slashed_bps']} bps"
            )

    # ── Anomaly check + on-chain action ───────────────────────────────────

    async def _check_node(self, node_pubkey_str: str):
        """
        Check if a node is anomalous and, if so, propose a slash on-chain.
        """
        if not self.detector.is_anomalous(node_pubkey_str):
            return

        # Respect cooldown to avoid spamming slash proposals
        last = self._last_slash_proposed.get(node_pubkey_str, 0)
        if time.time() - last < COOLDOWN_SEC:
            log.info(f"Anomaly cooldown active for {node_pubkey_str[:16]}... — skipping")
            return

        score = self.detector.anomaly_score(node_pubkey_str)
        log.warning(
            f"⚠  ANOMALY: {node_pubkey_str[:16]}... score={score:.4f} — "
            f"{'[DRY RUN] would propose slash' if self.dry_run else 'proposing slash...'}"
        )

        if self.dry_run:
            return

        await self._submit_propose_slash(node_pubkey_str)

    async def _submit_propose_slash(self, candidate_pubkey_str: str):
        """
        Submit the propose_slash instruction as the oracle wallet (which must
        be a Full-phase node in the network).
        """
        if self._program is None:
            log.error("Program not initialised — cannot submit slash")
            return

        try:
            candidate = Pubkey.from_string(candidate_pubkey_str)
            proposer  = self.keypair.pubkey()

            # Derive PDAs
            proposer_state_pda  = node_pda(proposer)
            candidate_state_pda = node_pda(candidate)
            slash_vote_pda_addr = slash_vote_pda(candidate)
            config_pda_addr     = config_pda()

            tx_sig = await self._program.rpc["propose_slash"](
                ctx=anchorpy.Context(
                    accounts={
                        "proposer":         proposer,
                        "proposer_state":   proposer_state_pda,
                        "config":           config_pda_addr,
                        "candidate_state":  candidate_state_pda,
                        "slash_vote":       slash_vote_pda_addr,
                        "system_program":   SYS_PROGRAM_ID,
                    }
                )
            )

            self._last_slash_proposed[candidate_pubkey_str] = time.time()
            log.warning(
                f"✓ propose_slash submitted for {candidate_pubkey_str[:16]}... "
                f"tx={str(tx_sig)[:16]}..."
            )

        except Exception as e:
            log.error(f"Failed to submit propose_slash: {e}")

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
        await self._setup_program()

        log.info(
            f"Oracle starting "
            f"{'[DRY RUN — no on-chain writes]' if self.dry_run else '[LIVE MODE]'}"
        )

        # Run both coroutines concurrently: listener + periodic scan
        await asyncio.gather(
            listen_to_program_logs(self.on_event),
            self._periodic_scan(),
        )

# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

def _load_keypair(path: Path) -> Keypair:
    with open(path) as f:
        secret = json.load(f)
    return Keypair.from_bytes(bytes(secret))


def main():
    parser = argparse.ArgumentParser(
        description="ColdStart-PoR ML Misbehavior Oracle"
    )
    parser.add_argument(
        "--keypair",
        type=Path,
        default=DEFAULT_KEYPAIR,
        help=f"Path to oracle wallet keypair JSON (default: {DEFAULT_KEYPAIR})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run anomaly detection only — do not submit any on-chain transactions",
    )
    args = parser.parse_args()

    if not args.keypair.exists():
        print(f"ERROR: Keypair not found at {args.keypair}")
        print("Run: solana-keygen new --outfile ~/.config/solana/id.json")
        sys.exit(1)

    keypair = _load_keypair(args.keypair)
    oracle  = MisbehaviorOracle(keypair=keypair, dry_run=args.dry_run)

    try:
        asyncio.run(oracle.run())
    except KeyboardInterrupt:
        log.info("Oracle stopped.")


if __name__ == "__main__":
    main()
