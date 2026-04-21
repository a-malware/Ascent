# ColdStart-PoR — Solana Implementation

A working Solana/Anchor implementation of **ColdStart-PoR**, the three-phase
incentive-compatible bootstrapping protocol for Proof-of-Reputation blockchains,
as described in the IEEE paper:

> *"ColdStart-PoR: An Incentive-Compatible Reputation Bootstrapping Protocol
> for Proof-of-Reputation Blockchains"*
> Abhijith S et al., Amrita Vishwa Vidyapeetham, 2026.

---

## What the paper proposes

Proof-of-Reputation (PoR) blockchains select validators based on their
behavioral history. The **cold-start problem** is: how does a new node earn
reputation when it has none, without enabling Sybil attacks?

ColdStart-PoR solves this with a **three-phase entry mechanism**:

```
New node
  │
  ▼
Phase 1 ── Probationary Tasks ──────────────────────────────────────
  │  Complete N verifiable micro-tasks.
  │  Score P(v_new, N) = (1/N) Σ 1[πⱼ valid]          (Eq. 1)
  │  Advance if P ≥ θ_P, else BANNED.
  │
  ▼
Phase 2 ── Stake-Backed Vouching ──────────────────────────────────
  │  An established node vₛ (Rₛ ≥ τᵥ) stakes δ·Rₛ collateral:
  │    R'ₛ = Rₛ·(1−δ)                                  (Eq. 2)
  │  New node receives provisional reputation:
  │    R_new(0) = α·Rₛ·δ                                (Eq. 3)
  │
  ▼
Phase 3 ── Graduated Participation ────────────────────────────────
     Vote-only for M rounds. Reputation evolves:
       R(t+1) = λ·R(t) + (1−λ)·h(t)                    (Eq. 4)
     After M honest rounds → FULL participation (stake returned).
     Misbehaviour → BANNED (stake slashed).
```

### Key properties proven in the paper

| Property | Result |
|---|---|
| Incentive Compatible | Honest behaviour is a Nash equilibrium (Theorem 1) |
| Sybil Resistance | Cost grows O(k·τᵥ) — linear with attacker scale (Proposition 1) |
| Decentralised | No trusted authority needed after genesis seeding |
| No stake/PoW | Purely reputation-native |

---

## Project structure

```
coldstart-por/
├── programs/
│   └── coldstart_por/
│       └── src/
│           └── lib.rs          ← Anchor program (all protocol logic)
├── tests/
│   └── coldstart_por.ts        ← Full lifecycle test suite
├── Anchor.toml
├── Cargo.toml
├── package.json
├── tsconfig.json
└── README.md
```

---

## Prerequisites

Install the following tools **in order**:

### 1. Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup component add rustfmt clippy
```

### 2. Solana CLI

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

Add to your shell (add to `~/.zshrc` or `~/.bashrc`):

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Verify:

```bash
solana --version   # e.g. solana-cli 2.x.x
```

### 3. Anchor CLI

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.1
avm use 0.32.1
anchor --version   # anchor-cli 0.32.1
```

### 4. Node.js & Yarn

```bash
# Node ≥ 18 via nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20 && nvm use 20

npm install -g yarn
```

---

## Setup

```bash
cd coldstart-por

# Install TypeScript dependencies
yarn install
```

---

## Running the tests (local validator)

All tests run against a local Solana test validator spun up automatically by
Anchor. No real SOL is needed.

```bash
# 1. Generate a local keypair (skip if you already have one)
solana-keygen new --outfile ~/.config/solana/id.json

# 2. Set cluster to localnet
solana config set --url localhost

# 3. Build the program
anchor build

# 4. Run all tests
anchor test
```

Expected output (abridged):

```
ColdStart-PoR — Full Protocol Lifecycle
  ✔ 1. Initialises the PoR network with paper-default parameters (419ms)
  ✔ 2. Authority bootstraps a genesis node with initial reputation (460ms)
  ✔ 3a. New node registers → enters Phase 1 (455ms)
  ✔ 3b. Candidate mines and submits all Phase-1 task proofs (2330ms)
  ✔ 4. Genesis node vouches for candidate (Eq. 2 & 3) (459ms)
  ✔ 5. Candidate casts votes across M rounds, reputation evolves per Eq. 4 (2768ms)
  ✔ 6. Voucher reclaims staked reputation after candidate graduates (456ms)
  ✔ 7. Sybil resistance: cost grows linearly with k (Proposition 1)
  ✔ 8. Misbehaviour: Phase-3 node is banned and voucher's stake is slashed (5175ms)
  ✔ 9. Protocol summary — fetch and display final state

  10 passing (14s)
```

---

## Deploying to Devnet

```bash
# 1. Switch to devnet
solana config set --url devnet

# 2. Airdrop some SOL (devnet faucet)
solana airdrop 2

# 3. Build
anchor build

# 4. Deploy
anchor deploy

# 5. Update Anchor.toml — change [provider] cluster to "Devnet"
# Then run tests against devnet:
anchor test --skip-local-validator
```

---

## Protocol parameters

All parameters are configurable at network init time.

