"""routes_node.py — /node_state and /peers endpoints."""
from fastapi import APIRouter
from modules import identity, registry, reputation, blockchain, networking, wallet

router = APIRouter()


@router.get("/node_state")
async def node_state():
    node = identity.get()
    node_id = node["node_id"]
    phase = await registry.get_phase(node_id)
    flags = await reputation.eligibility_flags(node_id)
    chain = await blockchain.get_chain()
    peers = await networking.load_peers()
    bal = await wallet.balance()

    # Get full node info including rounds
    node_info = await registry.get_node(node_id)
    rounds = node_info.get("honest_rounds", 0) if node_info else 0

    return {
        "node_id": node_id,
        "public_key": node["public_key"],
        "phase": phase,
        "rounds": rounds,
        "reputation_score": await reputation.get_score(node_id),
        **flags,
        "peers_count": len(peers),
        "chain_height": len(chain),
        "wallet": bal,
    }


@router.get("/peers")
async def get_peers():
    peers = await networking.load_peers()
    status = await networking.check_peers()
    return {
        "peers": [{"url": p, "status": status.get(p, "unknown")} for p in peers]
    }


@router.post("/peers/add")
async def add_peer(body: dict):
    url = body.get("url")
    if not url:
        return {"error": "url required"}
    await networking.add_peer(url)
    return {"added": url}


@router.get("/node/registry")
async def get_registry():
    """Return all known nodes with phase and reputation info. Used by ColdStart admin panel."""
    from modules import coldstart
    all_nodes = await registry.all_nodes()
    result = {}
    for node_id, info in all_nodes.items():
        score = await reputation.get_score(node_id)
        result[node_id] = {
            **info,
            "reputation_score": round(score, 4),
        }
    return {"nodes": result}
@router.get("/config")
async def get_config():
    """Return public protocol parameters for the frontend."""
    import config
    return {
        "VOUCHES_REQUIRED": config.VOUCHES_REQUIRED,
        "PHASE1_PASS_THRESHOLD": config.PHASE1_PASS_THRESHOLD,
        "PHASE3_HONEST_ROUNDS": config.PHASE3_HONEST_ROUNDS,
    }
