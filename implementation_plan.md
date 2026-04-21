# ColdStart-PoR / Ascent — Full Implementation Plan

> **Goal:** Bring the project from its current B- state to a top-tier, defensible, A-grade final-year engineering project.
> 
> **Total estimated effort:** ~60–80 hours of focused work, spread across 4 phases.
> 
> **Non-negotiable rule:** Complete each phase fully before starting the next. Phase 2 (frontend) depends directly on the fixes in Phase 1 (protocol). Deploying a broken protocol early is worse than deploying nothing.

---

## Overview of Phases

| Phase | What | Why | Est. Hours |
|---|---|---|---|
| **Phase 1** | Smart contract protocol fixes | Closes the 3 fundamental holes in the current implementation | ~20h |
| **Phase 2** | Frontend ↔ Solana integration | Makes the demo real — the single biggest grade impact | ~20h |
| **Phase 3** | Devnet deployment + benchmarking | Makes all claims empirically backed | ~8h |
| **Phase 4** | ML misbehavior oracle (optional) | Elevates to publishable territory | ~15h |

---

## Phase 1 — Smart Contract Protocol Fixes

### Why first?
The frontend will call these instructions. If you integrate against the broken contract, you'll have to redo the frontend. Fix the contract first.

### The three fixes needed:

| Fix | Current problem | What to change |
|---|---|---|
| 1A: Merkle task | SHA256 hashcash ≠ "verifiable micro-task" | Replace with on-chain Merkle inclusion proof |
| 1B: Committee voting | Node self-reports `honest: bool` | Authority + 2 Full nodes co-sign vote outcomes |
| 1C: Committee slashing | Single authority can slash anyone unilaterally | Require 3-of-5 Full node signatures |

---

### Fix 1A: Merkle Inclusion Proof for Phase 1 Tasks

**Concept:** The network stores a Merkle root on-chain. Each Phase 1 task asks the node to prove that a specific leaf is included in that tree. The proof is verifiable deterministically on-chain in O(log N) without floating point.

**Why this is better:** It proves the node processed real data (the dataset behind the tree), not just burned CPU cycles on a hash puzzle.

#### Changes to `programs/coldstart_por/src/lib.rs`

**Step 1 — Add Merkle root to `NetworkConfig`:**

```rust
pub struct NetworkConfig {
    // ... existing fields ...
    
    /// Root of the Phase-1 task dataset Merkle tree.
    /// Tasks require the submitter to prove inclusion of
    /// leaf[task_index] in this tree.
    pub task_merkle_root: [u8; 32],
    
    /// Depth of the Merkle tree (number of proof elements required).
    /// Set at init time. For N=20 tasks: depth = ceil(log2(20)) = 5.
    pub merkle_depth: u8,
}

impl NetworkConfig {
    pub const LEN: usize = 8   // discriminator
        + 32   // authority
        + 8    // delta_bps
        + 8    // alpha_bps
        + 8    // theta_p_bps
        + 8    // tau_v_bps
        + 8    // lambda_bps
        + 1    // n_tasks
        + 1    // m_rounds
        + 8    // current_round
        + 4    // total_nodes
        + 1    // bump
        + 32   // task_merkle_root  ← NEW
        + 1    // merkle_depth      ← NEW
        + 15;  // padding (adjusted)
}
```

**Step 2 — Add a Merkle verification helper function:**

```rust
/// Verify a Merkle inclusion proof.
/// 
/// leaf_hash:   SHA256(leaf_data) for the specific task leaf
/// proof:       sibling hashes from leaf to root (bottom-up)
/// leaf_index:  position of this leaf in the tree (= task_index)
/// root:        expected Merkle root stored in NetworkConfig
fn verify_merkle_proof(
    leaf_hash: [u8; 32],
    proof: &[[u8; 32]],
    leaf_index: u8,
    root: [u8; 32],
) -> bool {
    let mut current = leaf_hash;
    let mut index = leaf_index as usize;

    for sibling in proof.iter() {
        let mut combined = [0u8; 64];
        if index % 2 == 0 {
            // current is left child
            combined[..32].copy_from_slice(&current);
            combined[32..].copy_from_slice(sibling);
        } else {
            // current is right child
            combined[..32].copy_from_slice(sibling);
            combined[32..].copy_from_slice(&current);
        }
        current = Sha256::digest(&combined).into();
        index /= 2;
    }
    current == root
}
```

**Step 3 — Replace `submit_task_proof` signature:**

Old signature: `submit_task_proof(ctx, task_index: u8, nonce: u64)`

New signature:
```rust
pub fn submit_task_proof(
    ctx: Context<SubmitTaskProof>,
    task_index: u8,
    leaf_data: [u8; 32],      // the task-specific data payload
    proof: Vec<[u8; 32]>,     // Merkle sibling hashes
) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let node = &mut ctx.accounts.node_state;
    
    // ... existing phase and order checks ...
    
    // Compute leaf hash
    let leaf_hash: [u8; 32] = Sha256::digest(&leaf_data).into();
    
    // Verify Merkle proof
    let proof_valid = cfg.task_merkle_root != [0u8; 32]  // skip if root not set
        && verify_merkle_proof(
            leaf_hash,
            &proof,
            task_index,
            cfg.task_merkle_root,
        );
    
    // ... rest of existing logic unchanged ...
}
```

