"use client";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import { X, Zap } from "lucide-react";
import { toast } from "sonner";

const DEMO_ADDRESSES = [
  { label: "8xYz...4Cd7", full: "8xYz4Cd7" },
  { label: "3aRt...7Mn2", full: "3aRt7Mn2" },
  { label: "9pLk...1Wx8", full: "9pLk1Wx8" },
];

function Sheet({ title, onClose, children }) {
  return (
    <div style={{ position:"absolute", inset:0, zIndex:60, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(13,20,33,0.52)", backdropFilter:"blur(3px)" }} />
      <div style={{ position:"relative", background:"white", borderRadius:"28px 28px 0 0", padding:"0 20px 44px", zIndex:1, animation:"sheetUp 0.28s cubic-bezier(0.32,0.72,0,1) both" }}>
        <div style={{ display:"flex", justifyContent:"center", paddingTop:12, marginBottom:2 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"#E5E7EB" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0 20px" }}>
          <span style={{ fontSize:18, fontWeight:800, color:"#0D1421" }}>{title}</span>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:"#F5F7FA", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <X size={16} color="#6B7280" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SendModal({ onClose }) {
  const { tokens, graduated, execSend } = useStore();

  const [toAddr,   setToAddr]   = useState("");
  const [tokenSym, setTokenSym] = useState("SOL");
  const [amount,   setAmount]   = useState("");
  const [busy,     setBusy]     = useState(false);

  const token = tokens.find(t => t.symbol === tokenSym);
  const fromAmt = parseFloat(amount) || 0;
  const usdValue = fromAmt * (token?.price ?? 1);
  const insufficient = fromAmt > (token?.balance ?? 0);
  const canSend = fromAmt > 0 && toAddr.trim().length >= 4 && !insufficient;
  const feeWaived = graduated; // Zero-gas only after full graduation

  async function confirm() {
    if (!canSend) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 1300));
    execSend(tokenSym, fromAmt, toAddr.trim());
    toast.success("Transaction sent!", {
      description: feeWaived
        ? `${fromAmt} ${tokenSym} sent · Network fee waived`
        : `${fromAmt} ${tokenSym} sent · Fee: $0.02`,
    });
    setBusy(false);
    onClose();
  }

  return (
    <Sheet title="Send" onClose={onClose}>

      {/* ── To address ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#9CA3AF", fontWeight:600, marginBottom:8 }}>Recipient</div>
        <input
          type="text"
          placeholder="Wallet address or .sol domain"
          value={toAddr}
          onChange={e => setToAddr(e.target.value)}
          style={{
            width:"100%", padding:"14px 16px", borderRadius:14,
            border:"1.5px solid", borderColor: toAddr.length > 3 ? "#0052FF" : "#E5E7EB",
            fontSize:13, color:"#0D1421", outline:"none", background:"#F9FAFB",
            boxSizing:"border-box", fontFamily:"monospace",
          }}
        />
        {/* Quick addresses */}
        <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
          {DEMO_ADDRESSES.map(a => (
            <button
              key={a.label}
              onClick={() => setToAddr(a.full)}
              style={{
                background: toAddr === a.full ? "#EEF3FF" : "#F5F7FA",
                border: toAddr === a.full ? "1px solid #0052FF" : "1px solid transparent",
                borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:600,
                color: toAddr === a.full ? "#0052FF" : "#6B7280", cursor:"pointer",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Token + Amount ───────────────────────────────────────────────────── */}
      <div style={{ background:"#F9FAFB", borderRadius:16, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#9CA3AF", fontWeight:600, marginBottom:8 }}>Amount</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Token selector */}
          <select
            value={tokenSym}
            onChange={e => { setTokenSym(e.target.value); setAmount(""); }}
            style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"6px 10px", fontWeight:700, fontSize:13, color:"#0D1421", cursor:"pointer" }}
          >
            {tokens.filter(t => t.balance > 0).map(t => (
              <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{
              flex:1, background:"none", border:"none", outline:"none",
              fontSize:22, fontWeight:800, color: insufficient ? "#EF4444" : "#0D1421",
              textAlign:"right",
            }}
          />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:"#9CA3AF" }}>
          <span>≈ ${usdValue.toFixed(2)} USD</span>
          <span>
            Balance: {token?.balance.toFixed(tokenSym === "SOL" ? 2 : 0)} {tokenSym}
            <button
              onClick={() => setAmount(String(token?.balance ?? 0))}
              style={{ marginLeft:6, color:"#0052FF", background:"none", border:"none", cursor:"pointer", fontSize:11, fontWeight:700 }}
            >MAX</button>
          </span>
        </div>
      </div>

      {/* ── Network fee row ──────────────────────────────────────────────────── */}
      <div style={{
        background: feeWaived ? "#ECFDF5" : "#F9FAFB",
        border: feeWaived ? "1px solid #A7F3D0" : "1px solid #F0F2F5",
        borderRadius:14, padding:"12px 14px", marginBottom:16,
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Zap size={14} color={feeWaived ? "#05C48F" : "#9CA3AF"} fill={feeWaived ? "#05C48F" : "none"} />
          <span style={{ fontSize:12, fontWeight:600, color: feeWaived ? "#059669" : "#6B7280" }}>
            {feeWaived ? "Fee waived — High Reputation Node" : "Network fee"}
          </span>
        </div>
        <div style={{ textAlign:"right" }}>
          {feeWaived ? (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:12, color:"#9CA3AF", textDecoration:"line-through" }}>$0.02</span>
              <span style={{ fontSize:12, fontWeight:800, color:"#05C48F" }}>FREE</span>
            </div>
          ) : (
            <span style={{ fontSize:12, fontWeight:700, color:"#0D1421" }}>$0.02</span>
          )}
        </div>
      </div>

      {/* ── Confirm ──────────────────────────────────────────────────────────── */}
      <button
        onClick={confirm}
        disabled={!canSend || busy}
        style={{
          width:"100%", padding:16,
          background: canSend && !busy ? "linear-gradient(135deg,#0038E8,#0052FF)" : "#E5E7EB",
          borderRadius:16, border:"none",
          color: canSend && !busy ? "white" : "#9CA3AF",
          fontSize:15, fontWeight:700, cursor: canSend ? "pointer" : "default",
        }}
      >
        {busy ? "Sending…" : insufficient ? "Insufficient Balance" : "Send"}
      </button>
    </Sheet>
  );
}
