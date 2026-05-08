"""
registry.py — Node registry: tracks all known nodes, their phases, and public keys.
"""
from modules import storage

_REG_FILE = "registry.json"

PHASES = ["UNKNOWN", "PHASE_1", "PHASE_2", "PHASE_3", "UNDER_OBSERVATION", "FULL_NODE", "BANNED"]


async def init() -> None:
    existing = await storage.read(_REG_FILE)
    if existing is None:
        await storage.write(_REG_FILE, {})


async def register(node_id: str, public_key: str, phase: str = "PHASE_1") -> None:
    reg = await storage.read_or_default(_REG_FILE, {})
    if node_id not in reg:
        reg[node_id] = {
            "node_id": node_id,
            "public_key": public_key,
            "phase": phase,
            "honest_rounds": 0,
            "voucher": None,
        }
        await storage.write(_REG_FILE, reg)


async def get_node(node_id: str) -> dict | None:
    reg = await storage.read_or_default(_REG_FILE, {})
    return reg.get(node_id)


async def set_phase(node_id: str, phase: str) -> None:
    reg = await storage.read_or_default(_REG_FILE, {})
    if node_id in reg:
        reg[node_id]["phase"] = phase
    else:
        # Auto-register if we get a phase update for an unknown node
        # We might not have the public key yet, so we'll need to sync it later or use a placeholder
        reg[node_id] = {
            "node_id": node_id,
            "public_key": "UNKNOWN_SYNC_NEEDED",
            "phase": phase,
            "honest_rounds": 0,
            "voucher": None,
        }
    await storage.write(_REG_FILE, reg)


async def get_node(node_id: str) -> dict | None:
    """Return the full state for a single node."""
    nodes = await all_nodes()
    return nodes.get(node_id)


async def get_phase(node_id: str) -> str:
    node = await get_node(node_id)
    return node["phase"] if node else "UNKNOWN"


async def increment_honest_rounds(node_id: str) -> int:
    reg = await storage.read_or_default(_REG_FILE, {})
    if node_id in reg:
        reg[node_id]["honest_rounds"] = reg[node_id].get("honest_rounds", 0) + 1
        await storage.write(_REG_FILE, reg)
        return reg[node_id]["honest_rounds"]
    return 0


async def set_voucher(node_id: str, voucher_id: str) -> None:
    reg = await storage.read_or_default(_REG_FILE, {})
    if node_id in reg:
        reg[node_id]["voucher"] = voucher_id
        await storage.write(_REG_FILE, reg)


async def all_nodes() -> dict:
    return await storage.read_or_default(_REG_FILE, {})


async def full_nodes() -> list:
    reg = await storage.read_or_default(_REG_FILE, {})
    return [n for n in reg.values() if n["phase"] == "FULL_NODE"]
async def sync_from_peers() -> None:
    """Fetch registry data from peers and merge with local data."""
    from modules import networking
    peers = await networking.load_peers()
    if not peers:
        return

    import httpx
    async with httpx.AsyncClient(timeout=2.0) as client:
        for peer in peers:
            try:
                r = await client.get(f"{peer}/node/registry")
                if r.status_code == 200:
                    remote_nodes = r.json().get("nodes", {})
                    local_reg = await storage.read_or_default(_REG_FILE, {})
                    
                    changed = False
                    for nid, info in remote_nodes.items():
                        if nid not in local_reg:
                            local_reg[nid] = info
                            changed = True
                        else:
                            # Update phase if remote is further ahead
                            remote_p = info.get("phase", "PHASE_1")
                            local_p = local_reg[nid].get("phase", "PHASE_1")
                            if phase_index(remote_p) > phase_index(local_p):
                                local_reg[nid]["phase"] = remote_p
                                changed = True
                    
                    if changed:
                        await storage.write(_REG_FILE, local_reg)
                    break # Successful sync from one peer is usually enough
            except Exception:
                continue

# Helper for phase comparison
PHASES = ["UNKNOWN", "PHASE_1", "PHASE_2", "PHASE_3", "UNDER_OBSERVATION", "FULL_NODE", "BANNED"]
def phase_index(p: str) -> int:
    try: return PHASES.index(p)
    except: return 0
