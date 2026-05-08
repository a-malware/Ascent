/**
 * chain/api.js
 *
 * REST client for the POR-Chain Python backend.
 * Replaces all Solana/Anchor RPC calls.
 *
 * All functions return plain JS objects exactly matching
 * the shape used by the Zustand store (useStore.js).
 */

const BASE = import.meta.env.VITE_NODE_URL ?? "http://localhost:5000";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Node identity & status ────────────────────────────────────────────────────

/** Fetch this node's full state. */
export async function fetchNodeState() {
  return req("/node_state");
}

/** Fetch the global protocol config (thresholds, etc). */
export async function fetchNetworkConfig() {
  return req("/config");
}

/** Fetch all known peers. */
export async function fetchPeers() {
  return req("/peers");
}

// ── Phase 1: Tasks ───────────────────────────────────────────────────────────

/** Get (or create) Phase-1 tasks for this node. */
export async function fetchTasks(nodeId) {
  return req(`/task/list${nodeId ? `?node_id=${nodeId}` : ""}`);
}

/**
 * Submit Phase-1 task answers.
 * @param {string} nodeId
 * @param {Array<{task_id: string, answer?: string, signature?: string, public_key?: string}>} submissions
 */
export async function submitTasks(nodeId, submissions) {
  return req("/task/submit", {
    method: "POST",
    body: JSON.stringify({ node_id: nodeId, submissions }),
  });
}

/** Get ColdStart lifecycle status for a node. */
export async function fetchColdstartStatus(nodeId) {
  return req(`/coldstart/status${nodeId ? `?node_id=${nodeId}` : ""}`);
}

// ── Phase 2: Vouching ─────────────────────────────────────────────────────────

/** Vouch for a target node (this node becomes the voucher). */
export async function vouchForNode(targetId) {
  return req("/vouch", {
    method: "POST",
    body: JSON.stringify({ target_id: targetId }),
  });
}

/** Get vouch status for a node. */
export async function fetchVouchStatus(nodeId) {
  return req(`/vouch/status${nodeId ? `?node_id=${nodeId}` : ""}`);
}

/** Get list of eligible vouchers. */
export async function fetchEligibleVouchers() {
  return req("/vouch/eligible_vouchers");
}

/** Get all Phase-2 nodes (candidates waiting to be vouched). */
export async function fetchPhase2Nodes() {
  const data = await req("/node/registry");
  return Object.entries(data.nodes ?? {})
    .filter(([, info]) => info.phase === "PHASE_2")
    .map(([node_id, info]) => ({ node_id, ...info }));
}

/** Get all nodes flagged for misbehavior (UNDER_OBSERVATION or BANNED). */
export async function fetchFlaggedNodes() {
  const data = await req("/node/registry");
  return Object.entries(data.nodes ?? {})
    .filter(([, info]) => ["UNDER_OBSERVATION", "BANNED"].includes(info.phase))
    .map(([node_id, info]) => ({ node_id, ...info }));
}
/**
 * Mark a node as malicious and slash its voucher's stake.
 * Only allowed if this node is a FULL_NODE.
 */
export async function penalizeNode(targetId) {
  return req("/coldstart/penalize", {
    method: "POST",
    body: JSON.stringify({ node_id: targetId }),
  });
}

// ── Phase 3: Voting ───────────────────────────────────────────────────────────

/** Cast a vote in the current consensus round. */
export async function castVote() {
  // Voting is driven by the consensus loop automatically.
  // This endpoint is a manual trigger for UI demos.
  return req("/simulate/vote", { method: "POST", body: JSON.stringify({}) });
}

// ── Chain & Audit ─────────────────────────────────────────────────────────────

/** Fetch the full blockchain. */
export async function fetchChain() {
  return req("/chain");
}

/** Fetch recent audit log events. */
export async function fetchAuditLog() {
  return req("/audit/events");
}

// ── Wallet ────────────────────────────────────────────────────────────────────

/** Get this node's wallet balance. */
export async function fetchWallet() {
  return req("/wallet/balance");
}

/**
 * Send POR tokens to another address.
 * @param {string} to  recipient node_id / address
 * @param {number} amount
 */
export async function sendTokens(to, amount) {
  return req("/wallet/send", {
    method: "POST",
    body: JSON.stringify({ to, amount }),
  });
}
