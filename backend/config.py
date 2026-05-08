"""
config.py — Global node configuration.
All parameters match the IEEE ColdStart-PoR paper defaults.
Override any value with an environment variable.
"""
import os
import pathlib

# ── Network ────────────────────────────────────────────────────────────────────
NODE_PORT: int = int(os.getenv("NODE_PORT", 5000))
PEERS: list[str] = [p.strip() for p in os.getenv("PEERS", "").split(",") if p.strip()]

# ── Reputation ─────────────────────────────────────────────────────────────────
# IEEE paper: λ = 0.8  (Eq. 4 decay factor)
LAMBDA: float = float(os.getenv("LAMBDA", 0.8))
FULL_NODE_REP_THRESHOLD: float = 0.7
# IEEE paper: τ_v = 0.4 (40% min voucher reputation)
VOUCH_ELIGIBILITY_THRESHOLD: float = 0.4
INITIAL_REPUTATION: float = 0.05

# ── ColdStart (IEEE Paper Parameters) ──────────────────────────────────────────
# IEEE paper: N = 20 Phase-1 tasks, θ_P = 0.9 pass threshold
PHASE1_TASK_COUNT: int = 20
PHASE1_PASS_THRESHOLD: float = 0.9

# IEEE paper: M = 10 honest rounds to graduate Phase 3
PHASE3_ROUNDS: int = 10
OBSERVATION_ROUNDS: int = 0          # No extra observation phase (paper has single M)
PHASE3_HONEST_ROUNDS: int = 10       # Total honest rounds = M

VOUCHES_REQUIRED: int = 1            # One voucher is sufficient per paper
# IEEE paper: δ = 0.15 (15% reputation staked by voucher, Eq. 2)
VOUCH_DELTA: float = 0.15
# IEEE paper: α = 0.5 (50% dampening, Eq. 3: R_new = α·R_s·δ)
VOUCH_ALPHA: float = 0.5

# ── Consensus ──────────────────────────────────────────────────────────────────
BLOCK_INTERVAL_SECONDS: int = 5
# BFT 2/3 majority threshold
CONSENSUS_THRESHOLD: float = 0.667

# ── Wallet ─────────────────────────────────────────────────────────────────────
GENESIS_BALANCE: float = 100.0

# ── Storage ────────────────────────────────────────────────────────────────────
_BACKEND_DIR = pathlib.Path(__file__).parent.resolve()
_DEFAULT_DATA = _BACKEND_DIR / "data"

_env_data = os.getenv("DATA_DIR")
DATA_DIR = pathlib.Path(_env_data).resolve() if _env_data else _DEFAULT_DATA
DATA_DIR.mkdir(parents=True, exist_ok=True)
