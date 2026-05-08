"use client";
import { useState, useCallback, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  CheckCircle,
  Clock,
  Cpu,
  Lock,
  AlertTriangle,
  Gavel,
} from "lucide-react";
import { vouchForNode, penalizeNode, fetchPhase2Nodes, fetchFlaggedNodes } from "@/chain/api";

export default function Validate() {
  const { reputation, setReputation, addActivity, addNotification } = useStore();

  const [incomingRequests, setIncomingRequests] = useState([]);
  const [flaggedNodes, setFlaggedNodes] = useState([]);

  const [vouchingFor,   setVouchingFor]   = useState(null);
  const [vouchStatus,   setVouchStatus]   = useState("idle");
  const [vouchedList,   setVouchedList]   = useState([]);
  const [slashProgress, setSlashProgress] = useState({});

  useEffect(() => {
    fetchPhase2Nodes().then(setIncomingRequests).catch(console.error);
    fetchFlaggedNodes().then(setFlaggedNodes).catch(console.error);
  }, []);


  const repPct   = Math.round(reputation * 100);
  const repColor = reputation >= 0.7 ? "#05C48F" : reputation >= 0.4 ? "#F59E0B" : "#EF4444";

  // ── Vouch for an incoming node ───────────────────────────────────────────────
  const handleVouch = useCallback(async (node) => {
    if (vouchStatus !== "idle") return;
    setVouchingFor(node.node_id);
    setVouchStatus("pending");
    try {
      await vouchForNode(node.node_id);
      setVouchedList(prev => [node.node_id, ...prev]);
      setReputation(Math.min(1, reputation + 0.015));
      addActivity({
        id: Date.now(), type: "vouch",
        message: `You vouched for ${node.node_id.slice(0, 8)}... — Stake escrowed`, time: "just now",
      });
      addNotification({
        id: Date.now(),
        message: `Vouch confirmed for ${node.node_id.slice(0, 8)}... — stake locked.`,
        read: false, time: "just now",
      });
      toast.success("Vouch confirmed!", {
        description: "Stake escrowed · Reputation +1.5%",
      });
    } catch (err) {
      console.error(err);
      toast.error("Vouch failed", { description: err.message });
    } finally {
      setVouchStatus("done");
      setTimeout(() => {
        setVouchingFor(null);
        setVouchStatus("idle");
      }, 2000);
    }
  }, [vouchStatus, reputation, setReputation, addActivity, addNotification]);


  const handleSlash = useCallback(async (node) => {
    if (slashProgress[node.node_id]) return;
    setSlashProgress(prev => ({ ...prev, [node.node_id]: "pending" }));

    try {
      await penalizeNode(node.node_id);
      toast.success("Slash recorded!", {
        description: "Node penalized via PoR network.",
        duration: 5000,
      });
      addActivity({
        id: Date.now(), type: "task",
        message: `Slashed ${node.node_id.slice(0, 8)}... for malicious activity`, time: "just now",
      });
    } catch (err) {
      console.error(err);
      toast.error("Slash failed", { description: err.message });
    }
    setSlashProgress(prev => ({ ...prev, [node.node_id]: "done" }));
  }, [slashProgress, addActivity]);

  return (
    <div style={{ padding: "20px 16px 0" }}>

      {/* ── Graduated status hero ─────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #0038E8 0%, #0052FF 60%, #1A6BFF 100%)",
        borderRadius: 24, padding: "22px 20px", marginBottom: 20,
        boxShadow: "0 8px 32px rgba(0,82,255,0.3)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -20, right: 30, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <ShieldCheck size={26} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "white", letterSpacing: -0.5 }}>
              Full Validator
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
              Onboarding complete · All 3 phases passed
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Your Rep",      value: `${repPct}%`,           bg: "rgba(255,255,255,0.14)" },
            { label: "Vouches Given", value: `${vouchedList.length}`, bg: "rgba(255,255,255,0.14)" },
            { label: "Status",        value: "Active",                bg: "rgba(5,196,143,0.25)"  },
          ].map(({ label, value, bg }) => (
            <div key={label} style={{
              flex: 1, background: bg, borderRadius: 12,
              padding: "10px 8px", textAlign: "center",
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 2, fontWeight: 600 }}>
                {label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Vouch requests ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1421", marginBottom: 4 }}>
          Vouch Requests
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>
          Stake 2.5 POR as collateral to sponsor a new node into Phase 2
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {incomingRequests.map((node) => {
          const shortId = node.node_id.slice(0, 8) + "...";
          const alreadyVouched = vouchedList.includes(node.node_id);
          const isVouching = vouchingFor === node.node_id && vouchStatus === "pending";
          const justDone   = vouchingFor === node.node_id && vouchStatus === "done";

          return (
            <div key={node.node_id} style={{
              background: "white", borderRadius: 18,
              boxShadow: alreadyVouched
                ? "0 0 0 2px #05C48F, 0 2px 8px rgba(5,196,143,0.1)"
                : "0 1px 5px rgba(0,0,0,0.06)",
              overflow: "hidden",
              opacity: alreadyVouched ? 0.6 : 1,
            }}>
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                  background: `hsl(${(node.node_id.charCodeAt(0) * 9) % 360},50%,52%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: "white", fontSize: 13, fontWeight: 800 }}>{node.node_id.slice(0, 2)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1421" }}>{shortId}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                    {node.honest_rounds || 0} honest rounds
                  </div>
                </div>
                {alreadyVouched ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#05C48F" }}>
                    <CheckCircle size={16} />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Vouched</span>
                  </div>
                ) : isVouching ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#9CA3AF" }}>
                    <Clock size={14} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Pending…</span>
                  </div>
                ) : justDone ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#05C48F" }}>
                    <CheckCircle size={16} />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Confirmed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleVouch(node)}
                    disabled={vouchStatus !== "idle"}
                    style={{
                      background: vouchStatus !== "idle" ? "#F3F4F6" : "linear-gradient(135deg,#0038E8,#0052FF)",
                      color: vouchStatus !== "idle" ? "#9CA3AF" : "white",
                      border: "none", borderRadius: 11, padding: "8px 14px",
                      fontSize: 12, fontWeight: 700, cursor: vouchStatus !== "idle" ? "not-allowed" : "pointer",
                      boxShadow: vouchStatus !== "idle" ? "none" : "0 3px 10px rgba(0,82,255,0.25)",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <Users size={12} />
                    Vouch
                  </button>
                )}
              </div>

              {/* Stake info bar */}
              {!alreadyVouched && (
                <div style={{
                  borderTop: "1px solid #F5F5F5",
                  padding: "8px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#FAFBFF",
                }}>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                    <Lock size={9} style={{ display: "inline", marginRight: 4 }} />
                    Escrow on approval: <strong style={{ color: "#374151" }}>2.5 POR</strong>
                  </span>
                  <span style={{ fontSize: 11, color: "#05C48F", fontWeight: 700 }}>+1.5% rep</span>
                </div>
              )}
            </div>
          );
        })}
      </div>


      {/* ── Network Security (Slashing) ────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1421", marginBottom: 4 }}>
          Network Security
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>
          Review Oracle flags and vote to slash malicious nodes
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {flaggedNodes.map((node) => {
          const shortId = node.node_id.slice(0, 8) + "...";
          const status = slashProgress[node.node_id];
          const pending = status === "pending";
          const done    = status === "done";

          return (
            <div key={node.node_id} style={{
              background: done ? "#FEF2F2" : "white", borderRadius: 18, padding: "14px 16px",
              boxShadow: "0 1px 5px rgba(0,0,0,0.06)",
              border: done ? "1px solid #FECACA" : "1px solid #F3F4F6",
              opacity: done ? 0.7 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  background: done ? "#FCA5A5" : "#FEF2F2",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <AlertTriangle size={22} color={done ? "white" : "#DC2626"} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: done ? "#991B1B" : "#0D1421",
                  }}>
                    {shortId}
                  </div>
                  <div style={{ fontSize: 11, color: done ? "#B91C1C" : "#9CA3AF", marginTop: 3 }}>
                    {node.phase === "BANNED" ? "Banned node" : "Flagged for misbehavior by Oracle"}
                  </div>
                </div>

                {done ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#DC2626" }}>
                    <CheckCircle size={14} />
                    <span style={{ fontSize: 11, fontWeight: 700 }}>Slashed</span>
                  </div>
                ) : pending ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#DC2626" }}>
                    <Cpu size={14} style={{ animation: "spin 1.2s linear infinite" }} />
                    <span style={{ fontSize: 11, fontWeight: 700 }}>Voting…</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSlash(node)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "linear-gradient(135deg,#DC2626,#B91C1C)",
                      color: "white", border: "none", borderRadius: 11,
                      padding: "8px 12px", fontSize: 11, fontWeight: 700,
                      cursor: "pointer", boxShadow: "0 3px 10px rgba(220,38,38,0.2)",
                    }}
                  >
                    <Gavel size={12} />
                    Slash
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