**Step 4 — Update `initialize_network` to accept the Merkle root:**

```rust
pub fn initialize_network(
    ctx: Context<InitializeNetwork>,
    delta_bps: u64,
    alpha_bps: u64,
    theta_p_bps: u64,
    tau_v_bps: u64,
    lambda_bps: u64,
    n_tasks: u8,
    m_rounds: u8,
    task_merkle_root: [u8; 32],  // ← NEW
    merkle_depth: u8,             // ← NEW
) -> Result<()> {
    // ...
    cfg.task_merkle_root = task_merkle_root;
    cfg.merkle_depth = merkle_depth;
    // ...
}
```

#### Off-chain: Generate the Merkle tree

Create `apps/web/src/chain/merkle.ts`:

```typescript
import { createHash } from 'crypto'; // or use @noble/hashes in browser

export interface MerkleTree {
  root: Buffer;
  leaves: Buffer[];  // SHA256(leafData) for each task
  depth: number;
}

/** Build a complete binary Merkle tree from raw task data. */
export function buildTaskMerkleTree(taskDataset: Buffer[]): MerkleTree {
  const leaves = taskDataset.map(d => sha256(d));
  let layer = [...leaves];
  
  // Pad to power of 2
  while (layer.length & (layer.length - 1)) {
    layer.push(layer[layer.length - 1]); // duplicate last leaf
  }
  
  const depth = Math.log2(layer.length);
  let current = layer;
  while (current.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(sha256(Buffer.concat([current[i], current[i + 1]])));
    }
    current = next;
  }
  
  return { root: current[0], leaves, depth };
}

/** Get the proof path (sibling hashes) for a given leaf index. */
export function getMerkleProof(tree: MerkleTree, leafIndex: number): Buffer[] {
  // Standard Merkle proof construction — returns array of sibling hashes
  // ...implementation...
}

function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}
```

Create `scripts/generate-task-dataset.ts` at the project root:

```typescript
// Run once: npx ts-node scripts/generate-task-dataset.ts
// Generates 20 task leaves and writes the Merkle root + tree to 
// target/task-dataset.json — committed to repo

import { buildTaskMerkleTree } from '../apps/web/src/chain/merkle';

const tasks = Array.from({ length: 20 }, (_, i) => {
  // Each task leaf = a specific block header hash from Solana mainnet
  // Use real historical block hashes: this is the "real data" component
  // Fetch from: https://api.mainnet-beta.solana.com getBlock()
  return Buffer.from(`task-${i}-slot-${REAL_SLOT_HASHES[i]}`, 'utf8');
});

const tree = buildTaskMerkleTree(tasks);
console.log('Merkle root:', tree.root.toString('hex'));
// Write to target/task-dataset.json
```

> **Important:** Using real Solana block hashes as task data means nodes must retrieve a real block's data to construct the leaf. This is a genuine "relay verification" task — nodes prove they can fetch and hash block data correctly.

---

### Fix 1B: Replace Self-Reported Voting with Committee-Confirmed Outcomes

**The problem:** `cast_vote(round, honest: bool)` — node reports its own honesty.

**The fix:** Split voting into two steps:
1. `cast_vote(round)` — node records that it voted (commit to on-chain record)
2. `record_round_outcome(round, honest_voters: Vec<Pubkey>)` — called by authority AND 2 co-signing Full nodes

This means honesty is determined *after* the round by external observation, not self-declaration.

#### New instruction: `cast_vote` (simplified)

```rust
// Remove `honest: bool` parameter entirely.
// Node just records that it participated in this round.
pub fn cast_vote(ctx: Context<CastVote>, round: u64) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let node = &mut ctx.accounts.node_state;
    
    require!(
        node.phase == NodePhase::Phase3 || node.phase == NodePhase::Full,
        PoRError::WrongPhase
    );
    require!(round == cfg.current_round, PoRError::InvalidRound);
    require!(node.last_voted_round < round, PoRError::InvalidRound);
    
    node.last_voted_round = round;
    // Reputation update happens in record_round_outcome, not here
    
    emit!(VoteCast { node: node.owner, round });
    Ok(())
}
```

#### New instruction: `record_round_outcome`

