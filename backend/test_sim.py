import asyncio
import time
import os
os.environ["NODE_PORT"] = "5004"
from modules import registry, identity, consensus, networking, reputation, blockchain

async def main():
    await identity.init()
    node = identity.get()
    node_id = node["node_id"]
    
    await blockchain.init()
    await registry.init()
    await reputation.init()
    
    await registry.register(node_id, node["public_key"], phase="PHASE_3")
    
    last_b = await blockchain.last_block()
    
    block = {
        "index": last_b["index"] + 1,
        "timestamp": time.time(),
        "events": [],
        "proposer": "5000_node_id_fake",
        "previous_hash": last_b["hash"],
        "nonce": 0,
    }
    block["merkle_root"] = blockchain._merkle_root(block.get("events", []))
    block["hash"] = blockchain._hash_block(block)
    
    res = await blockchain.validate_block(block)
    print("validate_block returned:", res)
    
    # Check individually
    chain = await blockchain.get_chain()
    expected_index = len(chain)
    print("Index check:", block.get("index") == expected_index)
    print("Prev hash check:", block.get("previous_hash") == chain[-1]["hash"])
    print("Hash integrity:", blockchain._hash_block(block) == block.get("hash"))
    print("Merkle:", blockchain._merkle_root(block.get("events", [])) == block.get("merkle_root"))

asyncio.run(main())
