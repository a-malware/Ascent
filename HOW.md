# ColdStart-PoR — How It Works

---

## What problem does this solve?

Imagine a blockchain where your **reputation** determines whether you get to
validate blocks — not how much money you staked, not how much computing power
you have, but how trustworthy your past behaviour has been.

That sounds great. But there's one hard question:

> **How does a brand new node earn reputation when it has none?**

This is called the **cold-start problem**. Existing solutions all fail in one
of two ways:

| Approach | What goes wrong |
|---|---|
| Give everyone a free starting score | An attacker creates 1000 fake identities and gets 1000× free reputation (Sybil attack) |
| Only the network founder assigns reputation | Centralized — you have to trust one authority |
| Require token stake like PoS | Now you need money, which defeats the point of reputation |

**ColdStart-PoR** solves this without any of those compromises.

---

## The core idea in one sentence

> A new node proves it can do real work, finds an existing trusted node to
> vouch for it with skin in the game, then earns its place through observed
> behaviour.

---

## The three phases — plain English

```
NEW NODE
   │
   ▼
┌─────────────────────────────────────────────────────┐
│  PHASE 1 — Prove yourself (Probationary Tasks)      │
│                                                     │
│  The network gives you N small jobs to do.          │
│  Each job produces a cryptographic proof.           │
│  If you pass ≥ 90% of them → move to Phase 2.      │
│  If you fail → you're rejected.                     │
└─────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────┐
│  PHASE 2 — Get vouched for (Stake-Backed Vouching)  │
│                                                     │
│  Find an established node willing to vouch for you. │
│  They put 15% of their own reputation on the line.  │
│  You receive a small starting reputation from this. │
│  If you misbehave later → their stake is slashed.   │
│  This means they only vouch for people they trust.  │
└─────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────┐
│  PHASE 3 — Earn your place (Graduated Participation)│
│                                                     │
│  You can vote in consensus but not lead blocks yet. │
│  Each honest round slightly raises your reputation. │
│  After M honest rounds → you're a full participant. │
│  Misbehave at any point → permanent ban.            │
└─────────────────────────────────────────────────────┘
   │
   ▼
FULL PARTICIPANT — your reputation grows normally from here
```

---

## Why this stops Sybil attacks

A Sybil attack is when one person creates thousands of fake identities to
flood the network with fake trust.

Under the old "give everyone a free score" approach, creating 1000 fake nodes
costs nothing — you just sign up 1000 times.

Under ColdStart-PoR, every fake node needs:

1. A real node to vouch for it **and** stake 15% of its reputation
2. That voucher's reputation to be ≥ 40% (the eligibility threshold)

So to create 1000 Sybil nodes you need 1000 vouchers each sacrificing 15% of
their reputation. The cost scales **linearly** with the number of fakes:

```
Sybil nodes (k) │ Cost to attacker
────────────────┼──────────────────
              1 │   600 reputation points
             10 │  6000 reputation points
            100 │ 60000 reputation points
           1000 │ 600000 reputation points  ← economically infeasible
```

Compare this to the old approach where 1000 Sybil nodes costs **zero**.

---

## The math (simplified)

The paper has four equations. Here is what each one actually does:

**Equation 1 — Did you pass your tasks?**
```
Score = (tasks you passed) / (total tasks)

If Score ≥ 0.90  →  advance to Phase 2
If Score < 0.90  →  rejected
```

**Equation 2 — How much does the voucher stake?**
```
Amount staked = 15% × voucher's reputation
Voucher's reputation temporarily drops by that amount
(returned when you graduate, slashed if you misbehave)
```

**Equation 3 — What reputation do you start with?**
```
Your starting reputation = 50% × amount staked
                         = 50% × 15% × voucher's rep
                         = 7.5% of voucher's reputation

This is always less than the voucher's reputation.
You can never start higher than your sponsor.
```

**Equation 4 — How does reputation change each round?**
```
New reputation = 80% × old reputation + 20% × (1 if honest, 0 if not)

Honest vote:    reputation drifts upward toward 1.0
Dishonest vote: reputation drifts downward toward 0.0
The 80% factor means recent behaviour matters more than old history.
```

---

## What this implementation puts on Solana

Every piece of state lives in on-chain accounts. No trusted server, no
database — everything is public and verifiable.

```
NetworkConfig account  (one global)
├── Protocol parameters: δ α θP τv λ N M
└── Current consensus round

NodeState account  (one per node)
├── Reputation score (0–10000, where 10000 = 100%)
├── Current phase: Phase1 / Phase2 / Phase3 / Full / Banned
├── Tasks completed and passed
├── Honest rounds completed
└── Who vouched for this node

VouchRecord account  (one per voucher-candidate pair)
├── Who vouched for whom
├── How much reputation is staked
└── Whether the stake is still active
```

### The 9 on-chain instructions

| Instruction | Who calls it | What it does |
|---|---|---|
| `initialize_network` | Authority (once) | Sets all protocol parameters |
| `bootstrap_genesis_node` | Authority | Creates the first trusted nodes |
| `register_node` | New node | Enters Phase 1 |
| `submit_task_proof` | New node | Submits one task proof |
| `vouch_for_node` | Established node | Stakes reputation, moves candidate to Phase 3 |
| `cast_vote` | Phase 3 / Full node | Records vote, updates reputation via Eq. 4 |
| `release_voucher_stake` | Voucher | Reclaims stake after candidate graduates |
| `report_misbehavior` | Authority | Bans node, slashes voucher stake |
| `advance_round` | Authority | Moves to the next consensus round |

