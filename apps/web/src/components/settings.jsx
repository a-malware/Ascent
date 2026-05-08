import { useState } from "react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Download,
  Lock,
  Unlock,
  Wifi,
  Users,
  Check,
  ChevronRight,
  Shield,
} from "lucide-react";

const PRIVATE_KEY_MOCK =
  "4a7b2c1e9f3d8a5b0c6e2f7a1d4b8c3e9f5a2b7c1e4d8f3a6b0c9e5f2a8b1c4d7e3f6a9b2c5e8f1a4b7c0e3f6a";
const PUBLIC_KEY_MOCK =
  "7xKq9Ab3mNpQrStUvWxYzBcDeFgHiJkLmNoPqRsTuVwXyZ12345678901234567890";

export default function Settings({ onClose }) {
  const isDarkMode = false; // Hardcoded to match web app's current theme

  // Theme colors
  const bgColor = "#E8EDF5";
  const cardBg = "#FFFFFF";
  const textPrimary = "#0D1421";
  const textSecondary = "#6B7280";
  const borderColor = "#F0F2F5";
  const accentBlue = "#0052FF";

  // Card A — Vault state
  const [keyCopied, setKeyCopied] = useState(false);
  const [nodeIdCopied, setNodeIdCopied] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);

  const handleCopyNodeId = () => {
    navigator.clipboard.writeText(PUBLIC_KEY_MOCK);
    setNodeIdCopied(true);
    setTimeout(() => setNodeIdCopied(false), 2000);
    toast.success("Node ID copied to clipboard");
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(PRIVATE_KEY_MOCK);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
    toast.success("Private Key copied to clipboard");
  };

  const handleExportKeystore = () => {
    toast.success("Export Keystore", {
      description: "Your wallet.json file has been prepared. In production, this downloads your encrypted keystore file.",
    });
  };

  // Card B — Network state
  const [rpcEndpoint, setRpcEndpoint] = useState("http://localhost:5000");
  const [rpcInput, setRpcInput] = useState("http://localhost:5000");
  const [connectionStatus, setConnectionStatus] = useState("connected"); // connected | syncing | offline
  const [peers, setPeers] = useState([
    { id: 1, address: "192.168.1.42:9000" },
    { id: 2, address: "10.0.0.8:9000" },
  ]);
  const [rpcSaved, setRpcSaved] = useState(false);

  const statusColor =
    connectionStatus === "connected"
      ? "#10B981"
      : connectionStatus === "syncing"
      ? "#F59E0B"
      : "#EF4444";

  const statusLabel =
    connectionStatus === "connected"
      ? "Connected · Fully Synced"
      : connectionStatus === "syncing"
      ? "Connected · Syncing Blocks…"
      : "Node Offline";

  const handleSaveRpc = () => {
    setRpcEndpoint(rpcInput);
    setConnectionStatus("syncing");
    setRpcSaved(true);
    setTimeout(() => {
      setConnectionStatus("connected");
      setRpcSaved(false);
      toast.success("RPC Endpoint Updated");
    }, 2500);
  };

  // Card C — Danger Zone
  const handleForceResync = () => {
    if (window.confirm("This will delete your local chain data and re-download the entire ledger from peers. This may take several minutes. Continue?")) {
      setConnectionStatus("syncing");
      toast.info("Force Re-Sync Initiated...");
      setTimeout(() => {
        setConnectionStatus("connected");
        toast.success("Re-Sync Complete");
      }, 3000);
    }
  };

  const handleUnstake = () => {
    if (window.confirm("This will broadcast an UNSTAKE transaction to the network, returning your vouching tokens to your wallet and removing you from the active validator set. This cannot be undone.")) {
      toast.success("Unstake Submitted", {
        description: "Your UNSTAKE transaction has been broadcast to the network.",
      });
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#F5F7FA",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        animation: "slideIn 0.3s ease",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid " + borderColor,
          padding: "52px 20px 16px 20px",
        }}
      >
        <button
          onClick={onClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "#F5F7FA",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            border: "none",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={20} color={textPrimary} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: "800", color: textPrimary, letterSpacing: "-0.5px" }}>
            Node Settings
          </div>
          <div style={{ fontSize: 13, color: textSecondary, marginTop: 2, fontWeight: 500 }}>
            Identity · Network · Danger Zone
          </div>
        </div>

        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: accentBlue,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#FFF", fontSize: 18, fontWeight: "800" }}>A</span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 20px 40px",
        }}
      >
        {/* ── CARD A: Identity & Cryptographic Backup ── */}
        <div
          style={{
            backgroundColor: "#0A0F1E",
            borderRadius: 24,
            padding: 24,
            marginBottom: 20,
            border: "1px solid #1E3A5F",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}
        >
          {/* Card header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: "#0052FF22",
                border: "1px solid #0052FF55",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Shield size={20} color="#60A5FA" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: "700", color: "#FFFFFF" }}>
                Identity & Backup
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                The Vault — keep this safe
              </div>
            </div>
          </div>

          {/* Node Identifier */}
          <div style={{ fontSize: 11, fontWeight: "700", color: "#60A5FA", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
            Node Identifier
          </div>
          <div style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 16, border: "1px solid #1E3A5F" }}>
            <div style={{ fontSize: 13, color: "#CBD5E1", fontFamily: "monospace", marginBottom: 12, lineHeight: 1.5, wordBreak: "break-all" }}>
              {PUBLIC_KEY_MOCK}
            </div>
            <button
              onClick={handleCopyNodeId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: nodeIdCopied ? "#10B98120" : "#1E3A5F",
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
              }}
            >
              {nodeIdCopied ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#94A3B8" />}
              <span style={{ fontSize: 12, fontWeight: "600", color: nodeIdCopied ? "#10B981" : "#94A3B8" }}>
                {nodeIdCopied ? "Copied!" : "Copy ID"}
              </span>
            </button>
          </div>

          {/* Private Key Reveal */}
          <div style={{ fontSize: 11, fontWeight: "700", color: "#60A5FA", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
            Private Key
          </div>
          <div style={{ backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 20, border: "1px solid #1E3A5F", position: "relative", overflow: "hidden" }}>
            
            <div style={{ fontSize: 13, color: "#CBD5E1", fontFamily: "monospace", lineHeight: 1.5, wordBreak: "break-all", opacity: keyRevealed ? 1 : 0, transition: "opacity 0.3s ease", userSelect: keyRevealed ? "text" : "none" }}>
              {PRIVATE_KEY_MOCK}
            </div>

            {!keyRevealed && (
              <div style={{ position: "absolute", top: 14, left: 14, right: 14, bottom: 58, backgroundColor: "#111827", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderRadius: 6, zIndex: 2 }}>
                <div style={{ fontSize: 20, letterSpacing: 4, color: "#334155" }}>
                  ████ ████ ████
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 8, fontWeight: 500 }}>
                  Click and hold to reveal
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: keyRevealed ? 12 : 54 }}>
              <button
                onMouseDown={() => setKeyRevealed(true)}
                onMouseUp={() => setKeyRevealed(false)}
                onMouseLeave={() => setKeyRevealed(false)}
                onTouchStart={() => setKeyRevealed(true)}
                onTouchEnd={() => setKeyRevealed(false)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: keyRevealed ? "#7C3AED22" : "#1E3A5F",
                  padding: "10px",
                  borderRadius: 10,
                  border: "1px solid " + (keyRevealed ? "#7C3AED" : "#334155"),
                  cursor: "pointer",
                }}
              >
                {keyRevealed ? <Unlock size={16} color="#A78BFA" /> : <Lock size={16} color="#94A3B8" />}
                <span style={{ fontSize: 13, fontWeight: "600", color: keyRevealed ? "#A78BFA" : "#94A3B8" }}>
                  {keyRevealed ? "Revealing…" : "Hold to Reveal"}
                </span>
              </button>

              {keyRevealed && (
                <button
                  onClick={handleCopyKey}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: keyCopied ? "#10B98120" : "#1E3A5F",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid " + (keyCopied ? "#10B981" : "#334155"),
                    cursor: "pointer",
                  }}
                >
                  {keyCopied ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#94A3B8" />}
                  <span style={{ fontSize: 13, fontWeight: "600", color: keyCopied ? "#10B981" : "#94A3B8" }}>
                    {keyCopied ? "Copied" : "Copy"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Export Keystore */}
          <button
            onClick={handleExportKeystore}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              backgroundColor: "#0052FF",
              borderRadius: 14,
              padding: "14px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(0,82,255,0.3)",
            }}
          >
            <Download size={18} color="#FFFFFF" />
            <span style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
              Export Keystore (wallet.json)
            </span>
          </button>
        </div>

        {/* ── CARD B: Network & RPC Configuration ── */}
        <div
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 24,
            marginBottom: 20,
            border: "1px solid " + borderColor,
            boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
          }}
        >
          {/* Card header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Wifi size={20} color={accentBlue} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: "700", color: textPrimary }}>
                Network & RPC
              </div>
              <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                Node connection configuration
              </div>
            </div>
          </div>

          {/* Live connection status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              backgroundColor: "#F8FAFC",
              borderRadius: 14,
              padding: 16,
              marginBottom: 20,
              border: "1px solid " + statusColor + "40",
            }}
          >
            <div style={{ position: "relative", width: 14, height: 14, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", backgroundColor: statusColor + "40", animation: "pulseRing 2s infinite ease-out" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: statusColor }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: "700", color: statusColor }}>
                {statusLabel}
              </div>
              <div style={{ fontSize: 12, color: textSecondary, marginTop: 3 }}>
                Endpoint: {rpcEndpoint}
              </div>
            </div>
          </div>

          {/* RPC Endpoint Input */}
          <div style={{ fontSize: 11, fontWeight: "700", color: textSecondary, letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase" }}>
            RPC Endpoint
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <input
              type="text"
              value={rpcInput}
              onChange={(e) => setRpcInput(e.target.value)}
              placeholder="http://localhost:5000"
              style={{
                flex: 1,
                backgroundColor: "#F8FAFC",
                borderRadius: 12,
                padding: "12px 14px",
                fontSize: 14,
                color: textPrimary,
                border: "1px solid " + borderColor,
                fontFamily: "monospace",
                outline: "none",
              }}
            />
            <button
              onClick={handleSaveRpc}
              style={{
                backgroundColor: rpcSaved ? "#10B981" : accentBlue,
                borderRadius: 12,
                padding: "0 16px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                border: "none",
                cursor: "pointer",
                transition: "background 0.3s ease",
              }}
            >
              {rpcSaved ? <Check size={18} color="#FFFFFF" /> : <ChevronRight size={18} color="#FFFFFF" />}
            </button>
          </div>

          {/* Peer Management */}
          <div style={{ borderTop: "1px solid " + borderColor, paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color={textSecondary} />
                <span style={{ fontSize: 14, fontWeight: "700", color: textPrimary }}>P2P Peers</span>
              </div>
              <div style={{ backgroundColor: "#EFF6FF", padding: "4px 10px", borderRadius: 20 }}>
                <span style={{ fontSize: 12, fontWeight: "700", color: accentBlue }}>{peers.length} connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD C: Danger Zone ── */}
        <div
          style={{
            backgroundColor: "#FEF2F2",
            borderRadius: 24,
            padding: 24,
            border: "1px solid #FECACA",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: "800", color: "#B91C1C", marginBottom: 6 }}>
            Danger Zone
          </div>
          <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 20, lineHeight: 1.4 }}>
            Destructive actions that will affect your node's participation in the consensus network.
          </div>

          <button
            onClick={handleForceResync}
            style={{
              width: "100%",
              backgroundColor: "#FFFFFF",
              border: "1px solid #FECACA",
              borderRadius: 12,
              padding: "14px",
              color: "#EF4444",
              fontSize: 14,
              fontWeight: "700",
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            Force Re-Sync Blockchain
          </button>
          
          <button
            onClick={handleUnstake}
            style={{
              width: "100%",
              backgroundColor: "#EF4444",
              border: "none",
              borderRadius: 12,
              padding: "14px",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
            }}
          >
            Graceful Exit (Unstake & Leave)
          </button>
        </div>
      </div>
    </div>
  );
}