| Parameter | Symbol | Default | Meaning |
|---|---|---|---|
| `delta_bps` | δ | 1500 (0.15) | Vouching stake fraction |
| `alpha_bps` | α | 5000 (0.50) | Reputation dampening factor |
| `theta_p_bps` | θ_P | 9000 (0.90) | Phase-1 pass threshold |
| `tau_v_bps` | τ_v | 4000 (0.40) | Min voucher reputation |
| `lambda_bps` | λ | 8000 (0.80) | Time-decay in rep update |
| `n_tasks` | N | 20 | Number of Phase-1 tasks |
| `m_rounds` | M | 10 | Rounds to graduate Phase 3 |

Values are stored in **basis points** (BPS): `SCALE = 10_000 = 1.0`.

---

## Program instructions

| # | Instruction | Who calls | Description |
|---|---|---|---|
| 1 | `initialize_network` | Authority | Deploy network with parameters |
| 2 | `bootstrap_genesis_node` | Authority | Seed initial full nodes |
| 3 | `register_node` | New node | Enter Phase 1 |
| 4 | `submit_task_proof` | New node | Submit Phase-1 task proof |
| 5 | `vouch_for_node` | Full node | Vouch + stake reputation |
| 6 | `cast_vote` | Phase 3 / Full node | Vote in a consensus round |
| 7 | `release_voucher_stake` | Voucher | Reclaim stake post-graduation |
| 8 | `report_misbehavior` | Authority | Slash stake, ban node |
| 9 | `advance_round` | Authority | Increment consensus round |

---

## Account types (on-chain state)

### `NetworkConfig` PDA — `["config"]`

Global protocol parameters and state.

```
authority       Pubkey    Network admin
delta_bps       u64       δ in BPS
alpha_bps       u64       α in BPS
theta_p_bps     u64       θ_P in BPS
tau_v_bps       u64       τ_v in BPS
lambda_bps      u64       λ in BPS
n_tasks         u8        N
m_rounds        u8        M
current_round   u64       Active consensus round
total_nodes     u32       All-time node count
```

### `NodeState` PDA — `["node", owner]`

Per-node reputation and lifecycle state.

```
owner                Pubkey         Node operator wallet
reputation_bps       u64            R ∈ [0, SCALE]
phase                NodePhase      Phase1/Phase2/Phase3/Full/Banned
tasks_completed      u8             Phase-1 tasks submitted
tasks_passed         u8             Phase-1 tasks that passed proof check
honest_rounds        u8             Phase-3 honest rounds accumulated
voucher              Option<Pubkey> Who vouched for this node
staked_rep_bps       u64            Reputation stake held in escrow
last_voted_round     u64            Anti-double-vote guard
```

### `VouchRecord` PDA — `["vouch", voucher, candidate]`

Records a vouching relationship.

```
voucher                Pubkey   Node that vouched
candidate              Pubkey   Node that was vouched for
staked_reputation_bps  u64      Amount at stake
active                 bool     False once released or slashed
```

---

## Mapping to paper equations

| Equation | Formula | Implemented in |
|---|---|---|
| Eq. 1 | `P(v,k) = (1/k) Σ 1[πⱼ valid]` | `submit_task_proof` |
| Eq. 2 | `R'ₛ = Rₛ·(1−δ)` | `vouch_for_node` |
| Eq. 3 | `R_new(0) = α·Rₛ·δ` | `vouch_for_node` |
| Eq. 4 | `R(t+1) = λ·R(t) + (1−λ)·h(t)` | `cast_vote` |
| Prop 1 | `Sybil cost = O(k·δ·τᵥ)` | verified in test 7 |
| Thm 1  | Nash equilibrium (incentive compat.) | verified via slash mechanics |

---

## Design notes

### Fixed-point arithmetic
Solana programs cannot use floating point.  All `R ∈ [0,1]` values from the
paper are stored as `u64` in basis points: `SCALE = 10_000`.  Multiplication
uses `a * b / SCALE` to stay in BPS space.

### Task proof mechanism
The paper specifies "verifiable micro-tasks" (relay verification, Merkle
proofs, etc.).  This implementation uses a **hash puzzle**: the node finds a
nonce such that `SHA256(pubkey ‖ task_index ‖ nonce)[0] ≤ 0x03`.  This is:
- Trivially solvable by any honest node (average ~64 hashes)
- Independently verifiable on-chain in O(1)
- Costly to fake at scale (same asymptotic behaviour as real tasks)

Replace the proof check in `submit_task_proof` with real verification logic
for production use.

### Centralisation caveat
The genesis bootstrapping step (`bootstrap_genesis_node`) is authority-controlled,
which the paper explicitly acknowledges as unavoidable for the very first nodes
(§II-B).  Once genesis nodes exist, all subsequent entry is fully decentralised.

### Production extensions
- Replace single-authority `report_misbehavior` with committee-signed slashing proofs
- Apply ZK-based vouching (§VI-C) to hide voucher identity
- Implement adaptive τ_v relaxation for sparse networks (§VI-D)
- Add multi-dimensional reputation vectors (§VI-B / R360 model)

---

## Troubleshooting

| Error | Fix |
|---|---|
| `anchor: command not found` | Run `avm use 0.30.1` and check PATH |
| `solana: command not found` | Re-source your shell or check PATH |
| `Error: Account not found` | Run `anchor build` before `anchor test` |
| `insufficient funds` | Run `solana airdrop 2` |
| `Program log: WrongPhase` | Nodes must follow the exact phase sequence |
| Task proof never passes | The miner in the test is deterministic — if it hangs, check `mineProof()` |
