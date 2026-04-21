/**
 * chain/useSyncStore.js
 *
 * Drop this hook in a top-level component (e.g. app/layout.jsx or page.jsx)
 * to continuously sync on-chain NodeState → Zustand store.
 *
 * Usage:
 *   import { useSyncStore } from "@/chain/useSyncStore";
 *   // Inside your root component:
 *   useSyncStore();
 */

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useWallet } from "./wallet";
import { useNodeStatePolled } from "./accounts";
import { normalizeNodeState } from "./accounts";

/**
 * Keeps Zustand store in sync with the current wallet's on-chain NodeState.
 * Polls every 8 seconds. Does nothing when the wallet is disconnected.
 */
export function useSyncStore() {
  const { getAnchorProvider, publicKey, connected } = useWallet();
  const provider = connected ? getAnchorProvider() : null;

  const { nodeState } = useNodeStatePolled(provider, 8_000);
  const syncFromChain = useStore((s) => s.syncFromChain);
  const setWallet     = useStore((s) => s.setWallet);

  // Keep the displayed wallet address in sync
  useEffect(() => {
    if (publicKey) {
      const addr = publicKey.toBase58();
      setWallet(`${addr.slice(0, 4)}…${addr.slice(-4)}`);
    }
  }, [publicKey, setWallet]);

  // Sync on-chain node state → store whenever it changes
  useEffect(() => {
    const normalized = normalizeNodeState(nodeState);
    if (normalized) {
      syncFromChain(normalized);
    }
  }, [nodeState, syncFromChain]);
}
