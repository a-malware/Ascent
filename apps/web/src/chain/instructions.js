/**
 * chain/instructions.js
 *
 * One async function per on-chain instruction.
 * Each function:
 *   1. Derives all required PDAs
 *   2. Calls program.methods.xxx().accounts({}).rpc()
 *   3. Returns the transaction signature string
 *
 * Import pattern in components:
 *   import { registerNode, submitTaskProof } from "@/chain/instructions";
 */

import * as anchor from "@coral-xyz/anchor";
const { BN } = anchor;
import { SystemProgram } from "@solana/web3.js";
import {
  getProgram,
  configPda,
  nodePda,
  vouchPda,
  slashVotePda,
} from "./program";
import { TASK_DATASET, TASK_TREE, getMerkleProof } from "./merkle";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Convert a Buffer to a number[] (what Anchor expects for [u8; 32] / Vec<[u8;32]>). */
const bufToArr = (buf) => Array.from(buf);

// ─── 1. register_node ─────────────────────────────────────────────────────────

/**
 * Register the connected wallet as a new Phase-1 node.
 * @param {AnchorProvider} provider
 * @returns {Promise<string>} transaction signature
 */
export async function registerNode(provider) {
  const program = getProgram(provider);
  const owner   = provider.wallet.publicKey;
  const [config]    = configPda();
  const [nodeState] = nodePda(owner);

  return program.methods
    .registerNode()
    .accounts({
      owner,
      config,
      nodeState,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

// ─── 2. submit_task_proof (Fix 1A — Merkle inclusion proof) ──────────────────

/**
 * Submit a Merkle inclusion proof for a Phase-1 task.
 *
 * When the network config has a zero Merkle root (localnet / demo mode),
 * the contract accepts any submission — so we can pass the real leaf data
 * and clients will still succeed even without a real dataset.
 *
 * For devnet with a real Merkle root, we derive the proof from TASK_DATASET.
 *
 * @param {AnchorProvider} provider
 * @param {number}         taskIndex 0-based
 * @param {Buffer|null}    leafData  32 bytes; pass null to use default dataset
 * @param {Buffer[]|null}  proof     Merkle siblings; pass null to auto-derive
 * @returns {Promise<string>} transaction signature
 */
export async function submitTaskProof(provider, taskIndex, leafData = null, proof = null) {
  const program = getProgram(provider);
  const owner   = provider.wallet.publicKey;
  const [config]    = configPda();
  const [nodeState] = nodePda(owner);

  // Use the canonical dataset leaf if not provided
  const leaf = leafData ?? TASK_DATASET[taskIndex];
  // Derive the Merkle proof from the canonical tree if not provided
  const siblings = proof ?? getMerkleProof(TASK_TREE.layers, taskIndex);

  return program.methods
    .submitTaskProof(
      taskIndex,
      bufToArr(leaf),               // [u8; 32] → number[]
      siblings.map(bufToArr),       // Vec<[u8;32]> → number[][]
    )
    .accounts({ owner, config, nodeState })
    .rpc();
}

// ─── 3. vouch_for_node ───────────────────────────────────────────────────────

/**
 * Stake reputation to vouch for a Phase-2 candidate.
 * @param {AnchorProvider} provider
 * @param {PublicKey}       candidatePublicKey
 * @returns {Promise<string>}
 */
export async function vouchForNode(provider, candidatePublicKey) {
  const program      = getProgram(provider);
  const voucherOwner = provider.wallet.publicKey;
  const [config]        = configPda();
  const [voucherState]  = nodePda(voucherOwner);
  const [candidateState]= nodePda(candidatePublicKey);
  const [vouchRecord]   = vouchPda(voucherOwner, candidatePublicKey);

  return program.methods
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
}

// ─── 4. cast_vote (Fix 1B — no self-reported honesty) ────────────────────────

/**
 * Record that the node participated in the current consensus round.
 * @param {AnchorProvider} provider
 * @param {number}         round  the current_round value from NetworkConfig
 * @returns {Promise<string>}
 */
export async function castVote(provider, round) {
  const program = getProgram(provider);
  const owner   = provider.wallet.publicKey;
  const [config]    = configPda();
  const [nodeState] = nodePda(owner);

  return program.methods
    .castVote(new BN(round))
    .accounts({ owner, config, nodeState })
    .rpc();
}

// ─── 5. release_voucher_stake ─────────────────────────────────────────────────

/**
 * Voucher reclaims staked reputation after candidate graduates.
 * @param {AnchorProvider} provider
 * @param {PublicKey}       candidatePublicKey
 * @returns {Promise<string>}
 */
export async function releaseVoucherStake(provider, candidatePublicKey) {
  const program      = getProgram(provider);
  const voucherOwner = provider.wallet.publicKey;
  const [voucherState]  = nodePda(voucherOwner);
  const [candidateState]= nodePda(candidatePublicKey);
  const [vouchRecord]   = vouchPda(voucherOwner, candidatePublicKey);

  return program.methods
    .releaseVoucherStake()
    .accounts({
      voucherOwner,
      voucherState,
      candidateState,
      vouchRecord,
    })
    .rpc();
}

// ─── 6. propose_slash (Fix 1C) ────────────────────────────────────────────────

/**
 * A Full node proposes to slash a misbehaving candidate (adds 1 vote).
 * @param {AnchorProvider} provider
 * @param {PublicKey}       candidatePublicKey
 * @returns {Promise<string>}
 */
export async function proposeSlash(provider, candidatePublicKey) {
  const program  = getProgram(provider);
  const proposer = provider.wallet.publicKey;
  const [proposerState]  = nodePda(proposer);
  const [config]         = configPda();
  const [candidateState] = nodePda(candidatePublicKey);
  const [slashVote]      = slashVotePda(candidatePublicKey);

  return program.methods
    .proposeSlash()
    .accounts({
      proposer,
      proposerState,
      config,
      candidateState,
      slashVote,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

// ─── 7. execute_slash (Fix 1C) ────────────────────────────────────────────────

/**
 * Execute the slash once 3 votes have been accumulated.
 * @param {AnchorProvider} provider
 * @param {PublicKey}       candidatePublicKey
 * @param {PublicKey}       voucherPublicKey   voucher who staked on this candidate
 * @returns {Promise<string>}
 */
export async function executeSlash(provider, candidatePublicKey, voucherPublicKey) {
  const program  = getProgram(provider);
  const executor = provider.wallet.publicKey;
  const [config]         = configPda();
  const [slashVote]      = slashVotePda(candidatePublicKey);
  const [candidateState] = nodePda(candidatePublicKey);
  const [vouchRecord]    = vouchPda(voucherPublicKey, candidatePublicKey);

  return program.methods
    .executeSlash()
    .accounts({
      executor,
      config,
      slashVote,
      candidateState,
      vouchRecord,
    })
    .rpc();
}
