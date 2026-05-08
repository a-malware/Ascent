"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import {
  CheckCircle,
  Clock,
  Shield,
  Loader,
  Award,
  Cpu,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useWallet }     from "@/chain/wallet";
import { registerNode, submitTaskProof, vouchForNode, castVote } from "@/chain/instructions";
import { useNetworkConfig, useNodeState } from "@/chain/accounts";

// ─── Phase 1: Task definitions (5 tasks for demo) ──────────────────────────────
const TASKS = [
  { id: 1, name: "Verify node signature",        category: "Verification" },
  { id: 2, name: "Complete identity attestation", category: "Identity"     },
  { id: 3, name: "Submit network proof",          category: "Network"      },
  { id: 4, name: "Validate transaction batch",    category: "Validation"   },
  { id: 5, name: "Sign consensus message",        category: "Consensus"    },
];

// ─── Phase 1: Pre-computed "valid" proofs (all start with 000) ─────────────────
const TASK_PROOFS = [
  "000a3f7b2c9e1d4f8a2b5c6e7f0d1342af8bc92e",
  "000b8c4a1f6e3d9c2b7a5f0e4d8c1a235e9f7b2d",
  "0003f9e2a7b4c1d8f5e6a3b2c9d0e7f4182c6d3a",
  "000c7d8e4b3a2f9e1c5d6b7a8f3e2c1d0b9a8f7e",
  "000d4a1b8c7e2f5d9b3a6c8e7f0d4b2a5c9e1f7d",
];

// ─── Phase 2: Established vouchers ─────────────────────────────────────────────
const VOUCHERS = [
  { wallet: "8xYz...4Cd7", reputation: 0.92, vouches: 12, age: "6 mo" },
  { wallet: "3aRt...7Mn2", reputation: 0.87, vouches: 8,  age: "8 mo" },
  { wallet: "9pLk...1Wx8", reputation: 0.84, vouches: 5,  age: "1 yr" },
  { wallet: "4bQs...6Tz5", reputation: 0.81, vouches: 15, age: "3 mo" },
  { wallet: "7eVm...2Gh9", reputation: 0.79, vouches: 3,  age: "2 mo" },
];

// ─── Phase 3: Governance proposals (3 for demo) ───────────────────────────────
const VOTE_PROPOSALS = [
  { question: "Accept node 5gYo...0Cq6 into Phase 2?",          context: "5/5 tasks done · validity rate 97% · no slashing history." },
  { question: "Slash node 0aJk...9Pz2 for double-sign violation?", context: "Evidence: two conflicting epoch messages at slot #4,821,033." },
  { question: "Increase stake minimum from 2 POR → 2.5 POR?",   context: "Protects against low-cost Sybil identities. 74% of validators support." },
];

// ──────────────────────────────────────────────────────────────────────────────

