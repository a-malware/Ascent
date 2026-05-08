/**
 * chain/instructions.js
 *
 * One async function per protocol action, now backed by the Python REST API.
 * The calling signature is intentionally kept close to the old Solana version
 * so existing components need minimal changes.
 *
 * Import pattern (same as before):
 *   import { registerNode, submitTaskProof, vouchForNode } from "@/chain/instructions";
 */

import {
  fetchTasks,
  submitTasks,
  vouchForNode as apiVouch,
  fetchEligibleVouchers,
  fetchPhase2Nodes,
  fetchColdstartStatus,
  sendTokens,
  fetchVouchStatus,
  penalizeNode,
} from "./api";

// ─── 1. register_node ─────────────────────────────────────────────────────────
// In the Python backend, registration happens automatically on node startup.
// This call is a no-op in the new architecture — we just return the status.

export async function registerNode(_nodeId) {
  return fetchColdstartStatus(_nodeId);
}

// ─── 2. submit_task_proof ─────────────────────────────────────────────────────

/**
 * Fetch and auto-submit Phase-1 tasks.
 *
 * The Python backend's HASH_PREIMAGE tasks require the node to compute
 * SHA-256(challenge). We do that here in the browser.
 *
 * @param {string} nodeId
 * @returns {Promise<{ score, passed, phase }>}
 */
export async function submitTaskProof(nodeId) {
  // 1. Fetch the assigned tasks
  const { tasks } = await fetchTasks(nodeId);
  if (!tasks || tasks.length === 0) {
    throw new Error("No tasks assigned");
  }

  // 2. Solve each task client-side
  const submissions = await Promise.all(
    tasks.map(async (task) => {
      if (task.type === "HASH_PREIMAGE" || task.type === "VERIFY_HASH") {
        // Compute SHA-256 of the challenge using the Web Crypto API
        const encoder = new TextEncoder();
        const data = encoder.encode(task.challenge);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const answer = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        return { task_id: task.task_id, answer };
      }
      if (task.type === "SIGN_CHALLENGE") {
        // Use AUTO_SIGN mode — the backend will verify using the node's own key
        return { task_id: task.task_id, signature: "AUTO_SIGN", public_key: "AUTO_SIGN" };
      }
      return { task_id: task.task_id, answer: "" };
    })
  );

  // 3. Submit all at once
  return submitTasks(nodeId, submissions);
}

// ─── 3. vouch_for_node ───────────────────────────────────────────────────────

/**
 * Stake reputation to vouch for a Phase-2 candidate.
 * @param {string} targetNodeId  the candidate's node_id
 */
export async function vouchForNode(targetNodeId) {
  return apiVouch(targetNodeId);
}

// ─── 4. cast_vote ─────────────────────────────────────────────────────────────
// Voting is driven automatically by the consensus loop on the backend.
// This export is kept for UI components that show a "Vote" button.

export async function castVote(_nodeId) {
  // The Python consensus loop handles this. We just return a success stub.
  return { success: true, message: "Vote will be cast in the next consensus round." };
}

// ─── 5. release_voucher_stake ─────────────────────────────────────────────────
// Stake is released automatically when a node graduates in the Python backend.

export async function releaseVoucherStake(candidateNodeId) {
  return fetchVouchStatus(candidateNodeId);
}

// ─── 6. get_phase2_nodes ─────────────────────────────────────────────────────

export async function getPhase2Nodes() {
  return fetchPhase2Nodes();
}

// ─── 7. get_eligible_vouchers ─────────────────────────────────────────────────

export async function getEligibleVouchers() {
  return fetchEligibleVouchers();
}

// ─── 8. send_tokens ───────────────────────────────────────────────────────────

export async function sendPOR(toAddress, amount) {
  return sendTokens(toAddress, amount);
}

// ─── 9. slashing ──────────────────────────────────────────────────────────────

export async function proposeSlash(targetNodeId) {
  // In PoR L1, slashing is immediate via penalizeNode
  return penalizeNode(targetNodeId);
}

export async function executeSlash(targetNodeId) {
  return penalizeNode(targetNodeId);
}