```rust
#[derive(Accounts)]
pub struct RecordRoundOutcome<'info> {
    /// Network authority — must sign
    pub authority: Signer<'info>,
    
    /// A Full-phase co-signer (cosigner_1)
    pub cosigner_1: Signer<'info>,
    
    #[account(
        seeds = [b"node", cosigner_1.key().as_ref()],
        bump = cosigner_1_state.bump,
        constraint = cosigner_1_state.phase == NodePhase::Full 
            @ PoRError::VoucherNotEligible,
    )]
    pub cosigner_1_state: Account<'info, NodeState>,
    
    /// A second Full-phase co-signer (cosigner_2)  
    pub cosigner_2: Signer<'info>,
    
    #[account(
        seeds = [b"node", cosigner_2.key().as_ref()],
        bump = cosigner_2_state.bump,
        constraint = cosigner_2_state.phase == NodePhase::Full
            @ PoRError::VoucherNotEligible,
    )]
    pub cosigner_2_state: Account<'info, NodeState>,
    
    #[account(mut, seeds = [b"config"], bump = config.bump,
        has_one = authority @ PoRError::Unauthorized)]
    pub config: Account<'info, NetworkConfig>,
    
    #[account(mut, seeds = [b"node", target_node.owner.as_ref()],
        bump = target_node.bump)]
    pub target_node: Account<'info, NodeState>,
}

pub fn record_round_outcome(
    ctx: Context<RecordRoundOutcome>,
    round: u64,
    was_honest: bool,
) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let node = &mut ctx.accounts.target_node;
    
    // Ensure this is for a past round (can't record outcome for current)
    require!(round < cfg.current_round, PoRError::InvalidRound);
    // Ensure node actually voted in that round
    require!(node.last_voted_round == round, PoRError::InvalidRound);
    
    // Apply Eq. 4: R(t+1) = λ·R(t) + (1−λ)·h(t)
    let h_t: u64 = if was_honest { SCALE } else { 0 };
    node.reputation_bps = bps_mul(cfg.lambda_bps, node.reputation_bps)
        .saturating_add(bps_mul(SCALE - cfg.lambda_bps, h_t));
    
    if node.phase == NodePhase::Phase3 && was_honest {
        node.honest_rounds = node.honest_rounds.saturating_add(1);
        if node.honest_rounds >= cfg.m_rounds {
            node.phase = NodePhase::Full;
            emit!(NodeGraduated {
                node: node.owner,
                final_reputation_bps: node.reputation_bps,
            });
        }
    }
    
    emit!(RoundOutcomeRecorded {
        node: node.owner,
        round,
        was_honest,
        new_reputation_bps: node.reputation_bps,
    });
    Ok(())
}
```

Add the new event:
```rust
#[event]
pub struct RoundOutcomeRecorded {
    pub node: Pubkey,
    pub round: u64,
    pub was_honest: bool,
    pub new_reputation_bps: u64,
}
```

---

### Fix 1C: Committee-Based Slashing (Replace Authority-Only)

**The problem:** `report_misbehavior` requires only the authority's signature. One person can slash anyone.

**The fix:** Require 3 signatures: authority + 2 Full-phase nodes. Same pattern as Fix 1B.

Add a `SlashVote` account that accumulates votes:

```rust
/// Accumulates slash votes for a candidate before execution.
/// PDA seeds: ["slash_vote", candidate]
#[account]
pub struct SlashVote {
    pub candidate: Pubkey,
    pub votes: u8,           // how many have signed so far
    pub voter_1: Option<Pubkey>,
    pub voter_2: Option<Pubkey>,
    pub voter_3: Option<Pubkey>,
    pub active: bool,
    pub bump: u8,
}

impl SlashVote {
    pub const LEN: usize = 8 + 32 + 1 + 33 + 33 + 33 + 1 + 1 + 8; // +padding
    pub const REQUIRED_VOTES: u8 = 3;
}
```

Two new instructions:
- `propose_slash(ctx, candidate)` — any Full node proposes a slash, recorded in SlashVote PDA
- `execute_slash(ctx, candidate)` — callable only when `slash_vote.votes >= REQUIRED_VOTES`

```rust
pub fn propose_slash(ctx: Context<ProposeSlash>) -> Result<()> {
    let proposer = &ctx.accounts.proposer_state;
    let slash_vote = &mut ctx.accounts.slash_vote;
    
    require!(proposer.phase == NodePhase::Full, PoRError::VoucherNotEligible);
    require!(slash_vote.active, PoRError::VouchAlreadySettled);
    
    // Prevent double-voting by same proposer
    let proposer_key = ctx.accounts.proposer.key();
    require!(slash_vote.voter_1 != Some(proposer_key), PoRError::AlreadyVouched);
    require!(slash_vote.voter_2 != Some(proposer_key), PoRError::AlreadyVouched);
    require!(slash_vote.voter_3 != Some(proposer_key), PoRError::AlreadyVouched);
    
    match slash_vote.votes {
        0 => slash_vote.voter_1 = Some(proposer_key),
        1 => slash_vote.voter_2 = Some(proposer_key),
        _ => slash_vote.voter_3 = Some(proposer_key),
    }
    slash_vote.votes += 1;
    Ok(())
}

pub fn execute_slash(ctx: Context<ExecuteSlash>) -> Result<()> {
    let slash_vote = &mut ctx.accounts.slash_vote;
    require!(slash_vote.votes >= SlashVote::REQUIRED_VOTES, PoRError::Unauthorized);
    // ... existing ban + slash logic from report_misbehavior ...
}
```

---

### Phase 1 Testing

Update `tests/coldstart_por.ts` to:

