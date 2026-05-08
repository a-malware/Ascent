"""routes_simulate.py — Malicious block simulation endpoint for PoR demos."""
import hashlib
import json
import time
from fastapi import APIRouter, HTTPException
from modules import identity, registry, reputation, blockchain, coldstart, networking, storage

router = APIRouter()


@router.post("/simulate/malicious-block")
async def simulate_malicious_block(body: dict = {}):
    """
    Simulate a malicious block proposal from a chosen (or auto-picked) node.

    1.  Pick attacker — by default finds the first PHASE_3 node, else FULL_NODE.
    2.  Build an invalid block: correct index but WRONG previous_hash.
    3.  Run it through validate_block() — detection step.
    4.  Penalize the attacker: BANNED + reputation → 0 + voucher penalised.
    5.  Return a structured simulation report for the UI.
    """
    attacker_id = body.get("node_id")

    # ── 1. Find or validate attacker ─────────────────────────────────────────
    all_nodes = await registry.all_nodes()

    if attacker_id:
        if attacker_id not in all_nodes:
            raise HTTPException(status_code=404, detail="Node not found")
        if all_nodes[attacker_id]["phase"] == "BANNED":
            raise HTTPException(status_code=400, detail="Node is already BANNED")
    else:
        # Auto-pick: prefer self if it's a FULL_NODE (user's intent), 
        # else prefer PHASE_3 (probationary), fallback to others
        my_id = identity.get()["node_id"]
        my_info = all_nodes.get(my_id)
        
        if my_info and my_info["phase"] == "FULL_NODE":
            attacker_id = my_id
        else:
            for phase in ("PHASE_3", "FULL_NODE", "PHASE_2", "PHASE_1"):
                for nid, info in all_nodes.items():
                    if info["phase"] == phase: # allowed to be self now
                        attacker_id = nid
                        break
                if attacker_id:
                    break

    if not attacker_id:
        raise HTTPException(status_code=400, detail="No eligible node to simulate attack")

    attacker_info = all_nodes[attacker_id]
    attacker_phase_before = attacker_info["phase"]
    rep_before = await reputation.get_score(attacker_id)

    # ── 2. Build a malicious block (wrong previous_hash) ─────────────────────
    last_block = await blockchain.last_block()
    correct_prev_hash = last_block["hash"]

    # Tamper: flip the last 8 chars of the previous hash
    tampered_prev = correct_prev_hash[:-8] + "DEADBEEF"

    malicious_block = {
        "index":         last_block["index"] + 1,
        "previous_hash": tampered_prev,             # ← intentionally wrong
        "timestamp":     time.time(),
        "events":        [],
        "proposer":      attacker_id,
        "merkle_root":   hashlib.sha256(b"").hexdigest(),
    }
    # Give it a (self-consistent) hash
    raw = json.dumps(malicious_block, sort_keys=True)
    malicious_block["hash"] = hashlib.sha256(raw.encode()).hexdigest()
    malicious_block["signature"] = "SIMULATED_MALICIOUS_SIGNATURE"

    # ── 3. Detection: validate_block should return False ─────────────────────
    detected = not await blockchain.validate_block(malicious_block)  # True = caught
    rejection_reason = "Previous hash mismatch — chain continuity violated"

    # ── 4. Penalize attacker ─────────────────────────────────────────────────
    voucher_penalties = []

    # Get vouchers before banning
    vouches_file = await storage.read_or_default("vouches.json", {})
    vouch_list = vouches_file.get(attacker_id, [])
    if isinstance(vouch_list, dict):
        vouch_list = [vouch_list]  # legacy single-record compat

    voucher_ids = [v.get("voucher_id") for v in vouch_list if v.get("voucher_id")]

    # Record rep before for vouchers
    voucher_reps_before = {}
    for vid in voucher_ids:
        voucher_reps_before[vid] = await reputation.get_score(vid)

    # Ban and slash the attacker
    penalize_result = await coldstart.penalize_malicious(attacker_id)

    # Apply voucher reputation penalty (10% penalty per config)
    for vid in voucher_ids:
        rep_was = voucher_reps_before.get(vid, 0)
        await reputation.update(vid, honest=False)
        rep_now = await reputation.get_score(vid)
        voucher_penalties.append({
            "voucher_id":  vid,
            "rep_before":  round(rep_was, 4),
            "rep_after":   round(rep_now, 4),
            "penalty":     round(rep_was - rep_now, 4),
        })

    rep_after = await reputation.get_score(attacker_id)

    # Broadcast the ban so all peers update their local registry
    await networking.broadcast("PHASE_UPDATE", {
        "node_id": attacker_id,
        "phase":   "BANNED",
    })

    # ── 5. Build simulation report ────────────────────────────────────────────
    return {
        "simulation": True,
        "attacker": {
            "node_id":      attacker_id,
            "phase_before": attacker_phase_before,
            "phase_after":  "BANNED",
            "rep_before":   round(rep_before, 4),
            "rep_after":    round(rep_after, 4),
        },
        "malicious_block": {
            "index":              malicious_block["index"],
            "claimed_prev_hash":  tampered_prev,
            "correct_prev_hash":  correct_prev_hash,
            "block_hash":         malicious_block["hash"],
        },
        "detection": {
            "detected":          detected,
            "validation_passed": not detected,
            "rejection_reason":  rejection_reason if detected else "Block unexpectedly passed validation",
        },
        "consensus": {
            "result": "REJECTED" if detected else "UNEXPECTED_PASS",
            "votes_for": 0,
            "votes_against": len(await registry.full_nodes()),
        },
        "voucher_penalties": voucher_penalties,
        "slash_txs": penalize_result.get("slash_txs", []),
    }
