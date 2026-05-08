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

import { useEffect } from "react";
import { useStore }  from "@/store/useStore";
import { useNode }   from "./node.jsx";

/**
 * Reads the live nodeState from NodeContext (already polling every 6s)
 * and writes it into the Zustand store whenever it changes.
 */
export function useSyncStore() {
  const { nodeState, nodeId } = useNode();
  const syncFromNode = useStore((s) => s.syncFromNode);
  const setWallet    = useStore((s) => s.setWallet);

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
}