export default function Merit() {
  const {
    phase,
    tasksCompleted,
    setTasksCompleted,
    setPhase,
    setReputation,
    reputation,
    addActivity,
    setGraduated,
    setActiveTab,
    addNotification,
  } = useStore();

  // ── Wallet / chain ────────────────────────────────────────────────────────────
  const { connected, getAnchorProvider } = useWallet();

  // Always get a fresh provider at call-time to avoid stale closures
  const freshProvider = () => (connected ? getAnchorProvider() : null);
  const provider = freshProvider();

  const { config } = useNetworkConfig(provider);
  const currentRound = config?.currentRound?.toNumber() ?? 0;

  // Check on-chain registration status
  const { nodeState, refetch: refetchNodeState } = useNodeState(provider);
  const [registering, setRegistering] = useState(false);
  const isRegistered = nodeState !== null;

  // Auto-register when wallet connects and no node account exists yet
  useEffect(() => {
    if (!connected || registering) return;
    const timer = setTimeout(async () => {
      const p = connected ? getAnchorProvider() : null;
      if (!p) return;
      setRegistering(true);
      try {
        toast.loading("Registering node on-chain…", { id: "reg" });
        await registerNode(p);
        toast.success("Node registered!", {
          id: "reg",
          description: "You are now a Phase 1 node — start your first proof!",
        });
        refetchNodeState();
      } catch (err) {
        const code = err?.error?.errorCode?.code ?? "";
        if (code === "AlreadyInitialized" || code === "0x0") {
          // Already registered — just refresh state
          toast.dismiss("reg");
          refetchNodeState();
        } else {
          console.error("registerNode:", err);
          toast.error("Registration failed", {
            id: "reg",
            description: err?.message ?? code,
          });
        }
      } finally {
        setRegistering(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // ── Phase 1 state ────────────────────────────────────────────────────────────
  const [taskStatuses, setTaskStatuses] = useState(() => {
    const init = {};
    TASKS.forEach((t, i) => {
      init[t.id] = i < tasksCompleted ? "verified" : "pending";
    });
    return init;
  });

  // Hash puzzle solver state
  const [hashSolver, setHashSolver] = useState({
    taskId: null, nonce: 0, attempts: 0,
    currentHash: "", hashRate: 0, found: false,
  });
  const hashIntervalRef = useRef(null);
  const reputationRef   = useRef(reputation);
  reputationRef.current = reputation;

  // ── Phase 2 state ────────────────────────────────────────────────────────────
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [voucherStatus,   setVoucherStatus]   = useState("idle");

  // ── Phase 3 state ────────────────────────────────────────────────────────────
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [voting,          setVoting]          = useState(false);
  const [currentProposal, setCurrentProposal] = useState(0); // index into VOTE_PROPOSALS
  const [voteChoice,      setVoteChoice]      = useState(null); // "yes" | "no" | null

  const verifiedCount = Object.values(taskStatuses).filter(s => s === "verified").length;
  const progressPct   = Math.round((verifiedCount / 5) * 100);

  // ── Complete a task (called after hash puzzle resolves OR after on-chain confirm) ──
  const completeTask = useCallback((taskId) => {
    setTaskStatuses(prev => {
      const next  = { ...prev, [taskId]: "verified" };
      const count = Object.values(next).filter(s => s === "verified").length;
      setTasksCompleted(count);
      setReputation(Math.min(1, reputationRef.current + 0.08));
      addActivity({
        id: Date.now(), type: "task",
        message: `Task #${taskId} — proof verified`, time: "just now",
      });
      if (count >= 5) {
        toast.success("🎉 Phase 1 complete!", {
          description: `All 5 tasks done · Find a voucher to advance`,
          duration: 4000,
        });
        setTimeout(() => setPhase(2), 700);
      } else {
        toast.success("Proof accepted on-chain!", {
          description: `${count}/5 tasks · Reputation +8%`,
        });
      }
      return next;
    });
  }, [setTasksCompleted, setPhase, setReputation, addActivity]);

  // ── Start hash puzzle (demo animation) then optionally confirm on-chain ───────
  const handleStartProof = useCallback((taskId) => {
    if (hashSolver.taskId !== null) return;
    clearInterval(hashIntervalRef.current);

    const startNonce = 1000 + Math.floor(Math.random() * 8000);
    let displayNonce = startNonce;

    setHashSolver({
      taskId, nonce: startNonce, attempts: 0,
      currentHash: "", hashRate: 0, found: false,
    });

    const animStart = Date.now();
    hashIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - animStart) / 1000;
      displayNonce += 13 + Math.floor(Math.random() * 6);
      const fakeHash = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
      ).join("");

      setHashSolver(prev => ({
        ...prev,
        nonce:       displayNonce,
        attempts:    Math.round(elapsed * 1247),
        currentHash: fakeHash,
        hashRate:    Math.round(1200 + (Math.random() - 0.5) * 200),
      }));
    }, 60);

    // "Solve" the puzzle after 1.8–2.8 s
    const solveDelay = 1800 + Math.floor(Math.random() * 1000);
    setTimeout(() => {
      clearInterval(hashIntervalRef.current);
      const proofHash = TASK_PROOFS[taskId - 1];
      const elapsed   = (Date.now() - animStart) / 1000;

      setHashSolver(prev => ({
        ...prev,
        found:       true,
        currentHash: proofHash,
        nonce:       displayNonce,
        attempts:    Math.round(elapsed * 1247),
        hashRate:    1247,
      }));

      // Auto-submit — on-chain if wallet+node ready, else demo mode
      setTimeout(async () => {
        setHashSolver({ taskId: null, nonce: 0, attempts: 0, currentHash: "", hashRate: 0, found: false });

        const p = connected ? getAnchorProvider() : null;
        if (p && isRegistered) {
          try {
            const sig = await submitTaskProof(p, taskId - 1);
            toast.success("Proof confirmed on-chain!", {
              description: `tx: ${sig.slice(0, 8)}…`,
            });
            refetchNodeState();
            completeTask(taskId);
          } catch (err) {
            console.error("submitTaskProof failed:", err);
            const code = err?.error?.errorCode?.code ?? err?.message ?? "Unknown error";
            toast.error("On-chain submission failed", { description: String(code) });
            // Do NOT silently complete — show the real error
          }
        } else if (p && !isRegistered) {
          toast.error("Node not registered yet", {
            description: "Please wait a moment and try again.",
          });
        } else {
          // No wallet — pure demo mode
          completeTask(taskId);
        }
      }, 1400);
    }, solveDelay);
  }, [hashSolver.taskId, completeTask, connected, isRegistered]);


  // ── Phase 2: request vouch (on-chain if wallet connected and registered) ──────
  const handleRequestVouch = useCallback(async (v) => {
    setVoucherStatus("pending");

    const p = connected ? getAnchorProvider() : null;
    if (p && isRegistered) {
      try {
        if (v.pubkey) {
          const sig = await vouchForNode(p, v.pubkey);
          toast.success("Vouch confirmed on-chain!", {
            description: `tx: ${sig.slice(0, 8)}…`,
          });
        } else {
          await new Promise(r => setTimeout(r, 2200));
        }
      } catch (err) {
        console.error("vouchForNode failed:", err);
        toast.error("Vouch failed", { description: err?.message ?? "Unknown" });
        setVoucherStatus("idle");
        return;
      }
    } else {
      await new Promise(r => setTimeout(r, 2200));
    }

    setVoucherStatus("accepted");
    setReputation(Math.min(1, reputation + 0.1));
    addActivity({
      id: Date.now(), type: "vouch",
      message: `Vouch accepted from ${v.wallet}`, time: "just now",
    });
    toast.success("Vouch accepted!", { description: "Advancing to Voting Rounds." });
    setTimeout(() => setPhase(3), 1500);
  }, [reputation, setReputation, setPhase, addActivity, connected, isRegistered]);

  // ── Phase 3: submit vote (on-chain if wallet connected and registered) ─────────
  const handleVote = useCallback(async (choice) => {
    if (!choice || voting) return;
    setVoting(true);

    const p = connected ? getAnchorProvider() : null;
    if (p && isRegistered) {
      try {
        const sig = await castVote(p, currentRound);
        toast.success(`Vote cast on-chain!`, {
          description: `Round ${currentRound} · tx: ${sig.slice(0, 8)}…`,
        });
      } catch (err) {
        const code = err?.error?.errorCode?.code;
        if (code !== "InvalidRound") {
          console.error("castVote failed:", err);
          toast.error("Vote failed", { description: code ?? err?.message });
          setVoting(false);
          return;
        }
      }
    } else {
      await new Promise(r => setTimeout(r, 1600));
    }

    const next = roundsCompleted + 1;
    setRoundsCompleted(next);
    setCurrentProposal(p => Math.min(p + 1, VOTE_PROPOSALS.length - 1));
    setVoteChoice(null);
    setReputation(Math.min(1, reputation + 0.05));
    addActivity({
      id: Date.now(), type: "reputation",
      message: `Round ${next} — voted ${choice === "yes" ? "For" : "Against"} honestly`,
      time: "just now",
    });
    toast.success(`Round ${next}/3 complete!`, { description: "Reputation +5%" });
    if (next >= 3) {
      setTimeout(() => {
        setGraduated(true);
        addNotification({
          id: Date.now(),
          message: "🎓 Merit Mode complete — you are now a full Validator!",
          read: false,
          time: "just now",
        });
        addActivity({
          id: Date.now() + 1, type: "phase",
          message: "Graduated to full network participation", time: "just now",
        });
        toast.success("🎓 Fully graduated!", {
          description: "Merit tab → Validate. You can now vouch for new nodes.",
          duration: 5000,
        });
        setActiveTab("validate");
      }, 800);
    }
    setVoting(false);
  }, [roundsCompleted, reputation, voting, setReputation, addActivity, setGraduated,
      addNotification, setActiveTab, connected, isRegistered, currentRound]);


  // ── Stepper ──────────────────────────────────────────────────────────────────
  const Stepper = (
    <div style={{ background: "white", borderRadius: 20, padding: "20px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {[
          { n: 1, label: "Quick Tasks" },
          { n: 2, label: "Get a Helper" },
          { n: 3, label: "Voting Rounds" },
        ].map(({ n, label }, i) => (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: phase > n ? "#05C48F" : phase === n ? "#0052FF" : "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: phase === n ? "0 4px 12px rgba(0,82,255,0.3)" : "none",
              }}>
                {phase > n ? (
                  <CheckCircle size={20} color="white" />
                ) : (
                  <span style={{ fontSize: 15, fontWeight: 800, color: phase === n ? "white" : "#C4C9D4" }}>{n}</span>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: phase === n ? "#0052FF" : phase > n ? "#05C48F" : "#C4C9D4" }}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div style={{ height: 2, width: 52, background: phase > n ? "#05C48F" : "#F3F4F6", margin: "0 6px", marginBottom: 20 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 1 — Hash Puzzle Micro-tasks
  // ────────────────────────────────────────────────────────────────────────────
  if (phase === 1)
    return (
      <div style={{ padding: "20px 16px 0" }}>
        {/* Puzzle animation keyframes */}
        <style>{`
          @keyframes hash-flicker {
            0%,100% { opacity: 1; }
            50%      { opacity: 0.6; }
          }
          @keyframes scan-line {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          .hash-char { animation: hash-flicker 0.12s linear infinite; }
        `}</style>

        {Stepper}

        {/* Progress card */}
        <div style={{ background: "white", borderRadius: 20, padding: "18px 16px", marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1421" }}>Probationary Tasks</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>Find a valid SHA-256 proof for each task</div>
            </div>
            <div style={{ background: "#EEF3FF", borderRadius: 12, padding: "6px 12px" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#0052FF" }}>
                {verifiedCount}<span style={{ fontWeight: 500, fontSize: 12 }}>/20</span>
              </span>
            </div>
          </div>
          <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg,#0038E8,#0052FF,#4D8BFF)",
              borderRadius: 3, width: `${progressPct}%`, transition: "width 0.5s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "#9CA3AF" }}>
              Target prefix: <span style={{ fontFamily: "monospace", color: "#05C48F", fontWeight: 700 }}>000…</span>
              &nbsp;·&nbsp;Difficulty: 12-bit
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{progressPct}% complete</div>
          </div>
        </div>

        {/* Task list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TASKS.map((task) => {
            const done    = taskStatuses[task.id] === "verified";
            const solving = hashSolver.taskId === task.id;

            // ── Expanded hash solver card ──────────────────────────────────────
            if (solving) return (
              <div key={task.id} style={{
                background: "white", borderRadius: 16, overflow: "hidden",
                boxShadow: hashSolver.found
                  ? "0 0 0 2px #05C48F, 0 6px 24px rgba(5,196,143,0.18)"
                  : "0 0 0 2px #0052FF30, 0 4px 16px rgba(0,82,255,0.14)",
                transition: "box-shadow 0.3s ease",
              }}>
                {/* Task header row */}
                <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "#EEF3FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Cpu size={15} color="#0052FF" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1421" }}>{task.name}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>{task.category}</div>
                  </div>
                  <div style={{
                    background: hashSolver.found ? "#ECFDF5" : "#EEF3FF",
                    borderRadius: 8, padding: "4px 10px",
                    transition: "background 0.3s",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: hashSolver.found ? "#05C48F" : "#0052FF" }}>
                      {hashSolver.found ? "✓ Found" : "Solving…"}
                    </span>
                  </div>
                </div>

                {/* Dark terminal panel */}
                <div style={{ background: "#0A0E1A", margin: "0 10px 10px", borderRadius: 12, padding: "14px 14px 10px" }}>
                  {/* Current hash */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "#374151", fontFamily: "monospace", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {hashSolver.found ? "✓ Valid Hash Found" : "Checking hash…"}
                    </div>
                    <div style={{
                      fontSize: 11.5, fontFamily: "monospace", wordBreak: "break-all",
                      lineHeight: 1.5, position: "relative", overflow: "hidden",
                    }}>
                      {hashSolver.found ? (
                        <>
                          <span style={{ color: "#05C48F", fontWeight: 800 }}>000</span>
                          <span style={{ color: "#6EE7B7" }}>{hashSolver.currentHash.slice(3, 10)}</span>
                          <span style={{ color: "#374151" }}>{hashSolver.currentHash.slice(10)}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: "#6B7280" }}>{hashSolver.currentHash.slice(0, 6)}</span>
                          <span style={{ color: "#4B5563" }}>{hashSolver.currentHash.slice(6)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Target line */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "#374151", fontFamily: "monospace", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Target prefix
                    </div>
                    <div style={{ fontSize: 11.5, fontFamily: "monospace", color: "#374151" }}>
                      <span style={{ color: "#F59E0B", fontWeight: 800 }}>000</span>
                      {"x".repeat(37)}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 16, borderTop: "1px solid #1E2433", paddingTop: 10 }}>
                    {[
                      { label: "NONCE",    value: hashSolver.nonce.toLocaleString()    },
                      { label: "ATTEMPTS", value: hashSolver.attempts.toLocaleString() },
                      { label: "H/s",      value: hashSolver.hashRate > 0 ? hashSolver.hashRate.toLocaleString() : "…" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: 8, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, fontFamily: "monospace", color: "#E5E7EB", fontWeight: 700 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* "Found" confirmation bar */}
                  {hashSolver.found && (
                    <div style={{ marginTop: 10, background: "#052612", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle size={13} color="#05C48F" />
                      <span style={{ fontSize: 12, color: "#05C48F", fontWeight: 700 }}>
                        Valid proof — broadcasting to network…
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );

            // ── Normal task card ───────────────────────────────────────────────
            return (
              <div key={task.id} style={{
                background: "white", borderRadius: 16, padding: "14px 14px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex", alignItems: "center", gap: 12,
                opacity: done ? 0.55 : 1,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: done ? "#ECFDF5" : "#F9FAFB",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {done ? (
                    <CheckCircle size={18} color="#05C48F" />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#D1D5DB" }}>#{task.id}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: done ? 400 : 600,
                    color: done ? "#9CA3AF" : "#0D1421",
                    textDecoration: done ? "line-through" : "none",
                  }}>
                    {task.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#D1D5DB", marginTop: 1 }}>{task.category}</div>
                </div>
                {done ? (
                  <span style={{ fontSize: 12, color: "#05C48F", fontWeight: 700 }}>Done</span>
                ) : (
                  <button
                    onClick={() => handleStartProof(task.id)}
                    disabled={hashSolver.taskId !== null}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: hashSolver.taskId !== null ? "#F3F4F6" : "linear-gradient(135deg,#0038E8,#0052FF)",
                      color: hashSolver.taskId !== null ? "#9CA3AF" : "white",
                      border: "none", borderRadius: 10, padding: "7px 12px",
                      fontSize: 12, fontWeight: 700,
                      cursor: hashSolver.taskId !== null ? "not-allowed" : "pointer",
                      boxShadow: hashSolver.taskId !== null ? "none" : "0 3px 10px rgba(0,82,255,0.25)",
                    }}
                  >
                    <Cpu size={12} />
                    <span>Start Proof</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ height: 20 }} />
      </div>
    );

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 2 — Stake-backed Vouching
  // ────────────────────────────────────────────────────────────────────────────
  if (phase === 2)
    return (
      <div style={{ padding: "20px 16px 0" }}>
        {Stepper}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1421" }}>Get a Helper</div>
          <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>A trusted node stakes POR as collateral on your behalf</div>
        </div>

        {voucherStatus === "accepted" ? (
          <div style={{ background: "#ECFDF5", border: "2px solid #05C48F", borderRadius: 20, padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1421", marginBottom: 6 }}>Helper Accepted!</div>
            <div style={{ fontSize: 13, color: "#6B7280" }}>Advancing to Voting Rounds…</div>
          </div>
        ) : voucherStatus === "pending" ? (
          <div style={{ background: "white", borderRadius: 20, padding: "36px 20px", textAlign: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EEF3FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Clock size={26} color="#0052FF" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1421", marginBottom: 6 }}>Request Pending…</div>
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>Waiting for helper to confirm stake.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {VOUCHERS.map((v) => {
              const selected = selectedVoucher?.wallet === v.wallet;
              return (
                <div
                  key={v.wallet}
                  style={{
                    background: "white", borderRadius: 18, overflow: "hidden",
                    boxShadow: selected
                      ? "0 0 0 2px #0052FF, 0 4px 16px rgba(0,82,255,0.15)"
                      : "0 1px 5px rgba(0,0,0,0.06)",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedVoucher(selected ? null : v)}
                >
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                      background: `hsl(${(v.wallet.charCodeAt(0) * 7) % 360},55%,50%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ color: "white", fontSize: 14, fontWeight: 800 }}>{v.wallet.slice(0, 2)}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1421" }}>{v.wallet}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                        Joined {v.age} · {v.vouches} vouches given
                      </div>
                    </div>
                    <div style={{ background: "#ECFDF5", borderRadius: 10, padding: "5px 10px" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#05C48F" }}>{Math.round(v.reputation * 100)}%</span>
                    </div>
                  </div>
                  {selected && (
                    <div style={{ borderTop: "1px solid #F5F5F5", padding: "16px", background: "#FAFBFF" }}>
                      <div style={{ background: "#FFFBEB", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>⚠️ Risk Disclosure</div>
                        <div style={{ fontSize: 12, color: "#78350F", marginTop: 4 }}>
                          This helper will stake <strong>2.5 POR</strong> as collateral. Dishonest behaviour results in stake slash and reputation penalty for both parties.
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", marginBottom: 14 }}>
                        <span>Provisional reputation gain</span>
                        <strong style={{ color: "#0D1421" }}>+10%</strong>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRequestVouch(v); }}
                        style={{
                          width: "100%", background: "#0052FF", color: "white",
                          border: "none", borderRadius: 12, padding: "13px",
                          fontSize: 14, fontWeight: 700, cursor: "pointer",
                          boxShadow: "0 4px 14px rgba(0,82,255,0.3)",
                        }}
                      >
                        Request Helper
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 3 — Graduated Participation (Vote-only observation)
  // ────────────────────────────────────────────────────────────────────────────
  const proposal = VOTE_PROPOSALS[Math.min(currentProposal, VOTE_PROPOSALS.length - 1)];
  return (
    <div style={{ padding: "20px 16px 0" }}>
      {Stepper}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1421" }}>Voting Rounds</div>
        <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>
          Vote honestly on {10 - roundsCompleted} more proposal{10 - roundsCompleted !== 1 ? "s" : ""} to unlock full access
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "white", borderRadius: 20, padding: "18px 16px", marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1421" }}>Observation Progress</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#0052FF" }}>{roundsCompleted}/10</span>
        </div>
        <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", background: "linear-gradient(90deg,#0038E8,#0052FF)",
            borderRadius: 4, width: `${(roundsCompleted / 10) * 100}%`, transition: "width 0.6s ease",
          }} />
        </div>
        {/* Round dots */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "center" }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: i < roundsCompleted ? "#05C48F" : i === roundsCompleted ? "#0052FF" : "#E5E7EB",
              transition: "background 0.4s",
              boxShadow: i === roundsCompleted ? "0 0 6px rgba(0,82,255,0.5)" : "none",
            }} />
          ))}
        </div>
      </div>

      {/* Active proposal card */}
      {roundsCompleted < 10 ? (
        <>
          <div style={{ background: "white", borderRadius: 20, padding: "20px 18px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "#EEF3FF", borderRadius: 8, padding: "3px 9px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#0052FF" }}>
                  PROPOSAL #{roundsCompleted + 1}
                </span>
              </div>
              <div style={{ background: "#ECFDF5", borderRadius: 8, padding: "3px 9px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#05C48F" }}>VOTE-ONLY NODE</span>
              </div>
            </div>

            <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1421", lineHeight: 1.4, marginBottom: 12 }}>
              {proposal.question}
            </div>
            <div style={{
              background: "#F9FAFB", borderRadius: 12, padding: "10px 12px",
              fontSize: 12, color: "#6B7280", lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700, color: "#374151" }}>Context: </span>
              {proposal.context}
            </div>

            {/* Yes / No buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setVoteChoice("yes")}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  background: voteChoice === "yes" ? "#05C48F" : "white",
                  color: voteChoice === "yes" ? "white" : "#374151",
                  border: `2px solid ${voteChoice === "yes" ? "#05C48F" : "#E5E7EB"}`,
                  borderRadius: 14, padding: "13px",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: voteChoice === "yes" ? "0 4px 14px rgba(5,196,143,0.3)" : "none",
                }}
              >
                <ThumbsUp size={16} />
                For
              </button>
              <button
                onClick={() => setVoteChoice("no")}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  background: voteChoice === "no" ? "#EF4444" : "white",
                  color: voteChoice === "no" ? "white" : "#374151",
                  border: `2px solid ${voteChoice === "no" ? "#EF4444" : "#E5E7EB"}`,
                  borderRadius: 14, padding: "13px",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: voteChoice === "no" ? "0 4px 14px rgba(239,68,68,0.3)" : "none",
                }}
              >
                <ThumbsDown size={16} />
                Against
              </button>
            </div>
          </div>

          {/* Submit vote button */}
          <button
            onClick={() => handleVote(voteChoice)}
            disabled={!voteChoice || voting}
            style={{
              width: "100%",
              background: !voteChoice || voting
                ? "#F3F4F6"
                : "linear-gradient(135deg,#0038E8,#0052FF)",
              color: !voteChoice || voting ? "#9CA3AF" : "white",
              border: "none", borderRadius: 16, padding: "17px",
              fontSize: 15, fontWeight: 700,
              cursor: !voteChoice || voting ? "not-allowed" : "pointer",
              boxShadow: !voteChoice || voting ? "none" : "0 6px 22px rgba(0,82,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 20,
            }}
          >
            {voting ? (
              <><Loader size={16} /><span>Submitting vote…</span></>
            ) : (
              <><Shield size={16} /><span>Submit Vote · Round {roundsCompleted + 1}</span></>
            )}
          </button>
        </>
      ) : (
        <div style={{ background: "#ECFDF5", border: "2px solid #05C48F", borderRadius: 20, padding: "28px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1421", marginBottom: 8 }}>
            Merit Mode Complete!
          </div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            Full network participation unlocked · Helper stake released
          </div>
        </div>
      )}
    </div>
  );
}