---

## Project file layout

```
coldstart-por/
│
├── programs/
│   └── coldstart_por/
│       └── src/
│           └── lib.rs          ← The entire Solana program (~1100 lines)
│                                  All 9 instructions, all 3 account types,
│                                  all 4 equations implemented here.
│
├── tests/
│   └── coldstart_por.ts        ← TypeScript test suite (~620 lines)
│                                  Walks the full lifecycle end-to-end.
│                                  Includes Sybil resistance verification.
│
├── Anchor.toml                 ← Anchor config (program ID, cluster, test script)
├── Cargo.toml                  ← Rust workspace config
├── package.json                ← Node.js dependencies
├── tsconfig.json               ← TypeScript config
├── README.md                   ← Full technical reference
└── HOW.md                      ← This file
```

---

## How to run it — step by step

### Prerequisites (install once)

**1. Install Rust**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**2. Install Solana CLI**
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```
Verify: `solana --version` should print `solana-cli 3.x.x`

**3. Install Anchor**
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.1
avm use 0.32.1
export PATH="$HOME/.avm/bin:$PATH"
```
Verify: `anchor --version` should print `anchor-cli 0.32.1`

**4. Install Node.js and Yarn**
```bash
# If you don't have Node 18+ already:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20 && nvm use 20

npm install -g yarn
```

---

### Running the project

**Step 1 — Go into the project folder**
```bash
cd /Users/he/projects/coldstart-por
```

**Step 2 — Install JavaScript dependencies**
```bash
yarn install
```
You should see: `Done in Xs.`

**Step 3 — Set Solana to use the local test network**
```bash
solana config set --url localhost
```
You should see: `RPC URL: http://localhost:8899`

**Step 4 — Generate a local wallet (if you haven't already)**
```bash
solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase
```
Skip this if you already have a keypair.

**Step 5 — Build the Rust program**
```bash
anchor build
```
Expected output (last line): `Finished release profile`

This compiles the Solana program and generates the TypeScript types
in `target/types/coldstart_por.ts`.

**Step 6 — Run the tests**
```bash
anchor test
```

Anchor automatically:
- Starts a local Solana validator
- Deploys the program to it
- Runs the TypeScript test suite against it
- Shuts the validator down when done

---

### What you should see when tests pass

```
ColdStart-PoR — Full Protocol Lifecycle

  ✔ 1. Initialises the PoR network with paper-default parameters
       Parameters: δ=15% α=50% θP=90% τv=40%

  ✔ 2. Authority bootstraps a genesis node with initial reputation
       Genesis node R = 70% (7000 BPS)

  ✔ 3a. New node registers → enters Phase 1

  ✔ 3b. Candidate mines and submits all Phase-1 task proofs
       Tasks: 5 completed, 5 passed
       Probationary score P = 100.0% ≥ θP = 90% → Phase 2 ✓

  ✔ 4. Genesis node vouches for candidate (Eq. 2 & 3)
       Eq. 2: staked = δ·R_s = 15% × 7000 = 1050 BPS
       Eq. 3: R_new(0) = α·R_s·δ = 50% × 1050 = 525 BPS

  ✔ 5. Candidate casts votes across M rounds, reputation evolves per Eq. 4
       Round 1: R = 2420 BPS  |  honest_rounds=1  |  phase=Phase3
       Round 2: R = 3936 BPS  |  honest_rounds=2  |  phase=Phase3
       Round 3: R = 5148 BPS  |  honest_rounds=3  |  phase=Full
       GRADUATED ✓

  ✔ 6. Voucher reclaims staked reputation after candidate graduates
       Returned 1050 BPS to voucher. Genesis R: 5950 → 7000 BPS ✓

  ✔ 7. Sybil resistance: cost grows linearly with k (Proposition 1)
       k=1   → 600 BPS cost
       k=10  → 6000 BPS cost
       k=100 → 60000 BPS cost  ← linear ✓

  ✔ 8. Misbehaviour: Phase-3 node is banned, voucher's stake is slashed
       Bad candidate: BANNED (R=0) ✓
       Voucher lost 1200 BPS (permanently slashed) ✓

  ✔ 9. Protocol summary
       Network round: 3  |  Total nodes: 4
       Genesis node:   R = 7000 BPS | Phase: Full
       Graduated node: R = 5148 BPS | Phase: Full

  10 passing (14s)
```

---

### Troubleshooting

| What you see | What to do |
|---|---|
| `anchor: command not found` | Run `export PATH="$HOME/.avm/bin:$PATH"` |
| `solana: command not found` | Run `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"` |
| `Error: Account not found` | Run `anchor build` before `anchor test` |
| Tests hang at task mining | The proof miner loops until it finds a valid nonce — should finish in under 5 seconds per task |
| `WrongPhase` error | Nodes must go through phases in order: Phase1 → Phase2 → Phase3 → Full |
| `insufficient funds` | Run `solana airdrop 2` |

---

### To make PATH changes permanent

Add these two lines to your `~/.zshrc` (or `~/.bashrc`):

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
export PATH="$HOME/.avm/bin:$PATH"
```

Then run `source ~/.zshrc` to apply immediately.
