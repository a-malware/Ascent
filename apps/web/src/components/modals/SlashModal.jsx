"use client";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import { X, AlertTriangle, ShieldOff, Zap } from "lucide-react";
import { toast } from "sonner";

export default function SlashModal({ onClose }) {
  const { reputation, meritBoost, slashed, execSlash } = useStore();
  const [step, setStep]   = useState("warn"); // 'warn' | 'confirm' | 'done'
  const [busy, setBusy]   = useState(false);

  const repPercent     = Math.round(reputation * 100);
  const newRep         = Math.max(0, reputation * 0.6);
  const newRepPercent  = Math.round(newRep * 100);
  const newBoost       = parseFloat(Math.max(1.0, 1.0 + (newRep - 0.1) * 0.5).toFixed(2));

  async function executeSlash() {
    setBusy(true);
    await new Promise(r => setTimeout(r, 1800));
    execSlash();
    setStep("done");
    toast.error("⚠️ Node slashed!", {
      description: `Reputation dropped from ${repPercent}% → ${newRepPercent}%`,
    });
    setBusy(false);
  }

  return (
    <div style={{ position:"absolute", inset:0, zIndex:60, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      <style>{`
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes redPulse{0%,100%{background:rgba(239,68,68,0.08)}50%{background:rgba(239,68,68,0.16)}}
      `}</style>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(13,20,33,0.60)", backdropFilter:"blur(3px)" }} />

      <div style={{
        position:"relative", background:"white", borderRadius:"28px 28px 0 0",
        padding:"0 20px 44px", zIndex:1,
        animation:"sheetUp 0.28s cubic-bezier(0.32,0.72,0,1) both",
        borderTop:"3px solid #EF4444",
      }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", paddingTop:12, marginBottom:2 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"#FCA5A5" }} />
        </div>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <ShieldOff size={20} color="#EF4444" />
            <span style={{ fontSize:18, fontWeight:800, color:"#0D1421" }}>Slash Simulator</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:9, fontWeight:800, letterSpacing:1, color:"#9CA3AF", background:"#F5F7FA", borderRadius:6, padding:"3px 7px" }}>DEMO ONLY</span>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:"#F5F7FA", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <X size={16} color="#6B7280" />
            </button>
          </div>
        </div>

        {/* ── ALREADY SLASHED ─────────────────────────────────────────────── */}
        {slashed && step !== "done" ? (
          <div style={{ textAlign:"center", padding:"8px 0 8px" }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"#FEF2F2", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <ShieldOff size={32} color="#EF4444" />
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:"#0D1421", marginBottom:8 }}>Node Already Slashed</div>
            <div style={{ fontSize:12, color:"#6B7280", lineHeight:1.6, marginBottom:20 }}>
              This node was penalised for a double-sign violation.
              Reset the demo (long-press the Ascent logo) to restore reputation.
            </div>
            <StatRow label="Current reputation" value={`${repPercent}%`} color="#EF4444" />
            <StatRow label="Merit Boost"        value={`${meritBoost.toFixed(2)}x`} color="#F59E0B" />
          </div>
        ) : step === "done" ? (
          /* ── POST-SLASH SUMMARY ─────────────────────────────────────────── */
          <div style={{ textAlign:"center", padding:"8px 0 8px" }}>
            <div style={{ width:88, height:88, borderRadius:"50%", background:"#FEF2F2", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", animation:"redPulse 1.6s ease-in-out infinite" }}>
              <AlertTriangle size={42} color="#EF4444" />
            </div>
            <div style={{ fontSize:18, fontWeight:800, color:"#0D1421", marginBottom:4 }}>Node Slashed!</div>
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:20 }}>Double-sign violation detected and confirmed by 2/3 of validators.</div>
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:16, padding:"16px", marginBottom:20 }}>
              <StatRow label="Reputation" value={`${repPercent}% → ${newRepPercent}%`} color="#EF4444" />
              <StatRow label="Merit Boost" value={`${meritBoost.toFixed(2)}x → ${newBoost.toFixed(2)}x`} color="#F59E0B" />
              <StatRow label="Penalty" value="−40% reputation" color="#EF4444" />
            </div>
            <button onClick={onClose} style={{ width:"100%", padding:15, background:"#F5F7FA", borderRadius:14, border:"none", cursor:"pointer", fontSize:14, fontWeight:700, color:"#6B7280" }}>
              Close
            </button>
          </div>
        ) : step === "confirm" ? (
          /* ── CONFIRM STEP ───────────────────────────────────────────────── */
          <div>
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:16, padding:"16px 16px", marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#991B1B", marginBottom:12 }}>Simulating: Double-Sign Attack</div>
              <StatRow label="Current reputation" value={`${repPercent}%`} color="#0D1421" />
              <StatRow label="After slashing"     value={`${newRepPercent}% (−40%)`} color="#EF4444" />
              <StatRow label="Boost impact"        value={`${meritBoost.toFixed(2)}x → ${newBoost.toFixed(2)}x`} color="#F59E0B" />
            </div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:16, lineHeight:1.6 }}>
              This simulates what happens when a validator signs two conflicting messages in the same epoch. The PoR network detects and penalises the node automatically.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <button onClick={() => setStep("warn")} style={{ padding:14, background:"#F5F7FA", borderRadius:14, border:"none", cursor:"pointer", fontSize:14, fontWeight:700, color:"#6B7280" }}>
                Cancel
              </button>
              <button
                onClick={executeSlash}
                disabled={busy}
                style={{
                  padding:14,
                  background: busy ? "#E5E7EB" : "linear-gradient(135deg,#DC2626,#EF4444)",
                  borderRadius:14, border:"none", cursor: busy ? "default" : "pointer",
                  fontSize:14, fontWeight:800, color: busy ? "#9CA3AF" : "white",
                  boxShadow: busy ? "none" : "0 4px 14px rgba(239,68,68,0.40)",
                }}
              >
                {busy ? "Slashing…" : "Proceed"}
              </button>
            </div>
          </div>
        ) : (
          /* ── WARNING STEP ───────────────────────────────────────────────── */
          <div>
            <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:16, padding:"16px", marginBottom:16, display:"flex", gap:12 }}>
              <AlertTriangle size={20} color="#D97706" style={{ flexShrink:0, marginTop:2 }} />
              <div style={{ fontSize:12, color:"#92400E", lineHeight:1.7 }}>
                <b>Double-Sign Simulation:</b> You are about to simulate broadcasting a conflicting epoch message — a slashable offence on Ascent PoR. The network will detect this and penalise your node.
              </div>
            </div>

            {/* What gets slashed */}
            <div style={{ background:"#F9FAFB", borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
              <div style={{ fontSize:11, color:"#9CA3AF", fontWeight:600, marginBottom:10 }}>IMPACT PREVIEW</div>
              <StatRow label="Reputation" value={`${repPercent}% → ~${newRepPercent}%`} color="#EF4444" />
              <StatRow label="Merit Boost" value={`${meritBoost.toFixed(2)}x → ~${newBoost.toFixed(2)}x`} color="#F59E0B" />
              <StatRow label="Swap bonus lost" value="Reduced yield" color="#F59E0B" />
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
              <Zap size={13} color="#9CA3AF" />
              <span style={{ fontSize:11, color:"#9CA3AF" }}>Reputation recovery requires re-completing governance rounds.</span>
            </div>

            <button
              onClick={() => setStep("confirm")}
              style={{
                width:"100%", padding:15,
                background:"linear-gradient(135deg,#DC2626,#EF4444)",
                borderRadius:16, border:"none", cursor:"pointer",
                fontSize:14, fontWeight:800, color:"white",
                boxShadow:"0 4px 14px rgba(239,68,68,0.35)",
              }}
            >
              Simulate Malicious Attack →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
      <span style={{ fontSize:12, color:"#6B7280", fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:800, color: color || "#0D1421" }}>{value}</span>
    </div>
  );
}
