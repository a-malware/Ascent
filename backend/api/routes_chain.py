"""routes_chain.py — /chain endpoints."""
from fastapi import APIRouter, HTTPException
from modules import blockchain

router = APIRouter()


@router.get("/chain")
async def get_chain():
    chain = await blockchain.get_chain()
    return {"height": len(chain), "chain": chain}


@router.get("/chain/block/{index}")
async def get_block(index: int):
    block = await blockchain.get_block(index)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


@router.get("/chain/last")
async def get_last_block():
    return await blockchain.last_block()
