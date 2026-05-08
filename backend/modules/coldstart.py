"""
coldstart.py — 3-Phase ColdStart onboarding state machine.

Phase 1: Probation  — complete N tasks, score P = valid/total >= threshold
Phase 2: Vouching   — high-rep node stakes tokens to vouch
Phase 3: Graduated  — can vote, cannot propose; after M honest rounds → FULL_NODE
"""
import hashlib
import secrets
import time

import config
from modules import storage, identity, reputation, registry, wallet

_TASKS_FILE = "tasks.json"
_VOUCHES_FILE = "vouches.json"


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Probation Tasks
# ═══════════════════════════════════════════════════════════════════════════════

TASK_TYPES = ["HASH_PREIMAGE", "SIGN_CHALLENGE", "VERIFY_HASH"]


def _generate_task(task_type: str) -> dict:
    challenge = secrets.token_hex(16)
    expected = None
    if task_type == "HASH_PREIMAGE":
        expected = hashlib.sha256(challenge.encode()).hexdigest()
    elif task_type == "SIGN_CHALLENGE":
        expected = challenge   # node must sign it (verified by signature check)
    elif task_type == "VERIFY_HASH":
        expected = hashlib.sha256(challenge.encode()).hexdigest()
    return {
        "task_id": secrets.token_hex(8),
        "type": task_type,
        "challenge": challenge,
        "expected": expected,
        "created_at": time.time(),
    }


async def assign_tasks(node_id: str) -> list:
    """Assign Phase 1 tasks to a newly joining node."""
    tasks_store = await storage.read_or_default(_TASKS_FILE, {})
    if node_id in tasks_store:
        return tasks_store[node_id]["tasks"]   # idempotent

    tasks = [_generate_task(TASK_TYPES[i % len(TASK_TYPES)])
             for i in range(config.PHASE1_TASK_COUNT)]
    tasks_store[node_id] = {"tasks": tasks, "results": {}}
    await storage.write(_TASKS_FILE, tasks_store)
    # Remove 'expected' before sending to the node (don't reveal answers)
    return [{k: v for k, v in t.items() if k != "expected"} for t in tasks]


def _verify_task_result(task: dict, submission: dict, node_id: str) -> bool:
    """Verify one task submission. Returns True if correct."""
    t = task["type"]
    if t == "HASH_PREIMAGE":
        answer = submission.get("answer") or ""
        expected = task["expected"]
        # The user's answer should be the SHA256 hash of the challenge string.
        # We just check if they provided the correct expected hash.
        passed = (answer.strip() == expected)
        
        from modules import audit
        audit.log_event(
            category="CRYPTO",
            title="Phase 1: SHA256 Verification",
            details=f"Challenge String:\n\"{task['challenge']}\"\n\nExpected SHA256:\n{expected}\n\nSubmitted Hash:\n{answer}\n\nVerification Result:\n{'PASS' if passed else 'FAIL'}"
        )
        return passed
    elif t == "VERIFY_HASH":
        answer = submission.get("answer") or ""
        expected = task["expected"]
        passed = (answer.strip() == expected)
        
        from modules import audit
        audit.log_event(
            category="CRYPTO",
            title="Phase 1: Hash Verification",
            details=f"Challenge String:\n\"{task['challenge']}\"\n\nExpected SHA256:\n{expected}\n\nSubmitted Hash:\n{answer}\n\nVerification Result:\n{'PASS' if passed else 'FAIL'}"
        )
        return passed
    elif t == "SIGN_CHALLENGE":
        sig = submission.get("signature", "")
        pubkey = submission.get("public_key", "")
        
        # Check if they did AUTO_SIGN logic
        if sig == "AUTO_SIGN" and pubkey == "AUTO_SIGN":
            if node_id == identity.get()["node_id"]:
                from modules import audit
                audit.log_event(
                    category="CRYPTO",
                    title="Phase 1: Signature Verification",
                    details=f"Message:\n{task['challenge']}\n\nVerification:\nVALID SIGNATURE (Auto-Signed by Node Core)"
                )
                return True
            return False
            
        is_valid = False
        try:
            is_valid = identity.verify(task["challenge"], sig, pubkey)
        except Exception:
            pass
            
        from modules import audit
        audit.log_event(
            category="CRYPTO",
            title="Phase 1: Signature Verification",
            details=f"Message:\n{task['challenge']}\n\nSignature:\n{sig[:16]}...\n\nPublic Key:\n{pubkey[:16]}...\n\nVerification:\n{'VALID SIGNATURE' if is_valid else 'INVALID SIGNATURE'}"
        )
        return is_valid


