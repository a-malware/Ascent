"use client";
import { useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import {
  ShieldCheck,
  Star,
  Users,
  Zap,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ChevronRight,
  Cpu,
  Lock,
  AlertTriangle,
  Gavel,
} from "lucide-react";
import { useWallet } from "@/chain/wallet";
import { proposeSlash, executeSlash } from "@/chain/instructions";

// ─── Incoming nodes requesting a voucher ──────────────────────────────────────
const INCOMING_REQUESTS = [
  { wallet: "2mPx...7Rn4", tasks: 20, validity: 97, phase: 1, age: "2h ago",  stake: "2.5 SOL" },
  { wallet: "6qTy...3Fu9", tasks: 19, validity: 94, phase: 1, age: "5h ago",  stake: "2.5 SOL" },
  { wallet: "4hWz...1Kp6", tasks: 18, validity: 89, phase: 1, age: "11h ago", stake: "2.5 SOL" },
];

// ─── Optional ongoing validation quests ──────────────────────────────────────
const QUESTS = [
  { id: 1, name: "Validate 10 block headers",    reward: "+1.5% rep", difficulty: "Easy",   icon: "🧱" },
  { id: 2, name: "Co-sign 5 epoch messages",     reward: "+2% rep",   difficulty: "Medium", icon: "✍️" },
  { id: 3, name: "Run latency audit on 3 nodes", reward: "+2.5% rep", difficulty: "Medium", icon: "📡" },
  { id: 4, name: "Certify storage proof batch",  reward: "+3% rep",   difficulty: "Hard",   icon: "🗄️" },
];

// ─── Flagged nodes for slashing (mock demo data) ─────────────────────────────
const FLAGGED_NODES = [
  { wallet: "9xVq...2Lk1", reason: "Double-sign violation (Epoch #142)" },
];

export default function Validate() {
  const { reputation, setReputation, addActivity, addNotification } = useStore();

  const [vouchingFor,   setVouchingFor]   = useState(null);   // wallet string | null
  const [vouchStatus,   setVouchStatus]   = useState("idle");  // idle | pending | done
  const [vouchedList,   setVouchedList]   = useState([]);
  const [questProgress, setQuestProgress] = useState({});      // { [id]: "idle"|"running"|"done" }
  const [slashProgress, setSlashProgress] = useState({});      // { [wallet]: "idle"|"pending"|"done" }

  const { connected, getAnchorProvider } = useWallet();
  const provider = connected ? getAnchorProvider() : null;

  const repPct   = Math.round(reputation * 100);
  const repColor = reputation >= 0.7 ? "#05C48F" : reputation >= 0.4 ? "#F59E0B" : "#EF4444";

  // ── Vouch for an incoming node ───────────────────────────────────────────────
  const handleVouch = useCallback(async (node) => {
    if (vouchStatus !== "idle") return;
    setVouchingFor(node.wallet);
    setVouchStatus("pending");
    await new Promise(r => setTimeout(r, 2400));
    setVouchedList(prev => [node.wallet, ...prev]);
    setReputation(Math.min(1, reputation + 0.015));
    addActivity({
      id: Date.now(), type: "vouch",
      message: `You vouched for ${node.wallet} — 2.5 SOL escrowed`, time: "just now",
    });
    addNotification({
      id: Date.now(),
      message: `Vouch confirmed for ${node.wallet} — stake locked.`,
      read: false, time: "just now",
    });
    toast.success("Vouch confirmed!", {
      description: "2.5 SOL escrowed · Reputation +1.5%",
    });
    setVouchStatus("done");
    setTimeout(() => {
      setVouchingFor(null);
      setVouchStatus("idle");
    }, 2000);
  }, [vouchStatus, reputation, setReputation, addActivity, addNotification]);

  // ── Run a validation quest ────────────────────────────────────────────────────
  const handleQuest = useCallback(async (quest) => {
    if (questProgress[quest.id]) return;
    setQuestProgress(prev => ({ ...prev, [quest.id]: "running" }));
    const delay = quest.difficulty === "Easy" ? 1800 : quest.difficulty === "Medium" ? 2800 : 4000;
    await new Promise(r => setTimeout(r, delay));
    const gain = parseFloat(quest.reward) / 100;
    setReputation(Math.min(1, reputation + gain));
    addActivity({
      id: Date.now(), type: "task",
      message: `Quest complete: ${quest.name}`, time: "just now",
    });
    toast.success("Quest complete!", { description: quest.reward });
    setQuestProgress(prev => ({ ...prev, [quest.id]: "done" }));
  }, [questProgress, reputation, setReputation, addActivity]);

  // ── Slash a flagged node ──────────────────────────────────────────────────────
  const handleSlash = useCallback(async (node) => {
    if (slashProgress[node.wallet]) return;
    setSlashProgress(prev => ({ ...prev, [node.wallet]: "pending" }));

    if (connected && provider) {
      try {
        if (node.pubkey) {
          // If we had a real candidate pubkey, we would call:
          const sig = await proposeSlash(provider, node.pubkey);
          toast.success("Slash proposed on-chain!", { description: `tx: ${sig.slice(0, 8)}…` });
          // Note: If 3 out of 5 proposed, we would then call executeSlash().
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        console.error("Slash failed:", err);
        toast.error("Slash failed", { description: err?.message ?? "Unknown error" });
        setSlashProgress(prev => ({ ...prev, [node.wallet]: "idle" }));
        return;
      }
    } else {
      await new Promise(r => setTimeout(r, 2000));
    }

    addActivity({
      id: Date.now(), type: "task",
      message: `Voted to slash ${node.wallet} for double-signing`, time: "just now",
    });
    toast.success("Slash vote recorded!", {
      description: "Committee 3/5 threshold reached. Node penalized.",
      duration: 5000,
    });
    setSlashProgress(prev => ({ ...prev, [node.wallet]: "done" }));
  }, [slashProgress, connected, provider, addActivity]);

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
          Stake 2.5 SOL as collateral to sponsor a new node into Phase 2
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {INCOMING_REQUESTS.map((node) => {
          const alreadyVouched = vouchedList.includes(node.wallet);
          const isVouching = vouchingFor === node.wallet && vouchStatus === "pending";
          const justDone   = vouchingFor === node.wallet && vouchStatus === "done";

          return (
            <div key={node.wallet} style={{
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
                  background: `hsl(${(node.wallet.charCodeAt(0) * 9) % 360},50%,52%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: "white", fontSize: 13, fontWeight: 800 }}>{node.wallet.slice(0, 2)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1421" }}>{node.wallet}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                    {node.tasks}/20 tasks · {node.validity}% validity · {node.age}
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
                    Escrow on approval: <strong style={{ color: "#374151" }}>{node.stake}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: "#05C48F", fontWeight: 700 }}>+1.5% rep</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Ongoing Validation Quests ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1421", marginBottom: 4 }}>
          Validation Quests
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>
          Earn extra reputation by running optional network duties
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {QUESTS.map((quest) => {
          const status = questProgress[quest.id];
          const running = status === "running";
          const done    = status === "done";

          return (
            <div key={quest.id} style={{
              background: "white", borderRadius: 18, padding: "14px 16px",
              boxShadow: done
                ? "0 0 0 2px #05C48F40, 0 1px 5px rgba(0,0,0,0.04)"
                : "0 1px 5px rgba(0,0,0,0.06)",
              display: "flex", alignItems: "center", gap: 12,
              opacity: done ? 0.55 : 1,
            }}>
              {/* Icon */}
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: done ? "#ECFDF5" : "#F9FAFB",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>
                {done ? "✅" : quest.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: done ? 400 : 700,
                  color: done ? "#9CA3AF" : "#0D1421",
                  textDecoration: done ? "line-through" : "none",
                }}>
                  {quest.name}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#05C48F",
                    background: "#ECFDF5", borderRadius: 6, padding: "1px 6px",
                  }}>
                    {quest.reward}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: quest.difficulty === "Easy" ? "#059669" : quest.difficulty === "Medium" ? "#D97706" : "#DC2626",
                    background: quest.difficulty === "Easy" ? "#ECFDF5" : quest.difficulty === "Medium" ? "#FFFBEB" : "#FEF2F2",
                    borderRadius: 6, padding: "1px 6px",
                  }}>
                    {quest.difficulty}
                  </span>
                </div>
              </div>

              {done ? (
                <CheckCircle size={20} color="#05C48F" />
              ) : running ? (
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: "#EEF3FF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Cpu size={16} color="#0052FF" style={{ animation: "spin 1.2s linear infinite" }} />
                </div>
              ) : (
                <button
                  onClick={() => handleQuest(quest)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "linear-gradient(135deg,#0038E8,#0052FF)",
                    color: "white", border: "none", borderRadius: 11,
                    padding: "8px 12px", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", boxShadow: "0 3px 10px rgba(0,82,255,0.2)",
                  }}
                >
                  <Zap size={12} />
                  Run
                </button>
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
        {FLAGGED_NODES.map((node) => {
          const status = slashProgress[node.wallet];
          const pending = status === "pending";
          const done    = status === "done";

          return (
            <div key={node.wallet} style={{
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
                    {node.wallet}
                  </div>
                  <div style={{ fontSize: 11, color: done ? "#B91C1C" : "#9CA3AF", marginTop: 3 }}>
                    {node.reason}
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
