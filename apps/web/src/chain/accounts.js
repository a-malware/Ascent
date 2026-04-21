/**
 * chain/accounts.js
 *
 * React hooks for fetching and subscribing to on-chain accounts.
 */

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { getProgram, configPda, nodePda, connection } from "./program";

const SCALE = 10_000;

// ─── Phase enum helpers ───────────────────────────────────────────────────────

/**
 * Convert an Anchor-deserialized phase object like { phase1: {} } to a number.
 * Matches the NodePhase enum in lib.rs.
 */
export function phaseToNumber(phaseObj) {
  if (!phaseObj) return 0;
  const key = Object.keys(phaseObj)[0];
  return { phase1: 1, phase2: 2, phase3: 3, full: 4, banned: 0 }[key] ?? 0;
}

/**
 * Convert a number back to a human-readable phase label.
 */
export function phaseLabel(n) {
  return ["Banned", "Phase 1", "Phase 2", "Phase 3", "Full"][n] ?? "Unknown";
}

// ─── useNodeState ─────────────────────────────────────────────────────────────

/**
 * Fetch the NodeState for the currently-connected wallet.
 *
 * @param {AnchorProvider|null} provider
 * @returns {{ nodeState, loading, error, refetch }}
 */
export function useNodeState(provider) {
  const [nodeState, setNodeState] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!provider) { setNodeState(null); return; }

    const program = getProgram(provider);
    const owner   = provider.wallet.publicKey;
    const [pda]   = nodePda(owner);

    setLoading(true);
    setError(null);
    try {
      const state = await program.account.nodeState.fetchNullable(pda);
      setNodeState(state);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => { fetch(); }, [fetch]);

  return { nodeState, loading, error, refetch: fetch };
}

// ─── useNetworkConfig ─────────────────────────────────────────────────────────

/**
 * Fetch the global NetworkConfig account.
 * Cached — re-fetches only when provider changes.
 *
 * @param {AnchorProvider|null} provider
 * @returns {{ config, loading, error, refetch }}
 */
export function useNetworkConfig(provider) {
  const [config,  setConfig]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    if (!provider) return;
    const program = getProgram(provider);
    const [pda]   = configPda();
    setLoading(true);
    try {
      const cfg = await program.account.networkConfig.fetchNullable(pda);
      setConfig(cfg);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => { fetch(); }, [fetch]);

  return { config, loading, error, refetch: fetch };
}

// ─── useNodeStatePolled ───────────────────────────────────────────────────────

/**
 * Same as useNodeState but polls every `intervalMs` milliseconds.
 * Useful for pages that need live updates (reputation, phase, etc.)
 *
 * @param {AnchorProvider|null} provider
 * @param {number}              intervalMs (default 6 000)
 */
export function useNodeStatePolled(provider, intervalMs = 6_000) {
  const { nodeState, loading, error, refetch } = useNodeState(provider);

  useEffect(() => {
    const id = setInterval(refetch, intervalMs);
    return () => clearInterval(id);
  }, [refetch, intervalMs]);

  return { nodeState, loading, error, refetch };
}

// ─── getPhase2Nodes ───────────────────────────────────────────────────────────

/**
 * Fetch all Phase-2 nodes visible on-chain (for the vouch browser).
 * Returns an array of { owner: PublicKey, reputationBps: BN, ... }
 *
 * NOTE: getProgramAccounts is expensive — call sparingly, not in render loops.
 *
 * @param {AnchorProvider} provider
 * @returns {Promise<Array>}
 */
export async function getPhase2Nodes(provider) {
  const program  = getProgram(provider);
  const allNodes = await program.account.nodeState.all();
  return allNodes
    .filter((n) => "phase2" in n.account.phase)
    .map((n) => ({
      pubkey:         n.publicKey,
      owner:          n.account.owner,
      reputationBps:  n.account.reputationBps.toNumber(),
      tasksCompleted: n.account.tasksCompleted,
      tasksPassed:    n.account.tasksPassed,
    }));
}

// ─── normalizeNodeState ───────────────────────────────────────────────────────

/**
 * Convert raw Anchor-deserialized NodeState into the shape used by useStore.
 * Returns null if state is null (node not registered).
 *
 * @param {object|null} rawState
 * @returns {object|null}
 */
export function normalizeNodeState(rawState) {
  if (!rawState) return null;
  const phaseKey = Object.keys(rawState.phase)[0];
  return {
    phase:          phaseToNumber(rawState.phase),
    phaseKey,
    reputation:     rawState.reputationBps.toNumber() / SCALE,
    reputationBps:  rawState.reputationBps.toNumber(),
    tasksCompleted: rawState.tasksCompleted,
    tasksPassed:    rawState.tasksPassed,
    honestRounds:   rawState.honestRounds,
    isVouched:      rawState.voucher !== null,
    voucher:        rawState.voucher ?? null,
    graduated:      phaseKey === "full",
    banned:         phaseKey === "banned",
  };
}