async def submit_task_results(node_id: str, submissions: list[dict]) -> dict:
    """
    Evaluate submitted task results.
    Returns: {score, passed, phase}
    """
    if await registry.get_phase(node_id) == "BANNED":
        return {"error": "BANNED nodes cannot submit tasks"}

    tasks_store = await storage.read_or_default(_TASKS_FILE, {})
    if node_id not in tasks_store:
        return {"error": "No tasks assigned for this node"}

    tasks = tasks_store[node_id]["tasks"]
    task_map = {t["task_id"]: t for t in tasks}

    valid = 0
    for sub in submissions:
        task = task_map.get(sub.get("task_id"))
        if task and _verify_task_result(task, sub, node_id):
            valid += 1

    score = valid / len(tasks) if tasks else 0.0
    passed = score >= config.PHASE1_PASS_THRESHOLD

    if passed:
        await registry.set_phase(node_id, "PHASE_2")
        from modules import networking
        await networking.broadcast("PHASE_UPDATE", {
            "node_id": node_id,
            "phase": "PHASE_2"
        })

    tasks_store[node_id]["results"] = {"score": score, "passed": passed}
    await storage.write(_TASKS_FILE, tasks_store)

    return {"score": score, "passed": passed, "phase": "PHASE_2" if passed else "PHASE_1"}


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Vouching
# ═══════════════════════════════════════════════════════════════════════════════

async def vouch(voucher_id: str, target_id: str) -> dict:
    """
    Voucher stakes tokens for target node.
    Returns vouch record or error.
    """
    # ── Security Gating: No BANNED nodes ──────────────────────────────────────
    if await registry.get_phase(voucher_id) == "BANNED":
        return {"error": "BANNED nodes cannot vouch"}
    if await registry.get_phase(target_id) == "BANNED":
        return {"error": "Target node is BANNED"}

    # Check voucher eligibility
    if not await reputation.is_eligible_to_vouch(voucher_id):
        return {"error": "Voucher reputation too low"}

    # Check target is in Phase 2
    phase = await registry.get_phase(target_id)
    if phase == "UNKNOWN":
        # Proactive sync: maybe we missed the JOIN or PHASE_UPDATE broadcast
        await registry.sync_from_peers()
        phase = await registry.get_phase(target_id)
    if phase != "PHASE_2":
        return {"error": f"Target node is not in Phase 2 (currently {phase})"}

    if voucher_id == target_id:
        return {"error": "You cannot vouch for yourself"}

    # ── Duplicate Check ──────────────────────────────────────────────────────
    vouches = await storage.read_or_default(_VOUCHES_FILE, {})
    target_vouches = vouches.get(target_id, [])
    if any(v.get("voucher_id") == voucher_id and v.get("status") == "ACTIVE" for v in target_vouches):
        return {"error": f"Node {voucher_id[:8]} already has an active vouch for this target"}

    # Total vouch count check
    active_count = len([v for v in target_vouches if v.get("status") == "ACTIVE"])
    if active_count >= getattr(config, "VOUCHES_REQUIRED", 2):
        return {"error": "Target node already has enough active vouches"}

    # Calculate stake: Ensure we use the most up-to-date score and config
    voucher_score = await reputation.get_score(voucher_id)
    
    # DYNAMIC: Use 10% of current reputation or 0.1 default
    v_score = float(voucher_score) if (voucher_score is not None and isinstance(voucher_score, (int, float)) and voucher_score > 0) else 0.7
    v_delta = float(getattr(config, "VOUCH_DELTA", 0.1))
    
    # Formula: reputation * delta * 100 tokens. 
    # Hardcoded minimum of 10.0 to ensure it's never zero and provides visual feedback.
    stake_amount = float(max(10.0, v_score * v_delta * 100.0))

    # Stake from voucher's wallet
    try:
        stake_tx = await wallet.stake(stake_amount, reason=f"VOUCH:{target_id}")
    except ValueError as e:
        return {"error": str(e)}

    # Record vouch locally
    vouch_record = {
        "voucher_id": voucher_id,
        "target_id": target_id,
        "stake_amount": stake_amount,
        "stake_tx": stake_tx["tx_id"],
        "rep_granted": 0.0,
        "timestamp": time.time(),
        "status": "ACTIVE",
    }
    
    # Broadcast to network so peers record the vouch (they won't stake again)
    from modules import networking
    await networking.broadcast("VOUCH", {"vouch_record": vouch_record})

    record = await receive_vouch(vouch_record)
    return {"record": record, "tx": stake_tx}


