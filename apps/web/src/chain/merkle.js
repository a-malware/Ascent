/**
 * chain/merkle.js
 *
 * Client-side Merkle tree builder + proof generator for Phase-1 tasks.
 * Mirrors the on-chain verify_merkle_proof() logic in lib.rs exactly.
 *
 * Uses @noble/hashes/sha256 instead of Node's `crypto` module so it works
 * natively in the browser without Vite polyfills.
 */

import { sha256 as nobleSha256 } from "@noble/hashes/sha256";

/**
 * SHA-256 of a Uint8Array — matches Sha256::digest() in Rust.
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function sha256(data) {
  return nobleSha256(data);
}

/**
 * Build a complete binary Merkle tree from an array of raw task data buffers.
 * Pads the leaf layer to the next power-of-2 by duplicating the last leaf.
 *
 * @param {Buffer[]} taskDataset - raw leaf data (e.g. 32-byte block hashes)
 * @returns {{ root: Buffer, leaves: Buffer[], layers: Buffer[][] }}
 */
export function buildTaskMerkleTree(taskDataset) {
  if (taskDataset.length === 0) throw new Error("Empty dataset");

  // Hash each raw leaf: leaf_hash = SHA256(leaf_data)
  const leaves = taskDataset.map((d) => sha256(d));

  // Pad to the next power of 2
  let layer = [...leaves];
  while (layer.length & (layer.length - 1)) {
    layer.push(layer[layer.length - 1]); // duplicate last leaf
  }

  const layers = [layer];
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      // left ‖ right  (matches the Rust: combined[..32] = current, [32..] = sibling)
      const combined = new Uint8Array(64);
      combined.set(layer[i], 0);
      combined.set(layer[i + 1], 32);
      next.push(sha256(combined));
    }
    layer = next;
    layers.push(layer);
  }

  return { root: layers[layers.length - 1][0], leaves, layers };
}

/**
 * Get the Merkle proof (sibling hashes, bottom-up) for a given leaf index.
 * Pass this array directly to the on-chain submit_task_proof instruction.
 *
 * @param {Buffer[][]} layers - output of buildTaskMerkleTree().layers
 * @param {number}     leafIndex
 * @returns {Buffer[]}
 */
export function getMerkleProof(layers, leafIndex) {
  const proof = [];
  let index = leafIndex;
  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(layer[Math.min(siblingIndex, layer.length - 1)]);
    index = Math.floor(index / 2);
  }
  return proof;
}

/**
 * Reconstruct the Merkle root from a proof (for client-side verification
 * before sending the transaction).
 * Returns true if the reconstructed root matches the expected root.
 *
 * @param {Buffer}   leafHash   - SHA256(leafData)
 * @param {Buffer[]} proof      - sibling hashes (bottom-up)
 * @param {number}   leafIndex
 * @param {Buffer}   root       - expected root
 * @returns {boolean}
 */
export function verifyMerkleProof(leafHash, proof, leafIndex, root) {
  let current = leafHash;
  let index = leafIndex;
  for (const sibling of proof) {
    const combined = new Uint8Array(64);
    if (index % 2 === 0) {
      combined.set(current, 0);
      combined.set(sibling, 32);
    } else {
      combined.set(sibling, 0);
      combined.set(current, 32);
    }
    current = sha256(combined);
    index = Math.floor(index / 2);
  }
  // Compare as Uint8Array
  return current.every((b, i) => b === root[i]);
}

// ─── Default task dataset for devnet demo ────────────────────────────────────
// These are fixed 32-byte payloads representing "Solana block hash" tasks.
// Using Uint8Array instead of Buffer for browser compatibility.
export const TASK_DATASET = Array.from({ length: 20 }, (_, i) => {
  const buf = new Uint8Array(32);
  const text = `por-task-${i.toString().padStart(3, "0")}-slot-demo`;
  const encoded = new TextEncoder().encode(text);
  buf.set(encoded.slice(0, 32));
  return buf;
});

/**
 * Build the canonical devnet task Merkle tree.
 * Store the root in NetworkConfig via initialize_network().
 */
export const TASK_TREE = buildTaskMerkleTree(TASK_DATASET);
export const TASK_MERKLE_ROOT = TASK_TREE.root; // Uint8Array, 32 bytes
export const TASK_MERKLE_DEPTH = TASK_TREE.layers.length - 1;