1. Replace `submit_task_proof(task_index, nonce)` calls with `submit_task_proof(task_index, leaf_data, proof)` using the generated Merkle tree
2. Replace `cast_vote(round, true)` with `cast_vote(round)` + `record_round_outcome(round, cosigner1, cosigner2, true)`
3. Add tests for committee slashing: 2 votes ≠ execute, 3 votes = execute
4. Add edge-case tests (see Phase 3 testing section)

**Run:** `anchor test` — all 10 tests should still pass with updated signatures.

---

## Phase 2 — Frontend ↔ Solana Integration

### Architecture

```
apps/web/src/
├── chain/                    ← NEW: all blockchain code lives here
│   ├── program.ts            ← Anchor program singleton
│   ├── wallet-provider.tsx   ← Solana wallet adapter setup
│   ├── instructions.ts       ← one function per instruction
│   ├── accounts.ts           ← fetch/subscribe to on-chain accounts
│   ├── merkle.ts             ← Merkle tree generation (moved here)
│   └── types.ts              ← TypeScript types matching Anchor IDL
├── store/
│   └── useStore.js           ← keep as cache layer, update from chain
└── components/               ← existing components, wired to chain
```

### Step 2.1 — Install Dependencies

```bash
cd apps/web
bun add @solana/wallet-adapter-react @solana/wallet-adapter-react-ui \
        @solana/wallet-adapter-wallets @solana/wallet-adapter-base \
        @solana/web3.js @coral-xyz/anchor
```

> **Note:** `@coral-xyz/anchor` version must match your contract's Anchor version (0.32.1):
> `bun add @coral-xyz/anchor@^0.32.1`

### Step 2.2 — Create `apps/web/src/chain/wallet-provider.tsx`

```tsx
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

// Use devnet for the project — change to mainnet-beta for production
const NETWORK = 'devnet';

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

Wrap your app root in `apps/web/src/app/layout.jsx`:
```jsx
import { SolanaWalletProvider } from '@/chain/wallet-provider';

export default function Layout({ children }) {
  return (
    <SolanaWalletProvider>
      {children}
    </SolanaWalletProvider>
  );
}
```

### Step 2.3 — Create `apps/web/src/chain/program.ts`

```typescript
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import IDL from '../../../../target/idl/coldstart_por.json';  // generated by anchor build

export const PROGRAM_ID = new PublicKey('CFK9b4RXvcmJKfxodF5HNshWGfkvoQ2iAaN9eyRJnGfh');

export function getProgram(provider: AnchorProvider): Program {
  return new Program(IDL as Idl, PROGRAM_ID, provider);
}

// PDA derivation helpers — mirror the test suite helpers exactly
export function configPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config')], PROGRAM_ID
  );
}

export function nodePda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('node'), owner.toBuffer()], PROGRAM_ID
  );
}

export function vouchPda(voucher: PublicKey, candidate: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vouch'), voucher.toBuffer(), candidate.toBuffer()], PROGRAM_ID
  );
}
```

### Step 2.4 — Create `apps/web/src/chain/accounts.ts`

```typescript
import { useEffect, useState } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { getProgram, nodePda, configPda } from './program';

// Hook: fetch the connected wallet's NodeState from chain
export function useNodeState() {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [nodeState, setNodeState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wallet) { setNodeState(null); return; }
    
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = getProgram(provider);
    const [pdaAddress] = nodePda(wallet.publicKey);
    
    setLoading(true);
    program.account.nodeState.fetchNullable(pdaAddress)
      .then(state => {
        setNodeState(state);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [wallet, connection]);

  return { nodeState, loading, error };
}

// Hook: poll for on-chain updates every 5 seconds
export function useNodeStatePolled(interval = 5000) {
  const [tick, setTick] = useState(0);
  
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), interval);
    return () => clearInterval(id);
  }, [interval]);
  
  return useNodeState(); // re-runs on tick change
}
```

### Step 2.5 — Create `apps/web/src/chain/instructions.ts`

This is the core file — one function per on-chain instruction:

```typescript
import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getProgram, configPda, nodePda, vouchPda } from './program';

// ── Register Node ────────────────────────────────────────────────────────────
export async function registerNode(provider: AnchorProvider): Promise<string> {
  const program = getProgram(provider);
  const owner = provider.wallet.publicKey;
  const [config] = configPda();
  const [nodeState] = nodePda(owner);
  
  const tx = await program.methods
    .registerNode()
    .accounts({ owner, config, nodeState, systemProgram: SystemProgram.programId })
    .rpc();
  
  return tx; // transaction signature for Explorer link
}

// ── Submit Task Proof ────────────────────────────────────────────────────────
export async function submitTaskProof(
  provider: AnchorProvider,
  taskIndex: number,
  leafData: Uint8Array,  // the actual task data
  proof: Uint8Array[],   // Merkle sibling hashes
): Promise<string> {
  const program = getProgram(provider);
  const owner = provider.wallet.publicKey;
  const [config] = configPda();
  const [nodeState] = nodePda(owner);
  
  // Convert proof to the format Anchor expects: Array<number[]>
  const anchorProof = proof.map(p => Array.from(p));
  
  const tx = await program.methods
    .submitTaskProof(
      taskIndex,
      Array.from(leafData),   // [u8; 32] in Rust = number[] in TS
      anchorProof,            // Vec<[u8; 32]> in Rust = number[][] in TS
    )
    .accounts({ owner, config, nodeState })
    .rpc();
  
  return tx;
}

