/**
 * chain/node.js
 *
 * Node identity context — replaces chain/wallet.jsx.
 *
 * Instead of a crypto wallet (Phantom), the "identity" is the Python node's
 * Ed25519 keypair managed by the backend. The frontend simply talks to
 * http://localhost:5000 (or VITE_NODE_URL) and reads the node_id.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchNodeState } from "./api";

// ── Normalise raw Python /node_state response into the store's shape ──────────
export function normalizeNodeState(raw) {
  if (!raw) return null;

  const phaseMap = {
    PHASE_1:           1,
    PHASE_2:           2,
    PHASE_3:           3,
    UNDER_OBSERVATION: 3,   // treated as Phase 3 in UI
    FULL_NODE:         4,
    BANNED:            0,
  };

  const phase = phaseMap[raw.phase] ?? 1;

  return {
    nodeId:         raw.node_id,
    publicKey:      raw.public_key,
    phase,
    phaseKey:       raw.phase,
    reputation:     raw.reputation_score ?? 0,
    tasksCompleted: raw.task_result?.tasks_completed ?? 0,
    tasksPassed:    raw.task_result?.tasks_passed ?? 0,
    honestRounds:   raw.rounds ?? 0,
    isVouched:      !!(raw.vouch && raw.vouch.length > 0),
    graduated:      raw.phase === "FULL_NODE",
    banned:         raw.phase === "BANNED",
    peersCount:     raw.peers_count ?? 0,
    chainHeight:    raw.chain_height ?? 0,
    walletBalance:  raw.wallet?.balance ?? 0,
    walletStaked:   raw.wallet?.staked ?? 0,
    eligibleToVouch:   raw.eligible_to_vouch ?? false,
    eligibleToPropose: raw.eligible_to_propose ?? false,
    eligibleToVote:    raw.eligible_to_vote ?? false,
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

const NodeContext = createContext({
  nodeId:    null,
  connected: false,
  nodeState: null,
  refresh:   async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function NodeProvider({ children }) {
  const [nodeId,    setNodeId]    = useState(null);
  const [connected, setConnected] = useState(false);
  const [nodeState, setNodeState] = useState(null);
  const [error,     setError]     = useState(null);

  const refresh = useCallback(async () => {
    try {
      const raw  = await fetchNodeState();
      const norm = normalizeNodeState(raw);
      setNodeId(norm.nodeId);
      setNodeState(norm);
      setConnected(true);
      setError(null);
    } catch (e) {
      setConnected(false);
      setError(e.message);
    }
  }, []);

  // Poll every 6 seconds
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 6_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <NodeContext.Provider value={{ nodeId, connected, nodeState, error, refresh }}>
      {children}
    </NodeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNode() {
  return useContext(NodeContext);
}

// ── NodeStatusBadge ───────────────────────────────────────────────────────────
// Drop-in replacement for the old WalletConnectButton

export function NodeStatusBadge({ style }) {
  const { nodeId, connected, error } = useNode();

  const baseStyle = {
    display:      "flex",
    alignItems:   "center",
    gap:          6,
    padding:      "8px 14px",
    borderRadius: 12,
    border:       "none",
    fontSize:     13,
    fontWeight:   700,
    ...style,
  };

  if (error) {
    return (
      <div style={{ ...baseStyle, background: "#FEF2F2", color: "#DC2626" }}>
        <span style={{ fontSize: 10 }}>●</span> Node Offline
      </div>
    );
  }

  if (!connected || !nodeId) {
    return (
      <div style={{ ...baseStyle, background: "#EEF3FF", color: "#0052FF" }}>
        <span style={{ fontSize: 12 }}>⏳</span> Connecting…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: "#0052FF",
        background: "#EEF3FF", padding: "2px 6px", borderRadius: 6,
        textTransform: "uppercase"
      }}>
        PoR Network
      </div>
      <div style={{ ...baseStyle, background: "#ECFDF5", color: "#059669" }}>
        <span style={{ fontSize: 10 }}>●</span>
        {`${nodeId.slice(0, 6)}…${nodeId.slice(-4)}`}
      </div>
    </div>
  );
}
