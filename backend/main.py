"""
main.py — POR-Chain node entry point.
Initialises all modules, starts the FastAPI server with CORS,
and launches the background consensus scheduler.
"""
import asyncio
import contextlib
import logging

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pathlib

import config
from modules import identity, wallet, blockchain, reputation, registry, networking, consensus
from api import routes_node, routes_chain, routes_tasks, routes_vouch, routes_wallet, routes_broadcast, routes_simulate

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("por-chain")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("⚡ POR-Chain node starting up...")

    # 1. Init all persistent modules
    node = await identity.init()
    log.info(f"🪪  Node ID: {node['node_id'][:16]}...")

    await wallet.init()
    # Init blockchain with a static genesis block
    await blockchain.init()
    await reputation.init()
    await registry.init()

    # 2. Self-register in our own registry.
    # Core nodes (5000-5003) start as FULL_NODE. Guest nodes start as PHASE_1.
    existing = await registry.get_node(node["node_id"])
    if not existing:
        if config.NODE_PORT <= 5003:
            await registry.register(node["node_id"], node["public_key"], phase="FULL_NODE")
            await reputation.set_initial(node["node_id"], 1.0)
            log.info("🌱 Registered as bootstrap FULL_NODE")
        else:
            await registry.register(node["node_id"], node["public_key"], phase="PHASE_1")
            await reputation.set_initial(node["node_id"])
            log.info("🌱 Registered as new guest node (PHASE_1)")

    # 3. Local Discovery (Magic Join)
    log.info("🔍 Scanning for local neighbors...")
    found = await networking.discover_local_peers()
    if found:
        log.info(f"✨ Auto-discovered {len(found)} local peers: {found}")

    # 4. Announce to peers
    peers = await networking.load_peers()
    if peers:
        log.info(f"📡 Broadcasting NODE_JOIN to {len(peers)} peers...")
        asyncio.create_task(networking.broadcast("NODE_JOIN", {
            "node_id": node["node_id"],
            "public_key": node["public_key"],
            "phase": await registry.get_phase(node["node_id"]),
            "port": config.NODE_PORT,
        }))

    # 4. Sync chain from peers
    log.info("🔄 Syncing chain from peers...")
    await consensus.sync_chain_from_peers()

    # 5. Start consensus & sync schedulers
    task_consensus = asyncio.create_task(_consensus_loop())
    task_sync = asyncio.create_task(_sync_loop())
    log.info(f"✅ Node ready on port {config.NODE_PORT}")

    yield

    task_consensus.cancel()
    task_sync.cancel()
    log.info("👋 Node shutting down.")


async def _consensus_loop():
    """Periodically run a consensus round."""
    while True:
        await asyncio.sleep(config.BLOCK_INTERVAL_SECONDS)
        try:
            block = await consensus.run_consensus_round()
            if block:
                log.info(f"📦 Proposed block #{block['index']}")
        except Exception as e:
            log.error(f"Consensus error: {e}")


async def _sync_loop():
    """Background task to ensure we stay synced with the longest chain in the network."""
    while True:
        try:
            await asyncio.sleep(15) # Check for updates every 15s
            await consensus.sync_chain_from_peers()
        except Exception:
            pass


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="POR-Chain Node",
    description="Proof-of-Reputation decentralized blockchain node",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(routes_node.router, tags=["Node"])
app.include_router(routes_chain.router, tags=["Chain"])
app.include_router(routes_tasks.router, tags=["ColdStart"])
app.include_router(routes_vouch.router, tags=["ColdStart"])
app.include_router(routes_wallet.router, tags=["Wallet"])
app.include_router(routes_broadcast.router, tags=["P2P"])
from api import routes_audit
app.include_router(routes_audit.router, tags=["Audit"])
app.include_router(routes_simulate.router, tags=["Simulation"])

# Serve frontend
_frontend = pathlib.Path(__file__).parent.parent / "frontend"
if _frontend.exists():
    app.mount("/static", StaticFiles(directory=str(_frontend)), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_frontend():
        return FileResponse(str(_frontend / "index.html"))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=config.NODE_PORT,
        reload=False,
        log_level="info",
    )