// ── Vouch For Node ────────────────────────────────────────────────────────────
export async function vouchForNode(
  provider: AnchorProvider,
  candidatePublicKey: PublicKey,
): Promise<string> {
  const program = getProgram(provider);
  const voucherOwner = provider.wallet.publicKey;
  const [config] = configPda();
  const [voucherState] = nodePda(voucherOwner);
  const [candidateState] = nodePda(candidatePublicKey);
  const [vouchRecord] = vouchPda(voucherOwner, candidatePublicKey);
  
  const tx = await program.methods
    .vouchForNode()
    .accounts({
      voucherOwner,
      config,
      voucherState,
      candidateState,
      vouchRecord,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  return tx;
}

// ── Cast Vote ────────────────────────────────────────────────────────────────
export async function castVote(
  provider: AnchorProvider,
  round: number,
): Promise<string> {
  const program = getProgram(provider);
  const owner = provider.wallet.publicKey;
  const [config] = configPda();
  const [nodeState] = nodePda(owner);
  
  const tx = await program.methods
    .castVote(new BN(round))
    .accounts({ owner, config, nodeState })
    .rpc();
  
  return tx;
}
```

### Step 2.6 — Wire the Zustand Store to On-Chain State

Update `apps/web/src/store/useStore.js` — add a sync function:

```javascript
// Add to the store:
syncFromChain: (nodeState) => set((state) => {
  if (!nodeState) return {};
  
  // Map on-chain phase enum to local phase number
  const phaseMap = {
    phase1: 1,
    phase2: 2,
    phase3: 3,
    full: 4,
    banned: 0,
  };
  const phaseKey = Object.keys(nodeState.phase)[0]; // Anchor returns { phase1: {} }
  
  return {
    phase: phaseMap[phaseKey] ?? 1,
    reputation: nodeState.reputationBps.toNumber() / 10_000,
    tasksCompleted: nodeState.tasksCompleted,
    isVouched: nodeState.voucher !== null,
    graduated: phaseKey === 'full',
  };
}),
```

Create a hook in `apps/web/src/chain/useSyncStore.ts`:

```typescript
import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useNodeStatePolled } from './accounts';

// Drop this hook into App.jsx — it keeps Zustand in sync with chain
export function useSyncStore() {
  const { nodeState } = useNodeStatePolled();
  const syncFromChain = useStore(s => s.syncFromChain);
  
  useEffect(() => {
    if (nodeState) syncFromChain(nodeState);
  }, [nodeState, syncFromChain]);
}
```

### Step 2.7 — Wire Components to Chain Calls

**Pattern for every button that triggers a chain action:**

```jsx
// Example: Register Node button in merit.jsx
import { useState } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { registerNode } from '@/chain/instructions';
import { toast } from 'sonner';

function RegisterButton() {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!wallet) { toast.error('Connect your wallet first'); return; }
    setLoading(true);
    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const sig = await registerNode(provider);
      toast.success('Node registered!', {
        description: (
          <a 
            href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`} 
            target="_blank"
            rel="noreferrer"
          >
            View on Explorer ↗
          </a>
        )
      });
    } catch (err) {
      toast.error('Transaction failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleRegister} disabled={loading || !wallet}>
      {loading ? 'Confirming...' : 'Register Node'}
    </button>
  );
}
```

**This exact pattern applies to every action: submit task, vouch, cast vote.**

> **Never** call the chain directly from useStore. Always call from component handlers.

### Step 2.8 — Fix the Vouch Component Inconsistency

In `apps/web/src/components/vouch.jsx`, change:
- `stakeAmount = 2.5` (SOL) → display actual reputation stake from on-chain data
- `handleVouch` → call `vouchForNode(provider, candidatePublicKey)` instead of `setTimeout`
- `ELIGIBLE_USERS` hardcoded array → fetch real Phase-2 node accounts from chain

To fetch real Phase-2 nodes:
```typescript
// In accounts.ts
export async function getPhase2Nodes(program: Program): Promise<NodeState[]> {
  const allNodes = await program.account.nodeState.all();
  return allNodes
    .filter(n => 'phase2' in n.account.phase)
    .map(n => n.account);
}
```

---

## Phase 3 — Devnet Deployment & Benchmarking

### Step 3.1 — Update Anchor.toml

```toml
[programs.devnet]
coldstart_por = "CFK9b4RXvcmJKfxodF5HNshWGfkvoQ2iAaN9eyRJnGfh"

[provider]
cluster = "Devnet"          # Change from "Localnet"
wallet = "~/.config/solana/id.json"
```

### Step 3.2 — Deploy

```bash
# 1. Ensure you're on devnet
solana config set --url devnet

# 2. Airdrop 2 SOL to your deploy wallet
solana airdrop 2

# 3. Build (generates target/idl/ and target/types/)
anchor build

# 4. Deploy
anchor deploy --provider.cluster devnet

# Copy the deployed program ID into Anchor.toml if different from localnet
# Then copy target/idl/coldstart_por.json into apps/web/src/chain/idl/
```

### Step 3.3 — Run Tests Against Devnet

```bash
anchor test --skip-local-validator --provider.cluster devnet
```

Parse the output and record in `docs/benchmarks.md`:
- Compute units per instruction (from `solana logs`)
- Transaction confirmation time (wall clock in test output)
- Account rent cost in SOL

### Step 3.4 — Create `docs/benchmarks.md`

```markdown
# ColdStart-PoR On-Chain Performance Benchmarks
Measured on Solana Devnet, 2026-04-XX

| Instruction | Compute Units | Confirm Time | Rent (SOL) |
|---|---|---|---|
| initialize_network | TBD | TBD | TBD |
| register_node | TBD | TBD | TBD |
| submit_task_proof | TBD | TBD | TBD |
| vouch_for_node | TBD | TBD | TBD |
| cast_vote | TBD | TBD | TBD |
| record_round_outcome | TBD | TBD | TBD |
| execute_slash | TBD | TBD | TBD |
```

This replaces the simulated Fig. 3 in your paper with real data.

### Step 3.5 — Run Multi-Node Simulation Script

Create `scripts/simulate-network.ts`:

```typescript
// Spins up 10 nodes on devnet, runs full lifecycle, records metrics
// Usage: npx ts-node scripts/simulate-network.ts

const NUM_NODES = 10;
// 1. Create 10 keypairs, airdrop SOL
// 2. Register all as nodes → Phase 1
// 3. Submit tasks → advance to Phase 2
// 4. Genesis node vouches for each → Phase 3
// 5. Run M honest vote rounds → all graduate
// 6. Record timing and state at each step
// 7. Output: reputation distribution across network
```

This is the "simulation confirms..." support for the paper that is currently missing.

---

## Phase 4 — ML Misbehavior Oracle (Optional but Grade-Elevating)

### Architecture

```
scripts/
└── ml-oracle/
    ├── oracle.py             ← main loop
    ├── detector.py           ← Isolation Forest model
    ├── chain_listener.py     ← subscribes to VoteCast events via WebSocket
    └── requirements.txt      ← scikit-learn, solana-py, numpy
```

### Step 4.1 — Chain Listener

```python
# chain_listener.py
from solana.rpc.websocket_api import connect
import asyncio, json

async def listen_to_votes(callback):
    async with connect("wss://api.devnet.solana.com") as ws:
        await ws.logs_subscribe(
            {"mentions": ["CFK9b4RXvcmJKfxodF5HNshWGfkvoQ2iAaN9eyRJnGfh"]},
            commitment="confirmed"
        )
        async for msg in ws:
            # Parse VoteCast events from program logs
            logs = msg.result.value.logs
            for log in logs:
                if "VoteCast" in log:
                    await callback(parse_vote_event(log))
```

### Step 4.2 — Anomaly Detector

```python
# detector.py
from sklearn.ensemble import IsolationForest
import numpy as np

class VotingAnomalyDetector:
    def __init__(self, contamination=0.05):
        # Expects ~5% of votes to be anomalous
        self.model = IsolationForest(contamination=contamination, random_state=42)
        self.vote_history = {}  # node_pubkey -> list of (round, voted_with_majority)
    
    def record_vote(self, node: str, round: int, node_reputation: float, 
                    voted_with_majority: bool):
        if node not in self.vote_history:
            self.vote_history[node] = []
        self.vote_history[node].append({
            'round': round,
            'reputation': node_reputation,
            'aligned': int(voted_with_majority),
        })
    
    def extract_features(self, node: str) -> np.ndarray:
        """
        Features per node:
        - alignment_rate: fraction of rounds voted with majority
        - reputation_delta: change in reputation over last 10 rounds
        - join_recency: how recently the node joined (Sybil rings join close together)
        - consecutive_misses: rounds where node should have voted but didn't
        """
        history = self.vote_history.get(node, [])
        if len(history) < 5:
            return None  # not enough data yet
        
        alignment_rate = np.mean([h['aligned'] for h in history[-10:]])
        rep_values = [h['reputation'] for h in history[-10:]]
        reputation_delta = rep_values[-1] - rep_values[0] if len(rep_values) > 1 else 0
        
        return np.array([alignment_rate, reputation_delta])
    
    def fit(self, all_nodes: list[str]):
        features = []
        for node in all_nodes:
            f = self.extract_features(node)
            if f is not None:
                features.append(f)
        if len(features) >= 10:
            self.model.fit(np.array(features))
    
    def is_anomalous(self, node: str) -> bool:
        f = self.extract_features(node)
        if f is None:
            return False
        score = self.model.score_samples(f.reshape(1, -1))[0]
        return score < -0.5  # threshold tuned empirically
```

### Step 4.3 — Oracle Loop

```python
# oracle.py
# After detecting anomaly: call propose_slash on-chain using solana-py
# This automates the previously manual report_misbehavior flow

import asyncio
from chain_listener import listen_to_votes
from detector import VotingAnomalyDetector

detector = VotingAnomalyDetector()

async def on_vote_event(event):
    detector.record_vote(
        node=event['node'],
        round=event['round'],
        node_reputation=event['reputation_bps'] / 10_000,
        voted_with_majority=True  # determined by comparing to majority outcome
    )
    
    # Re-fit model every 50 votes
    if sum(len(v) for v in detector.vote_history.values()) % 50 == 0:
        detector.fit(list(detector.vote_history.keys()))
    
    if detector.is_anomalous(event['node']):
        print(f"⚠️  Anomaly detected: {event['node']}")
        # Call propose_slash on-chain...

asyncio.run(listen_to_votes(on_vote_event))
```

---

## Testing & Validation Strategy

### Unit Tests (Rust — in `lib.rs`)

Anchor doesn't support inline unit tests in `lib.rs` directly, but you can add them in a `tests` module:

```rust
#[cfg(test)]
mod unit_tests {
    use super::*;
    
    #[test]
    fn test_bps_mul_identity() {
        assert_eq!(bps_mul(SCALE, SCALE), SCALE);
    }
    
    #[test]
    fn test_bps_mul_zero() {
        assert_eq!(bps_mul(0, SCALE), 0);
    }
    
    #[test]
    fn test_verify_merkle_proof_valid() {
        // ... construct a 4-leaf tree, verify leaf 0 and leaf 3 ...
    }
    
    #[test]
    fn test_verify_merkle_proof_invalid() {
        // Tampered leaf should fail verification
    }
    
    #[test]
    fn test_reputation_update_honest() {
        // R(t+1) = 0.8 * 5000 + 0.2 * 10000 = 4000 + 2000 = 6000
        let lambda = 8_000u64;
        let current_rep = 5_000u64;
        let h_t = SCALE; // honest
        let expected = bps_mul(lambda, current_rep) + bps_mul(SCALE - lambda, h_t);
        assert_eq!(expected, 6_000);
    }
}
```

Run with: `cargo test -p coldstart_por`

### Integration Tests (TypeScript — in `tests/coldstart_por.ts`)

Add these missing test cases to the existing suite:

```typescript
// Test: reputation at exactly tau_v threshold
it("Boundary: voucher at exactly tau_v can vouch, just below cannot", async () => { ... });

// Test: Phase-2 node cannot cast a vote
it("Phase guard: Phase-2 node cannot cast_vote", async () => {
  try {
    await program.methods.castVote(new BN(0)).accounts({ ... }).rpc();
    assert.fail("Should have thrown WrongPhase");
  } catch (e) {
    assert.include(e.message, "WrongPhase");
  }
});

// Test: double-voting in same round is rejected
it("Anti-replay: cannot vote twice in same round", async () => { ... });

// Test: committee slash requires exactly 3 votes
it("Committee slash: 2 votes insufficient, 3 votes execute", async () => { ... });

// Test: Merkle proof rejection — wrong leaf data
it("Merkle: invalid leaf data fails proof verification", async () => { ... });

// Test: Merkle proof rejection — correct data for wrong task index
it("Merkle: valid proof for wrong index is rejected", async () => { ... });

// Test: Phase-2 wait — node stuck in Phase 2, no voucher, no timeout
it("Phase-2 wait: node cannot self-vouch", async () => { ... });
```

### End-to-End Validation

After devnet deployment, manually validate these flows using the Ascent UI:

- [ ] New wallet connects via Phantom → already-registered or not shown correctly
- [ ] Unregistered wallet → clicks "Register Node" → transaction confirmed → UI shows Phase 1
- [ ] Phase 1 tasks submit one by one → progress updates → Phase 2 after N tasks
- [ ] A Phase-3 node can cast a vote → on-chain state updates → reputation changes
- [ ] Authority records round outcome → node's reputation updates
- [ ] Vouching: search for a real Phase-2 node's public key → vouch → VouchRecord created

---

## Deployment Plan

### Pre-deployment checklist:
- [ ] `anchor build` succeeds with zero warnings
- [ ] `anchor test` passes all tests on localnet
- [ ] `anchor test --skip-local-validator` passes all tests on devnet
- [ ] `apps/web` builds without TypeScript errors (`bun run typecheck`)
- [ ] Merkle tree JSON is committed to repo at `target/task-dataset.json`
- [ ] IDL is copied to `apps/web/src/chain/idl/coldstart_por.json`
- [ ] `.env` in `apps/web` has `VITE_SOLANA_CLUSTER=devnet`

### Devnet deployment steps:
```bash
solana config set --url devnet
solana airdrop 2
anchor build
anchor deploy
# Note the deployed program ID — update Anchor.toml and program.ts if different
anchor test --skip-local-validator
```

### Hosting the Ascent web app:
Use Vercel (free tier, zero config with React Router):
```bash
cd apps/web
npx vercel --prod
# Set env var: VITE_SOLANA_CLUSTER=devnet
```

The deployed app URL goes in the README and in the paper's evaluation section.

---

## Paper Updates Required (After Phase 3)

1. **Section V-A (Simulation Setup):** Replace "We simulate a network of |N|=200 nodes" with actual devnet results from the multi-node simulation script.

2. **Section V-B, Fig. 3:** Replace simulated PoS latency comparison with real Solana CU measurements from `docs/benchmarks.md`. Caption: "Compute units consumed per ColdStart-PoR instruction on Solana devnet, averaged over 50 executions."

3. **Section III-B (Phase 1 tasks):** Update to describe the Merkle inclusion proof mechanism instead of implying unspecified "relay verification" tasks.

4. **Section III-D (Phase 3):** Update to describe the `record_round_outcome` mechanism with committee co-signing, replacing the self-reported honesty model.

5. **Section VII (Related Work):** Add a paragraph connecting the ML oracle to MRL-PoS+ (Reference [6]), positioning your oracle as a concrete implementation of the MARL-based approach.

6. **Add Fig. 4:** Screenshot of the Ascent UI showing a real devnet transaction with a Solana Explorer link. This is the figure that proves the system is real.

---

## Optimization & Polish Suggestions

### Performance
- Use `connection.getProgramAccounts` with `dataSlice` to fetch only the fields you need from NodeState (reduces RPC response size by ~60%)
- Cache the `NetworkConfig` account in Zustand — it changes rarely, no need to re-fetch on every render
- Use `connection.onAccountChange()` for real-time updates instead of polling every 5s

### UX
- Show a persistent "Transaction pending..." indicator in the Header while any chain call is inflight
- Link every activity feed item to its Solana Explorer transaction — replace `time: "just now"` with the real `txSignature`
- Add a "Network Status" indicator (devnet latency / slot height) in the footer — proves the app is live

### Scalability (for the paper's discussion section)
- The Phase-2 queue problem: if 100 nodes are in Phase 2 simultaneously, each needs a voucher. Document a "voucher marketplace" design where Phase-2 nodes can broadcast their task score and reputation, and vouchers can discover them — this is future work but writing it up demonstrates systems thinking.

---

## Summary Task Checklist

```markdown
Phase 1 — Smart Contract Fixes
- [ ] Add MerkleRoot field to NetworkConfig
- [ ] Implement verify_merkle_proof() helper
- [ ] Update submit_task_proof() to use Merkle verification
- [ ] Update initialize_network() to accept Merkle root
- [ ] Remove honest: bool from cast_vote()
- [ ] Add record_round_outcome() with 2 co-signers
- [ ] Add SlashVote account and propose_slash() instruction
- [ ] Add execute_slash() instruction (requires 3 votes)
- [ ] Add new events (RoundOutcomeRecorded, SlashProposed)
- [ ] Update all tests to use new signatures
- [ ] Add missing edge-case tests (8 new tests)
- [ ] Add Rust unit tests for helpers
- [ ] anchor test — all tests pass

Phase 2 — Frontend Integration
- [ ] Install @solana/wallet-adapter-* and @coral-xyz/anchor
- [ ] Create chain/wallet-provider.tsx
- [ ] Create chain/program.ts with PDA helpers
- [ ] Create chain/accounts.ts with useNodeState hook
- [ ] Create chain/instructions.ts (one fn per instruction)
- [ ] Create chain/merkle.ts with Merkle tree generation
- [ ] Add syncFromChain() to useStore
- [ ] Create chain/useSyncStore.ts hook
- [ ] Wire RegisterNode button in merit.jsx
- [ ] Wire SubmitTaskProof in merit.jsx (5 task buttons)
- [ ] Wire VouchForNode in vouch.jsx
- [ ] Wire CastVote in validate.jsx
- [ ] Replace handleVouch setTimeout with real chain call
- [ ] Replace ELIGIBLE_USERS with on-chain Phase-2 query
- [ ] Fix vouch.jsx stake display (reputation BPS, not SOL)
- [ ] Add Explorer links to all activity feed items
- [ ] Add wallet connect button to header

Phase 3 — Deployment & Benchmarking
- [ ] Update Anchor.toml cluster to Devnet
- [ ] anchor deploy --provider.cluster devnet
- [ ] Copy IDL to apps/web/src/chain/idl/
- [ ] Write scripts/generate-task-dataset.ts
- [ ] Run and commit target/task-dataset.json
- [ ] Run anchor test on devnet — all tests pass
- [ ] Record CU + latency in docs/benchmarks.md
- [ ] Write scripts/simulate-network.ts (10 nodes)
- [ ] Run simulation, record output
- [ ] Deploy Ascent to Vercel with devnet config
- [ ] Update paper Sections V-A, V-B, Fig. 3, add Fig. 4

Phase 4 — ML Oracle (optional)
- [ ] Set up scripts/ml-oracle/ Python environment
- [ ] Implement chain_listener.py (WebSocket vote events)
- [ ] Implement VotingAnomalyDetector (Isolation Forest)
- [ ] Integrate oracle.py main loop
- [ ] Test oracle against devnet with simulated bad node
- [ ] Update paper Section VII with MRL-PoS+ connection
```
