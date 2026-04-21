/**
 * chain/wallet.jsx
 *
 * Lightweight Phantom wallet context — no heavy adapter packages required.
 * Wraps window.solana (Phantom's injected provider) in React context so any
 * component can call `useWallet()` to get the connected public key and a
 * helper to build an AnchorProvider.
 *
 * Falls back gracefully when Phantom is not installed.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getProvider } from "./program";

// ─── Context ─────────────────────────────────────────────────────────────────

const WalletContext = createContext({
  publicKey:   null,   // PublicKey | null
  connected:   false,
  connecting:  false,
  phantom:     null,   // window.solana | null
  connect:     async () => {},
  disconnect:  async () => {},
  isDevnet:    false,
  getAnchorProvider: () => null,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }) {
  const [phantom,    setPhantom]    = useState(null);
  const [publicKey,  setPublicKey]  = useState(null);
  const [connected,  setConnected]  = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isDevnet,   setIsDevnet]   = useState(false);

  // Detect Phantom on mount (may not be injected in SSR / non-browser env)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sol = window?.solana;
    if (sol?.isPhantom) {
      setPhantom(sol);
      // Auto-connect if user previously approved
      if (sol.isConnected && sol.publicKey) {
        setPublicKey(sol.publicKey);
        setConnected(true);
      }
      // Listen for account changes
      sol.on("accountChanged", (newKey) => {
        if (newKey) {
          setPublicKey(newKey);
          setConnected(true);
        } else {
          setPublicKey(null);
          setConnected(false);
        }
      });
      sol.on("disconnect", () => {
        setPublicKey(null);
        setConnected(false);
      });
      // Check network cluster
      const checkNetwork = async () => {
        try {
          // We can check if the current provider is connected to devnet
          // by inspecting the connection or asking the wallet (if supported)
          // For Phantom, we'll check if we can reach the Devnet program
          setIsDevnet(true); // Default to true if connected, will fail on IX call if wrong
        } catch (e) {}
      };
      checkNetwork();
    }
  }, []);

  const connect = useCallback(async () => {
    if (!phantom) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    try {
      setConnecting(true);
      const resp = await phantom.connect();
      setPublicKey(resp.publicKey);
      setConnected(true);
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setConnecting(false);
    }
  }, [phantom]);

  const disconnect = useCallback(async () => {
    if (!phantom) return;
    try {
      await phantom.disconnect();
    } finally {
      setPublicKey(null);
      setConnected(false);
    }
  }, [phantom]);

  /** Build an AnchorProvider from the injected Phantom wallet. */
  const getAnchorProvider = useCallback(() => {
    if (!phantom || !connected) return null;
    return getProvider(phantom);
  }, [phantom, connected]);

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        connected,
        connecting,
        phantom,
        isDevnet,
        connect,
        disconnect,
        getAnchorProvider,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  return useContext(WalletContext);
}

// ─── WalletConnectButton ──────────────────────────────────────────────────────

export function WalletConnectButton({ style }) {
  const { publicKey, connected, connecting, connect, disconnect } = useWallet();

  const abbrev = (pk) => {
    const s = pk.toBase58();
    return `${s.slice(0, 4)}…${s.slice(-4)}`;
  };

  const baseStyle = {
    display:        "flex",
    alignItems:     "center",
    gap:            6,
    padding:        "8px 14px",
    borderRadius:   12,
    border:         "none",
    cursor:         "pointer",
    fontSize:       13,
    fontWeight:     700,
    transition:     "all 0.2s",
    ...style,
  };

  if (connecting) {
    return (
      <button style={{ ...baseStyle, background: "#EEF3FF", color: "#0052FF" }} disabled>
        <span style={{ fontSize: 12 }}>⏳</span> Connecting…
      </button>
    );
  }

  if (connected && publicKey) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: "#0052FF",
          background: "#EEF3FF", padding: "2px 6px", borderRadius: 6,
          textTransform: "uppercase"
        }}>
          Devnet
        </div>
        <button
          onClick={disconnect}
          style={{ ...baseStyle, background: "#ECFDF5", color: "#059669" }}
          title="Click to disconnect"
        >
          <span style={{ fontSize: 10 }}>●</span>
          {abbrev(publicKey)}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      style={{
        ...baseStyle,
        background: "linear-gradient(135deg,#0038E8,#0052FF)",
        color:      "white",
        boxShadow:  "0 3px 10px rgba(0,82,255,0.3)",
      }}
    >
      <span style={{ fontSize: 14 }}>◎</span> Connect Wallet
    </button>
  );
}
