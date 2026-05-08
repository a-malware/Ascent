"""routes_wallet.py — Wallet endpoints."""
from fastapi import APIRouter, HTTPException
from modules import wallet, networking

router = APIRouter()


@router.get("/wallet/balance")
async def get_balance(address: str = None):
    return await wallet.balance(address)


@router.get("/wallet/history")
async def get_history(address: str = None):
    txs = await wallet.history(address)
    return {"transactions": txs, "count": len(txs)}


@router.post("/wallet/send")
async def send_tokens(body: dict):
    """
    Send tokens to another node.
    Body: { to: node_id, amount: float }
    TX is signed and broadcast to peers automatically.
    """
    to_address = body.get("to")
    amount = body.get("amount")
    if not to_address or amount is None:
        raise HTTPException(status_code=400, detail="'to' and 'amount' are required")
    try:
        tx = await wallet.send(to_address, float(amount))
        # Add to local pending events for consensus proposer
        from modules import consensus
        consensus.add_pending_event(tx)
        
        # Broadcast TX to peers
        await networking.broadcast("TX", {"tx": tx})
        return {"success": True, "tx": tx}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wallet/broadcast")
async def broadcast_signed_tx(tx: dict):
    """
    Accept a pre-signed transaction from a browser wallet and broadcast it.
    The signature is verified before the TX enters the mempool.
    """
    try:
        # 1. Verify the signature — same path as the P2P TX handler
        if not await wallet.receive(tx):
            raise HTTPException(status_code=400, detail="Invalid transaction signature")

        # 2. Add to local mempool
        from modules import consensus
        consensus.add_pending_event(tx)

        # 3. Broadcast to P2P network
        await networking.broadcast("TX", {"tx": tx})
        return {"success": True, "tx_id": tx.get("tx_id")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
