"""
wallet.py — Token wallet integrated with node identity.
Wallet address = node_id. Every transaction is signed and recorded on-chain.
State is derived strictly from the blockchain ledger, not local files.
"""
import time
import uuid

from modules import storage, identity

_WALLET_FILE = "wallet.json"


# ── Init ─────────────────────────────────────────────────────────────────────

async def init() -> dict:
    """Load or create wallet identity for this node."""
    saved = await storage.read(_WALLET_FILE)
    if saved:
        return saved

    node = identity.get()
    wallet = {
        "address": node["node_id"],
    }
    await storage.write(_WALLET_FILE, wallet)
    return wallet


# ── Accessors ─────────────────────────────────────────────────────────────────

async def get() -> dict:
    return await storage.read_or_default(_WALLET_FILE, {})


async def balance(address: str = None) -> dict:
    """Return the balance and staked amount for an address, including pending mempool TXs."""
    if address is None:
        address = identity.get()["node_id"]
    
    from modules import blockchain, consensus
    chain = await blockchain.get_chain()
    state = blockchain.calculate_balance(address, chain)

    # Apply pending transactions for real-time reactivity
    for ev in consensus._pending_events:
        if ev.get("from") == address or ev.get("to") == address:
            type_ = ev.get("type")
            amt = ev.get("amount", 0.0)
            
            if type_ == "SEND":
                if ev.get("from") == address: state["balance"] -= amt
                if ev.get("to") == address:   state["balance"] += amt
            elif type_ == "STAKE" and ev.get("from") == address:
                state["balance"] -= amt
                state["staked"] += amt
            elif type_ == "UNSTAKE" and ev.get("from") == address:
                state["staked"] -= amt
                state["balance"] += amt
            elif type_ == "SLASH" and ev.get("from") == address:
                state["staked"] -= amt

    return state


async def history(address: str = None) -> list:
    """Return transaction history for an address."""
    if address is None:
        address = identity.get()["node_id"]
    
    from modules import blockchain
    chain = await blockchain.get_chain()
    
    txs = []
    
    def process_event(ev, block_index):
        if ev.get("type") in ("SEND", "STAKE", "UNSTAKE", "SLASH"):
            record = ev.copy()
            record["block_index"] = block_index
            
            is_sender = (ev.get("from") == address)
            is_receiver = (ev.get("to") == address)
            
            if is_sender or is_receiver:
                # If we are the receiver of a SEND, it's a RECEIVE for us
                if is_receiver and ev.get("type") == "SEND":
                    record["type"] = "RECEIVE"
                txs.append(record)

    for block in chain:
        for ev in block.get("events", []):
            process_event(ev, block.get("index"))
    
    # Also grab pending mempool transactions
    from modules import consensus
    for ev in consensus._pending_events:
        process_event(ev, "Pending")

    # Sort newest first
    txs.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    return txs


async def send(to_address: str, amount: float) -> dict:
    """Create a signed TX. Balance is validated by the network upon block creation."""
    # ── Security Gating: No BANNED nodes ──────────────────────────────────────
    from modules import registry
    my_id = identity.get()["node_id"]
    if await registry.get_phase(my_id) == "BANNED":
        raise ValueError("BANNED nodes cannot send tokens")

    if amount <= 0:
        raise ValueError("Amount must be positive")
    
    bal = await balance()
    if bal["balance"] < amount:
        raise ValueError(f"Insufficient balance ({bal['balance']:.4f} < {amount})")

    tx = _build_tx("SEND", identity.get()["node_id"], to_address, amount)
    return tx


async def receive(tx: dict) -> bool:
    """
    Validate an incoming TX structure over P2P.
    We no longer modify local balances. The transaction must be mined to affect balance.
    """
    payload = {k: v for k, v in tx.items() if k != "signature"}
    if not identity.verify(identity.canonical(payload), tx["signature"], tx["sender_pubkey"]):
        return False
    return True


async def stake(amount: float, reason: str = "VOUCH") -> dict:
    """Lock tokens as stake (vouching). Returns stake TX."""
    # ── Security Gating: No BANNED nodes ──────────────────────────────────────
    from modules import registry
    my_id = identity.get()["node_id"]
    if await registry.get_phase(my_id) == "BANNED":
        raise ValueError("BANNED nodes cannot stake tokens")

    bal = await balance()
    if bal["balance"] < amount:
        raise ValueError("Insufficient balance to stake")
    tx = _build_tx("STAKE", identity.get()["node_id"], "NETWORK", amount, note=reason)
    return tx


async def unstake(amount: float, address: str = None, reason: str = "RELEASED") -> dict:
    """Release locked stake back to balance. If address is None, uses self."""
    # ── Security Gating: No BANNED nodes ──────────────────────────────────────
    from modules import registry
    my_id = identity.get()["node_id"]
    if await registry.get_phase(my_id) == "BANNED":
        # Exception: Allow UNSTAKE if it's a protocol return (handled by validator)
        # But prevent the local banned user from triggering it themselves
        if not reason.startswith("GRADUATED") and not reason.startswith("OBSERVATION_SHELTER"):
            raise ValueError("BANNED nodes cannot manually unstake tokens")

    if address is None:
        address = identity.get()["node_id"]
    
    bal = await balance(address)
    release = min(amount, bal["staked"])
    tx = _build_tx("UNSTAKE", address, "NETWORK", release, note=reason)
    return tx


async def slash(amount: float, address: str = None, note: str = "MALICIOUS_NODE") -> dict:
    """Destroy staked tokens as penalty. If address is None, uses self."""
    if address is None:
        address = identity.get()["node_id"]

    bal = await balance(address)
    loss = min(amount, bal["staked"])
    tx = _build_tx("SLASH", address, "BURN", loss, note=note)
    return tx


# ── Private ───────────────────────────────────────────────────────────────────

def _build_tx(type_: str, from_: str, to: str, amount: float, note: str = "") -> dict:
    node = identity.get()
    payload = {
        "tx_id": str(uuid.uuid4()),
        "type": type_,
        "from": from_,
        "to": to,
        "amount": amount,
        "note": note,
        "timestamp": time.time(),
        "sender_pubkey": node["public_key"],
    }
    payload["signature"] = identity.sign(identity.canonical(payload))
    return payload
