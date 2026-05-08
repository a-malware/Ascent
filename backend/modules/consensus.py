"""
consensus.py — Proof-of-Reputation proposer selection and block finalization.
Proposer = weighted-random selection among FULL_NODE nodes by reputation.
"""
import hashlib
import random
import time

import config
from modules import reputation, registry, blockchain, networking


# ── Proposer Selection ────────────────────────────────────────────────────────

async def select_proposer(seed: str | None = None) -> str | None:
    """
    Weighted-random proposer selection.
    W(node_i) = R(node_i) / sum(R(all_full_nodes))
    Deterministic if seed is provided (e.g. previous block hash).
    """
    full_nodes = await registry.full_nodes()
    if not full_nodes:
        return None

    scores = {}
    for node in full_nodes:
        scores[node["node_id"]] = await reputation.get_score(node["node_id"])

    total = sum(scores.values())
    if total == 0:
        return random.choice(list(scores.keys()))

    from modules import audit
    details = "Full Validator Reputations:\n"
    for n_id, s in scores.items():
        details += f"Node {n_id[:8]}... → {s:.3f}\n"
    details += f"\nTotal Reputation = {total:.3f}\n"
    
    # Deterministic weighted random using seed
    rng_seed = int(hashlib.sha256((seed or str(time.time())).encode()).hexdigest(), 16)
    rng = random.Random(rng_seed)
    r = rng.uniform(0, total)
    cumulative = 0.0
    selected = None
    for node_id, score in scores.items():
        if selected is None:
            cumulative += score
            if r <= cumulative:
                selected = node_id
        
        prob = (score / total) * 100
        details += f"Node {node_id[:8]} Proposal Probability = {prob:.1f}%\n"
        
    audit.log_event("PROPOSER", f"Selected Proposer: {selected[:8]}...", details)
    return selected or list(scores.keys())[-1]


# ── Block Proposal Flow ───────────────────────────────────────────────────────

_pending_events: list = []
_acceptance_votes: dict[str, set] = {}   # block_hash → set of accepting node_ids
_proposed_blocks: dict[str, dict] = {}   # block_hash → full block (for non-voters)


def add_pending_event(event: dict) -> None:
    tx_id = event.get("tx_id")
    if tx_id:
        if any(e.get("tx_id") == tx_id for e in _pending_events):
            return
    _pending_events.append(event)


async def run_consensus_round(force: bool = False) -> dict | None:
    """
    Called periodically by the scheduler, or forced by emergency events.
    If this node is the selected proposer, create and broadcast a block.
    """
    from modules import identity as ident
    my_id = ident.get()["node_id"]
    my_phase = await registry.get_phase(my_id)
    if my_phase != "FULL_NODE":
        return None   # Only full nodes participate in proposal

    prev = await blockchain.last_block()
    proposer = await select_proposer(seed=prev["hash"])
    
    # If forced (Emergency), we propose anyway to finalize penalties
    if proposer != my_id and not force:
        return None   # Not our turn

    events = list(_pending_events)
    # We do NOT clear pending events yet. We wait until the block is finalized.

    block = await blockchain.propose_block(events)
    await networking.broadcast("BLOCK_PROPOSAL", {"block": block})
    
    # Proposer also votes for its own block
    await receive_block_vote(block.get("hash"), my_id, block)
    return block


async def receive_block_proposal(block: dict, proposer_id: str) -> bool:
    """
    Called when a peer broadcasts a BLOCK_PROPOSAL.
    - PHASE_3 and FULL_NODE nodes validate and cast a vote.
    - All other phases validate and cache the block so they can apply it
      once it is finalized (via BLOCK_FINALIZED message).
    """
    from modules import identity as ident
    my_id = ident.get()["node_id"]
    my_phase = await registry.get_phase(my_id)

    valid = await blockchain.validate_block(block)
    if not valid:
        return False

    # Cache the block so we can apply it when finalized
    _proposed_blocks[block.get("hash")] = block

    if my_phase in ("PHASE_3", "UNDER_OBSERVATION", "FULL_NODE"):
        # Update OUR OWN reputation immediately when we cast a vote
        await reputation.update(my_id, honest=True)
        
        # Broadcast our vote to everyone
        await networking.broadcast("BLOCK_VOTE", {
            "block_hash": block.get("hash"),
            "voter_id": my_id,
            "block": block
        })
        # Record our own vote locally
        await receive_block_vote(block.get("hash"), my_id, block)

        # If we are in a probationary phase, record this as an honest round
        if my_phase in ("PHASE_3", "UNDER_OBSERVATION"):
            from modules import coldstart
            result = await coldstart.record_honest_round(my_id)
            if result.get("phase") == "FULL_NODE":
                # Broadcast our own graduation
                await networking.broadcast("PHASE_UPDATE", {
                    "node_id": my_id,
                    "phase": "FULL_NODE",
                })

    return True


