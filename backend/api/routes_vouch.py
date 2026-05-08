"""routes_vouch.py — ColdStart Phase 2 vouching endpoints."""
from fastapi import APIRouter, HTTPException
from modules import coldstart, identity, reputation

router = APIRouter()


@router.post("/vouch")
async def submit_vouch(body: dict):
    """
    Vouch for a node in Phase 2.
    Body: { target_id }  — voucher is always this node.
    """
    my_id = identity.get()["node_id"]
    target_id = body.get("target_id")
    if not target_id:
        raise HTTPException(status_code=400, detail="target_id required")
    if target_id == my_id:
        raise HTTPException(status_code=400, detail="Cannot vouch for yourself")

    result = await coldstart.vouch(my_id, target_id)
    if not result or "error" in result:
        raise HTTPException(status_code=403, detail=result.get("error", "Vouch failed"))
    
    # Check if the inner record contains an error
    record = result.get("record", {})
    if isinstance(record, dict) and "error" in record:
         raise HTTPException(status_code=403, detail=record["error"])

    # Mine the stake TX on-chain
    stake_tx = result.get("tx")
    if stake_tx:
        from modules import consensus, networking
        consensus.add_pending_event(stake_tx)
        await networking.broadcast("TX", {"tx": stake_tx})

    return record


@router.get("/vouch/status")
async def vouch_status(node_id: str | None = None):
    if not node_id:
        node_id = identity.get()["node_id"]
    status = await coldstart.get_vouch_status(node_id)
    return status or {"message": "No vouch record found"}


@router.get("/vouch/eligible_vouchers")
async def eligible_vouchers():
    """Return list of nodes eligible to vouch (eligibility flag only)."""
    from modules import registry
    all_nodes = await registry.all_nodes()
    result = []
    for node_id, info in all_nodes.items():
        eligible = await reputation.is_eligible_to_vouch(node_id)
        if eligible:
            result.append({
                "node_id": node_id,
                "phase": info["phase"],
                "eligible_to_vouch": True,
            })
    return {"eligible_vouchers": result}