async def receive_vouch(vouch_record: dict) -> dict:
    """Called when receiving a VOUCH broadcast. Records the vouch without double-staking."""
    target_id = vouch_record.get("target_id")
    voucher_id = vouch_record.get("voucher_id")
    
    if not target_id or not voucher_id:
        return {"error": "Invalid vouch record"}

    vouches = await storage.read_or_default(_VOUCHES_FILE, {})
    if target_id not in vouches:
        vouches[target_id] = []
        
    # Idempotency: If this exact vouch (same TX) is already recorded, just return it
    existing = next((v for v in vouches[target_id] if v.get("stake_tx") == vouch_record.get("stake_tx")), None)
    if existing:
        return existing

    # Prevent double-vouching by the same node (if active)
    if any(v.get("voucher_id") == voucher_id and v.get("status") == "ACTIVE" for v in vouches[target_id]):
        return {"error": f"Node {voucher_id[:8]} already has an active vouch for this target"}
        
    vouches[target_id].append(vouch_record)
    await storage.write(_VOUCHES_FILE, vouches)

    # Check if we have enough active vouches to advance to Phase 3
    active_vouches = [v for v in vouches[target_id] if v.get("status") == "ACTIVE"]
    needed = getattr(config, "VOUCHES_REQUIRED", 2)
    
    if len(active_vouches) >= needed:
        current_phase = await registry.get_phase(target_id)
        if current_phase == "PHASE_2":
            await registry.set_phase(target_id, "PHASE_3")
            await registry.set_voucher(target_id, voucher_id)
            
            # Broadcast phase update if advancing (prevent loops by only having the final voucher broadcast)
            from modules import identity as ident
            my_id = ident.get()["node_id"]
            if my_id == voucher_id:
                from modules import networking
                await networking.broadcast("PHASE_UPDATE", {
                    "node_id": target_id,
                    "phase": "PHASE_3",
                })

    return vouch_record

async def get_vouch_status(node_id: str) -> list | None:
    vouches = await storage.read_or_default(_VOUCHES_FILE, {})
    return vouches.get(node_id)


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — Graduated Participation
# ═══════════════════════════════════════════════════════════════════════════════

async def record_honest_round(node_id: str) -> dict:
    """Called after each honest block round. Manages transitions through Phase 3 and Observation."""
    rounds = await registry.increment_honest_rounds(node_id)
    current_phase = await registry.get_phase(node_id)

    # 1. Transition: Phase 3 -> UNDER_OBSERVATION (After 20 rounds)
    if current_phase == "PHASE_3" and rounds >= config.PHASE3_ROUNDS:
        await registry.set_phase(node_id, "UNDER_OBSERVATION")
        await _broadcast_phase_update(node_id, "UNDER_OBSERVATION")
        return {"phase": "UNDER_OBSERVATION", "rounds": rounds}

    # 2. Transition: UNDER_OBSERVATION -> FULL_NODE (After 45 rounds total)
    if rounds >= config.PHASE3_HONEST_ROUNDS:
        await registry.set_phase(node_id, "FULL_NODE")
        await _broadcast_phase_update(node_id, "FULL_NODE")
        
        # ── GRADUATION: Return 100% of stake to all vouchers ──
        vouches = await storage.read_or_default(_VOUCHES_FILE, {})
        vouch_list = vouches.get(node_id, [])
        changed = False
        raw_txs = []
        for v in vouch_list:
            if isinstance(v, dict) and v.get("status") == "ACTIVE":
                v_id = v.get("voucher_id")
                try:
                    # 🚨 FIX: Specify the voucher's address to return THEIR money
                    tx = await wallet.unstake(v["stake_amount"], address=v_id, reason=f"GRADUATED:{node_id}")
                    raw_txs.append(tx)
                    
                    from modules import audit
                    audit.log_event("REWARD", "Voucher Refunded", f"Node {node_id[:8]} graduated! Full stake {v['stake_amount']} returned to voucher.")
                except Exception:
                    pass
                v["status"] = "RELEASED"
                changed = True
        
        if changed:
            await storage.write(_VOUCHES_FILE, vouches)
            
            # 📡 Broadcast the refunds so the UI updates immediately
            from modules import networking, consensus
            for tx_dict in raw_txs:
                try:
                    await networking.broadcast("transaction", tx_dict)
                    consensus.add_pending_event(tx_dict)
                except Exception: pass

        return {"phase": "FULL_NODE", "rounds": rounds}

    return {"phase": current_phase, "rounds": rounds, "needed": config.PHASE3_HONEST_ROUNDS}


