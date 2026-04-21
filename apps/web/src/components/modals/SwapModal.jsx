"use client";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import { ArrowLeftRight, Zap, X } from "lucide-react";
import { toast } from "sonner";

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

export default function SwapModal({ onClose }) {
  const { tokens, meritBoost, graduated, execSwap } = useStore();

  const [fromSym, setFromSym] = useState("SOL");
  const [toSym,   setToSym]   = useState("USDC");
  const [amount,  setAmount]  = useState("");
  const [busy,    setBusy]    = useState(false);

  const fromToken = tokens.find(t => t.symbol === fromSym);
  const toToken   = tokens.find(t => t.symbol === toSym);

  const fromAmt     = parseFloat(amount) || 0;
  const baseRate    = (fromToken && toToken) ? fromToken.price / toToken.price : 0;
  const standardOut = fromAmt * baseRate * 0.97;   // 3 % DEX fee
  const boostedOut  = fromAmt * baseRate * meritBoost; // merit boost replaces fee + bonus
  const bonusAmt    = boostedOut - standardOut;

  const insufficientFunds = fromAmt > (fromToken?.balance ?? 0);
  const canSwap = fromAmt > 0 && !insufficientFunds;

  function flip() {
    setFromSym(toSym);
    setToSym(fromSym);
    setAmount("");
  }

  async function confirm() {
    if (!canSwap) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 1400));
    execSwap(fromSym, toSym, fromAmt, parseFloat(boostedOut.toFixed(6)));
    toast.success("Swap complete!", {
      description: graduated
        ? `+${bonusAmt.toFixed(2)} ${toSym} Merit Bonus`
        : `${boostedOut.toFixed(4)} ${toSym} received`,
    });
    setBusy(false);
    onClose();
  }

  return (
    <Sheet title="Swap" onClose={onClose}>

      {/* ── From ─────────────────────────────────────────────────────────────── */}
      <div style={{ background:"#F9FAFB", borderRadius:16, padding:"14px 16px", marginBottom:8 }}>
        <div style={{ fontSize:11, color:"#9CA3AF", fontWeight:600, marginBottom:8 }}>From</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ background:"white", borderRadius:10, padding:"6px 10px", fontWeight:700, fontSize:14, color:"#0D1421", flexShrink:0 }}>
            {fromSym}
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{
              flex:1, background:"none", border:"none", outline:"none",
              fontSize:22, fontWeight:800, color: insufficientFunds ? "#EF4444" : "#0D1421",
              textAlign:"right",
            }}
          />
        </div>
        <div style={{ fontSize:11, color:"#9CA3AF", marginTop:6, textAlign:"right" }}>
          Balance: {fromToken?.balance.toFixed(fromSym === "SOL" ? 2 : 0)} {fromSym}
          {fromAmt > 0 && (
            <button
              onClick={() => setAmount(String(fromToken?.balance ?? 0))}
              style={{ marginLeft:6, color:"#0052FF", background:"none", border:"none", cursor:"pointer", fontSize:11, fontWeight:700 }}
            >
              MAX
            </button>
          )}
        </div>
      </div>

      {/* ── Flip button ───────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"center", margin:"2px 0" }}>
        <button onClick={flip} style={{ background:"#EEF3FF", border:"none", borderRadius:10, padding:"8px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
          <ArrowLeftRight size={15} color="#0052FF" />
          <span style={{ fontSize:11, fontWeight:700, color:"#0052FF" }}>Flip</span>
        </button>
      </div>

      {/* ── To ───────────────────────────────────────────────────────────────── */}
      <div style={{ background:"#F9FAFB", borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ fontSize:11, color:"#9CA3AF", fontWeight:600, marginBottom:8 }}>You receive</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ background:"white", borderRadius:10, padding:"6px 10px", fontWeight:700, fontSize:14, color:"#0D1421" }}>
            {toSym}
          </div>
          <div style={{ textAlign:"right" }}>
            {fromAmt > 0 && (
              <div style={{ fontSize:11, color:"#9CA3AF", textDecoration:"line-through", marginBottom:2 }}>
                {standardOut.toFixed(4)} {toSym} (standard)
              </div>
            )}
            <div style={{ fontSize:22, fontWeight:800, color: fromAmt > 0 ? "#0052FF" : "#9CA3AF" }}>
              {fromAmt > 0 ? boostedOut.toFixed(4) : "—"} {toSym}
            </div>
          </div>
        </div>
      </div>

      {/* ── Merit boost badge ─────────────────────────────────────────────────── */}
      {fromAmt > 0 && (
        <div style={{
          background: graduated ? "#ECFDF5" : "#F9FAFB",
          border: graduated ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
          borderRadius:14, padding:"12px 14px",
          display:"flex", alignItems:"center", gap:10, marginBottom:16,
        }}>
          <Zap size={16} color={graduated ? "#05C48F" : "#9CA3AF"} fill={graduated ? "#05C48F" : "none"} />
          <div>
            <div style={{ fontSize:12, fontWeight:700, color: graduated ? "#059669" : "#6B7280" }}>
              {graduated
                ? `Merit Boost ${meritBoost.toFixed(2)}x — saving you ${bonusAmt.toFixed(2)} ${toSym}`
                : `Complete PoR to unlock Merit Boost (currently ${meritBoost.toFixed(2)}x)`
              }
            </div>
            {graduated && (
              <div style={{ fontSize:11, color:"#6B7280", marginTop:2 }}>
                DEX fee waived · Priority routing enabled
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm ──────────────────────────────────────────────────────────── */}
      <button
        onClick={confirm}
        disabled={!canSwap || busy}
        style={{
          width:"100%", padding:16,
          background: canSwap && !busy
            ? "linear-gradient(135deg,#0038E8,#0052FF)"
            : "#E5E7EB",
          borderRadius:16, border:"none",
          color: canSwap && !busy ? "white" : "#9CA3AF",
          fontSize:15, fontWeight:700, cursor: canSwap ? "pointer" : "default",
        }}
      >
        {busy ? "Swapping…" : insufficientFunds ? "Insufficient Balance" : "Confirm Swap"}
      </button>
    </Sheet>
  );
}
