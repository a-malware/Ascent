"""
routes_broadcast.py — Receive and route incoming P2P broadcast messages.
All messages are signature-verified before processing.
"""
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
import config
from modules import networking, registry, identity, reputation, blockchain, consensus, wallet, coldstart

router = APIRouter()


@router.post("/broadcast")
async def receive_broadcast(request: Request, msg: dict, bg_tasks: BackgroundTasks):
    msg_id = msg.get("message_id", "")
    msg_type = msg.get("type", "")

    # 1. Deduplication
    if networking.is_duplicate(msg_id):
        return {"status": "duplicate"}

    # 2. Signature verification (reject all invalid messages)
    if not networking.verify_message(msg):
        raise HTTPException(status_code=400, detail="Invalid message signature")

    sender_id = msg.get("sender_id")
    payload = msg.get("payload", {})

    # 3. Route by message type
    if msg_type == "NODE_JOIN":
        await _handle_node_join(request, sender_id, msg.get("sender_pubkey"), payload)

    elif msg_type == "BLOCK_PROPOSAL":
        block = payload.get("block")
        if block:
            await consensus.receive_block_proposal(block, sender_id)

    elif msg_type == "BLOCK_VOTE":
        hash_ = payload.get("block_hash")
        voter = payload.get("voter_id")
        block = payload.get("block")
        await consensus.receive_block_vote(hash_, voter, block)

    elif msg_type == "BLOCK_FINALIZED":
        # A block has already reached 2/3 consensus on the network.
        # Apply it if we don't have it yet (catches up Phase 1/2 nodes).
        block = payload.get("block")
        if block:
            from modules import identity as ident
            my_id = ident.get()["node_id"]
            my_phase = await registry.get_phase(my_id)
            if my_phase not in ("PHASE_3", "FULL_NODE"):
                # Non-voting node: apply the block directly if it's valid and next
                await blockchain.append_block(block)

    elif msg_type in ("TX", "transaction"):
        tx = payload if msg_type == "transaction" else payload.get("tx")
        if tx:
            # ── Security Gating: No BANNED nodes ──────────────────────────────
            sender_id = tx.get("from")
            if await registry.get_phase(sender_id) == "BANNED":
                return {"status": "rejected", "reason": "BANNED_SENDER"}

            # 1. Verify the Transaction Signature before adding to mempool
            if await wallet.receive(tx):
                consensus.add_pending_event(tx)
            else:
                raise HTTPException(status_code=400, detail="Invalid Transaction Signature")

    elif msg_type == "REPUTATION_UPDATE":
        # Peer shares an eligibility event (not raw score)
        node_id = payload.get("node_id")
        honest = payload.get("honest", True)
        if node_id:
            await reputation.update(node_id, honest)

    elif msg_type == "VOUCH":
        # Vouch record from a peer
        vouch_record = payload.get("vouch_record")
        if vouch_record:
            await coldstart.receive_vouch(vouch_record)

    elif msg_type == "PHASE_UPDATE":
        # A peer reports that a node has changed phase (graduation or ban).
        # Update our local registry to stay consistent.
        node_id = payload.get("node_id")
        phase = payload.get("phase")
        valid_phases = {"PHASE_1", "PHASE_2", "PHASE_3", "FULL_NODE", "BANNED"}
        if node_id and phase in valid_phases:
            await registry.set_phase(node_id, phase)

    # Re-broadcast to our other peers (gossip protocol)
    # We do this in the background to prevent P2P network deadlocks
    bg_tasks.add_task(networking.forward, msg)

    return {"status": "ok", "type": msg_type}


async def _handle_node_join(request: Request, node_id: str, pubkey: str, payload: dict):
    """Register a new node and assign Phase 1 tasks if unknown."""
    if not node_id or not pubkey:
        return
        
    # Automatically add this node to our peers list so we can communicate back
    port = payload.get("port")
    # Make sure we don't accidentally add ourselves if the message echoes back
    if port and int(port) != config.NODE_PORT:
        client_host = request.client.host if request.client else "127.0.0.1"
        if client_host in ("::1", "127.0.0.1", "localhost"):
            client_host = "127.0.0.1"
        peer_url = f"http://{client_host}:{port}"
        await networking.add_peer(peer_url)

    existing = await registry.get_node(node_id)
    if not existing:
        await registry.register(node_id, pubkey, phase="PHASE_1")
        await reputation.set_initial(node_id)
        await coldstart.assign_tasks(node_id)