async def penalize_malicious(node_id: str) -> dict:
    """Ban a malicious node and slash its voucher's stake based on phase."""
    current_phase = await registry.get_phase(node_id)
    await registry.set_phase(node_id, "BANNED")
    await reputation.update(node_id, honest=False)
    
    # 📡 Broadcast the ban to the entire network immediately
    from modules import networking
    await networking.broadcast("PHASE_UPDATE", {
        "node_id": node_id,
        "phase": "BANNED"
    })

    vouches = await storage.read_or_default(_VOUCHES_FILE, {})
    vouch_list = vouches.get(node_id, [])
    
    result = {"node_id": node_id, "phase": "BANNED", "slash_txs": [], "return_txs": []}
    changed = False

    for v in vouch_list:
        if isinstance(v, dict) and v.get("status") == "ACTIVE":
            amount = v.get("stake_amount", 0)
            v_id = v.get("voucher_id")
            try:
                if current_phase == "PHASE_3":
                    # ── PHASE 3: 100% Slash ──
                    tx = await wallet.slash(amount, address=v_id, note=f"MALICIOUS_SLASH:{node_id}")
                    result["slash_txs"].append(tx["tx_id"])
                    result.setdefault("_raw_txs", []).append(tx)
                    v["status"] = "SLASHED_100"
                elif current_phase == "UNDER_OBSERVATION":
                    # ── OBSERVATION: 50% Slash / 50% Return ──
                    slash_tx = await wallet.slash(amount / 2, address=v_id, note=f"OBSERVATION_SHELTER_SLASH:{node_id}")
                    return_tx = await wallet.unstake(amount / 2, address=v_id, reason=f"OBSERVATION_SHELTER:{node_id}")
                    result["slash_txs"].append(slash_tx["tx_id"])
                    result["return_txs"].append(return_tx["tx_id"])
                    result.setdefault("_raw_txs", []).append(slash_tx)
                    result.setdefault("_raw_txs", []).append(return_tx)
                    v["status"] = "SLASHED_50"
                else:
                    # ── FULL_NODE: No effect on voucher ──
                    return_tx = await wallet.unstake(amount, address=v_id, reason=f"SAFE_EXIT:{node_id}")
                    result["return_txs"].append(return_tx["tx_id"])
                    result.setdefault("_raw_txs", []).append(return_tx)
                    v["status"] = "RELEASED_SAFE"

                # Penalize voucher's reputation if node was still in probation
                if current_phase in ("PHASE_3", "UNDER_OBSERVATION") and v_id:
                    await reputation.update(v_id, honest=False)

            except Exception:
                pass
            changed = True

    # ── Background the Broadcast to prevent HTTP timeout ──
    async def _bg_slash(tx_list):
        from modules import networking, consensus
        for tx_dict in tx_list:
            try:
                await networking.broadcast("transaction", tx_dict)
                consensus.add_pending_event(tx_dict)
            except Exception: pass
        
        # 🚨 Emergency Consensus: Mine the slash immediately!
        try:
            await consensus.run_consensus_round(force=True)
        except Exception: pass
    
    import asyncio
    asyncio.create_task(_bg_slash(result.get("_raw_txs", [])))

    if changed:
        await storage.write(_VOUCHES_FILE, vouches)

    await _broadcast_phase_update(node_id, "BANNED")
    return result


async def _broadcast_phase_update(node_id: str, phase: str) -> None:
    """Broadcast a PHASE_UPDATE message so all peers sync their registry."""
    try:
        from modules import networking
        await networking.broadcast("PHASE_UPDATE", {
            "node_id": node_id,
            "phase": phase,
        })
    except Exception:
        pass


async def get_node_status(node_id: str) -> dict:
    """Return full phase + reputation status for a node (used by frontend)."""
    node = await registry.get_node(node_id)
    phase = node["phase"] if node else "UNKNOWN"
    rounds = node["honest_rounds"] if node else 0
    
    score = await reputation.get_score(node_id)
    flags = await reputation.eligibility_flags(node_id)
    vouch = await get_vouch_status(node_id)

    tasks_store = await storage.read_or_default(_TASKS_FILE, {})
    task_result = tasks_store.get(node_id, {}).get("results", {})

    return {
        "node_id": node_id,
        "phase": phase,
        "rounds": rounds,
        "reputation_score": round(score, 4),
        "eligible_to_vouch": flags["eligible_to_vouch"],
        "eligible_to_propose": flags["eligible_to_propose"],
        "eligible_to_vote": flags["eligible_to_vote"],
        "vouch": vouch,
        "task_result": task_result,
    }
