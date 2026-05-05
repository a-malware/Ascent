# ColdStart-PoR ML Misbehavior Oracle

An off-chain Python service that monitors the ColdStart-PoR Solana program in
real time and automatically proposes slashing for nodes exhibiting anomalous
voting behaviour.

## Architecture

```
chain_listener.py   ← WebSocket → Solana devnet → parses Anchor events
       ↓
detector.py         ← IsolationForest on per-node feature vectors
       ↓
oracle.py           ← coordinates both; submits propose_slash when anomaly detected
```

## Setup

```bash
cd scripts/ml-oracle
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

## Running

### Dry run (safe — no on-chain transactions)
```bash
python oracle.py --dry-run
```

### Live mode (oracle wallet must be a Full-phase node)
```bash
python oracle.py --keypair ~/.config/solana/id.json
```

### Custom keypair
```bash
python oracle.py --keypair path/to/oracle-wallet.json
```

## How It Works

1. **Listens** to all logs from the ColdStart-PoR program via WebSocket.
2. **Parses** `VoteCast`, `RoundOutcomeRecorded`, `SlashProposed`, and
   `MisbehaviorReported` Anchor events.
3. **Builds** a feature vector for each node:
   - `alignment_rate` — fraction of rounds the node behaved honestly
   - `reputation_delta` — how fast reputation is rising or falling
   - `vote_miss_rate` — rounds where outcome was recorded but no VoteCast seen
   - `slash_pressure` — how many times the node has already been proposed for slash
4. **Fits** an Isolation Forest on all nodes with sufficient history (≥ 5 rounds).
5. **Flags** nodes whose anomaly score falls below the threshold (`-0.3` by default).
6. **Submits** a `propose_slash` transaction if:
   - The oracle wallet is a Full-phase node in the network
   - The same node was not proposed in the last 5 minutes (cooldown)
   - `--dry-run` is not set

## Tuning

Edit the constants at the top of `detector.py`:

| Constant              | Default | Meaning                                      |
|-----------------------|---------|----------------------------------------------|
| `MIN_SAMPLES_TO_FIT`  | 10      | Min nodes with history before model trains   |
| `MIN_HISTORY_PER_NODE`| 5       | Min round outcomes before a node is scored   |
| `ANOMALY_THRESHOLD`   | -0.3    | IsolationForest score below this → anomaly   |
| `CONTAMINATION`       | 0.05    | Expected fraction of malicious nodes (5%)    |
| `HISTORY_WINDOW`      | 20      | Only look at the last N round outcomes       |

## Prerequisites

- The oracle wallet must be registered and have graduated to `Full` phase in the
  ColdStart-PoR network (otherwise `propose_slash` will be rejected on-chain).
- The network must have at least `MIN_SAMPLES_TO_FIT` (10) nodes with voting
  history before the model will start making predictions.
- To generate test data, run `scripts/simulate-network.ts` first.
