"use client";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import { X, Lock, Gift, CheckCircle } from "lucide-react";
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

export default function ClaimModal({ onClose }) {
  const { graduated, claimedGenesis, execClaim } = useStore();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function claim() {
    if (!graduated || claimedGenesis || busy) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 1600));
    execClaim();
    setDone(true);
    toast.success("250 USDC claimed!", {
      description: "Validator Genesis Reward deposited to your wallet",
    });
    setBusy(false);
    setTimeout(onClose, 2000);
  }

  // ── LOCKED ───────────────────────────────────────────────────────────────────
  if (!graduated) {
    return (
      <Sheet title="Genesis Reward" onClose={onClose}>
        <div style={{ textAlign:"center", padding:"8px 0 8px" }}>
          {/* Lock icon */}
          <div style={{ width:80, height:80, borderRadius:"50%", background:"#F5F7FA", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
            <Lock size={36} color="#9CA3AF" />
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:"#0D1421", marginBottom:8 }}>
            Reward Locked
          </div>
          <div style={{ fontSize:13, color:"#6B7280", lineHeight:1.6, marginBottom:28 }}>
            Complete all 3 Proof-of-Reputation phases to unlock your{" "}
            <span style={{ color:"#0052FF", fontWeight:700 }}>250 USDC Validator Genesis Reward</span>.
          </div>

          {/* Phase checklist */}
          {[
            "Phase 1 — Submit 5 on-chain proofs",
            "Phase 2 — Get vouched by an existing node",
            "Phase 3 — Complete 3 governance votes",
          ].map((step, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, background:"#F9FAFB", borderRadius:12, padding:"10px 14px", textAlign:"left" }}>
              <div style={{ width:22, height:22, borderRadius:"50%", border:"2px solid #D1D5DB", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:9, fontWeight:800, color:"#9CA3AF" }}>{i + 1}</span>
              </div>
              <span style={{ fontSize:12, fontWeight:600, color:"#6B7280" }}>{step}</span>
            </div>
          ))}
        </div>
      </Sheet>
    );
  }

  // ── ALREADY CLAIMED ───────────────────────────────────────────────────────────
  if (claimedGenesis || done) {
    return (
      <Sheet title="Genesis Reward" onClose={onClose}>
        <div style={{ textAlign:"center", padding:"16px 0 8px" }}>
          <div style={{ width:80, height:80, borderRadius:"50%", background:"#ECFDF5", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
            <CheckCircle size={40} color="#05C48F" />
          </div>
          <div style={{ fontSize:20, fontWeight:800, color:"#0D1421", marginBottom:8 }}>
            Reward Claimed!
          </div>
          <div style={{ fontSize:13, color:"#6B7280" }}>
            250 USDC has been deposited to your wallet.
          </div>
        </div>
      </Sheet>
    );
  }

  // ── READY TO CLAIM ────────────────────────────────────────────────────────────
  return (
    <Sheet title="Genesis Reward" onClose={onClose}>
      <div style={{ textAlign:"center", padding:"8px 0 8px" }}>
        {/* Trophy */}
        <div style={{
          width:88, height:88, borderRadius:"50%",
          background:"linear-gradient(135deg,#05C48F,#059669)",
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 20px",
          boxShadow:"0 8px 24px rgba(5,196,143,0.35)",
        }}>
          <Gift size={40} color="white" />
        </div>

        <div style={{ fontSize:20, fontWeight:800, color:"#0D1421", marginBottom:4 }}>
          Validator Genesis Reward
        </div>
        <div style={{ fontSize:12, color:"#6B7280", marginBottom:24 }}>
          You have completed all 3 PoR phases. Claim your reward.
        </div>

        {/* Reward card */}
        <div style={{ background:"linear-gradient(135deg,#05C48F,#059669)", borderRadius:20, padding:"20px 24px", marginBottom:24, boxShadow:"0 6px 20px rgba(5,196,143,0.30)" }}>
          <div style={{ color:"rgba(255,255,255,0.8)", fontSize:11, fontWeight:600, marginBottom:6 }}>You will receive</div>
          <div style={{ color:"white", fontSize:40, fontWeight:900, letterSpacing:-1 }}>250 <span style={{ fontSize:20 }}>USDC</span></div>
          <div style={{ color:"rgba(255,255,255,0.7)", fontSize:11, marginTop:6 }}>
            Deposited instantly · No staking lock-up
          </div>
        </div>

        <button
          onClick={claim}
          disabled={busy}
          style={{
            width:"100%", padding:17,
            background: busy ? "#E5E7EB" : "linear-gradient(135deg,#05C48F,#059669)",
            borderRadius:16, border:"none",
            color: busy ? "#9CA3AF" : "white",
            fontSize:15, fontWeight:800, cursor: busy ? "default" : "pointer",
            boxShadow: busy ? "none" : "0 4px 16px rgba(5,196,143,0.35)",
          }}
        >
          {busy ? "Processing…" : "Claim 250 USDC"}
        </button>
      </div>
    </Sheet>
  );
}
