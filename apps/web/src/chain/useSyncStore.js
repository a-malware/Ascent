/**
 * chain/useSyncStore.js
 *
 * Keeps the Zustand store in sync with the Python node backend.
 * Replaces the old Solana-based hook.
 *
 * Usage (same as before):
 *   import { useSyncStore } from "@/chain/useSyncStore";
 *   useSyncStore(); // call inside a top-level component
 */

import { useEffect, useRef } from "react";
import { useStore }  from "@/store/useStore";
import { useNode }   from "./node.jsx";
import { fetchWallet, fetchWalletHistory } from "./api";

/**
 * Reads the live nodeState from NodeContext (already polling every 6s)
 * and writes it into the Zustand store whenever it changes.
 * Also polls /wallet/balance and /wallet/history every 8s.
 */
export function useSyncStore() {
  const { nodeState, nodeId } = useNode();
  const syncFromNode   = useStore((s) => s.syncFromNode);
  const setWallet      = useStore((s) => s.setWallet);
  const setTokenBalance = useStore((s) => s.setTokenBalance);
  const setChainHistory = useStore((s) => s.setChainHistory);
  const pollRef = useRef(null);

  // Keep the displayed wallet address (node ID) in sync
  useEffect(() => {
    if (nodeId) {
      setWallet(`${nodeId.slice(0, 6)}…${nodeId.slice(-4)}`);
    }
  }, [nodeId, setWallet]);

  // Sync node state into store whenever it changes
  useEffect(() => {
    if (nodeState) {
      syncFromNode(nodeState);
    }
  }, [nodeState, syncFromNode]);

  // Poll wallet balance + history independently every 8s
  useEffect(() => {
    async function pollWallet() {
      try {
        const [balData, histData] = await Promise.all([
          fetchWallet(),
          fetchWalletHistory(),
        ]);
        setTokenBalance(balData.balance ?? 0, balData.staked ?? 0);
        setChainHistory(histData.transactions ?? []);
      } catch {
        // Backend may not be ready yet — silent fail
      }
    }

    pollWallet();
    pollRef.current = setInterval(pollWallet, 8_000);
    return () => clearInterval(pollRef.current);
  }, [setTokenBalance, setChainHistory]);
}