async def receive_block_vote(block_hash: str, voter_id: str, block: dict | None = None) -> bool:
    """
    Called when a peer broadcasts a BLOCK_VOTE.
    Once we hit 2/3 threshold, append the block.
    """
    if not block_hash:
        return False

    if block_hash not in _acceptance_votes:
        _acceptance_votes[block_hash] = set()
    
    _acceptance_votes[block_hash].add(voter_id)

    # Check if we have 2/3 acceptance
    full_nodes = await registry.full_nodes()
    full_node_count = len(full_nodes)
    
    # 2/3 threshold (minimum 1)
    required = max(1, int(full_node_count * config.CONSENSUS_THRESHOLD))
    
    if len(_acceptance_votes[block_hash]) >= required:
        # Prefer the cached block from a proposal, fallback to the block in the vote
        final_block = _proposed_blocks.get(block_hash) or block
        if not final_block:
            return False

        # Ensure we haven't already finalized this block (prevents log spam and duplicate appends)
        last_b = await blockchain.last_block()
        if last_b and final_block.get("index", 0) <= last_b.get("index", 0):
            return True

        from modules import audit
        details = f"Block #{final_block.get('index')} Proposed by Node {final_block.get('proposer', '')[:8]}...\n\nValidator Votes:\n"
        for v_id in _acceptance_votes[block_hash]:
            details += f"Node {v_id[:8]}... → APPROVE\n"
        details += f"\nConsensus:\n{required}/{full_node_count} Threshold Reached\nBLOCK FINALIZED"
        audit.log_event("CONSENSUS", f"Block #{final_block.get('index')} Finalized", details)

        success = await blockchain.append_block(final_block)
        if success:
            voters = set(_acceptance_votes[block_hash])
            del _acceptance_votes[block_hash]
            _proposed_blocks.pop(block_hash, None)

            # Finalized! Remove accepted events from our pending pool
            block_tx_ids = {e.get("tx_id") for e in final_block.get("events", []) if e.get("tx_id")}
            global _pending_events
            _pending_events = [e for e in _pending_events if e.get("tx_id") not in block_tx_ids]

            # Broadcast BLOCK_FINALIZED so Phase 1/2 nodes can also apply it
            await networking.broadcast("BLOCK_FINALIZED", {"block": final_block})

            # Credit honest participation in background — never block finalization
            # Note: each node already updated its OWN reputation in receive_block_proposal.
            # Here we only need to handle Phase 3 graduation for OTHER nodes.
            import asyncio
            from modules import coldstart
            from modules import identity as ident
            my_id = ident.get()["node_id"]
            
            async def _credit_voters(voters_snap, block_snap, my_id_snap):
                for voter_node_id in voters_snap:
                    if voter_node_id == my_id_snap:
                        continue  # We already updated our own rep in receive_block_proposal
                    voter_phase = await registry.get_phase(voter_node_id)
                    if voter_phase in ("PHASE_3", "UNDER_OBSERVATION"):
                        # Track their honest rounds in our local registry
                        await registry.increment_honest_rounds(voter_node_id)

            asyncio.create_task(_credit_voters(voters, final_block, my_id))

            return True
    return False


# ── Synchronization ─────────────────────────────────────────────────────────────

async def sync_chain_from_peers() -> None:
    """
    Called on startup. Queries peers for their chain.
    If a peer has a longer valid chain, replaces the local chain.
    """
    peers = await networking.load_peers()
    if not peers:
        return

    import httpx
    import logging
    log = logging.getLogger("por-chain")
    
    longest_chain = await blockchain.get_chain()
    max_length = len(longest_chain)
    updated = False

    async with httpx.AsyncClient(timeout=3.0) as client:
        for peer in peers:
            try:
                r = await client.get(f"{peer}/chain")
                if r.status_code == 200:
                    resp = r.json()
                    peer_chain = resp.get("chain", [])
                    if len(peer_chain) > max_length:
                        # Validate the peer's chain
                        if await blockchain.is_valid_chain(peer_chain):
                            max_length = len(peer_chain)
                            longest_chain = peer_chain
                            updated = True
            except Exception:
                pass  # Peer offline or error

    if updated:
        from modules import storage
        await storage.write(blockchain._CHAIN_FILE, longest_chain)
        log.info(f"🔄 Synced chain from peers! New height: {max_length}")
