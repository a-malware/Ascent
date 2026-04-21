"use client";
import { useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import {
  Search,
  Shield,
  X,
  AlertTriangle,
  CheckCircle,
  Lock,
} from "lucide-react";

const ELIGIBLE_USERS = [
  { wallet: "1fXr...3Nt7", taskScore: 0.95, rep: 0.45, phase: 1, tasksCompleted: 19, lastSeen: "2m ago",  isOnline: true  },
  { wallet: "5gYo...0Cq6", taskScore: 0.90, rep: 0.38, phase: 1, tasksCompleted: 18, lastSeen: "6m ago",  isOnline: true  },
  { wallet: "2nPs...5Kj1", taskScore: 0.85, rep: 0.32, phase: 1, tasksCompleted: 17, lastSeen: "14m ago", isOnline: true  },
  { wallet: "6cDw...8Lm4", taskScore: 0.80, rep: 0.29, phase: 1, tasksCompleted: 16, lastSeen: "31m ago", isOnline: false },
  { wallet: "0aJk...9Pz2", taskScore: 0.75, rep: 0.21, phase: 1, tasksCompleted: 15, lastSeen: "1h ago",  isOnline: false },
  { wallet: "3mQr...1Bv8", taskScore: 0.70, rep: 0.18, phase: 1, tasksCompleted: 14, lastSeen: "2h ago",  isOnline: false },
];

export default function Vouch() {
  const { reputation, addActivity } = useStore();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [vouching, setVouching] = useState(false);
  const [vouched, setVouched] = useState({});

  const canVouch = reputation >= 0.7;
  const stakeAmount = 2.5;

  const filtered = ELIGIBLE_USERS.filter(
    (u) => !search || u.wallet.toLowerCase().includes(search.toLowerCase()),
  );

  const handleVouch = useCallback(async () => {
    if (!modal) return;
    setVouching(true);
    await new Promise((r) => setTimeout(r, 1800));
    setVouched((prev) => ({ ...prev, [modal.wallet]: true }));
    addActivity({
      id: Date.now(),
      type: "vouch",
      message: `Vouched for ${modal.wallet} · ${stakeAmount} SOL staked`,
      time: "just now",
    });
    toast.success("Vouch submitted!", {
      description: `${stakeAmount} SOL staked on ${modal.wallet}`,
    });
    setVouching(false);
    setModal(null);
  }, [modal, addActivity, stakeAmount]);

  if (!canVouch)
    return (
      <div style={{ padding: "20px 16px 0" }}>
        <div
          style={{
            background: "white",
            borderRadius: 24,
            padding: "40px 24px",
            textAlign: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Lock size={32} color="#9CA3AF" />
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#0D1421",
              marginBottom: 8,
            }}
          >
            Vouch Access Locked
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#6B7280",
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            You need a reputation score of{" "}
            <strong style={{ color: "#0D1421" }}>70% or higher</strong> to vouch
            for other users.
          </div>
          <div
            style={{
              background: "#F5F7FA",
              borderRadius: 16,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 13, color: "#6B7280" }}>
                Your current score
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#EF4444" }}>
                {Math.round(reputation * 100)}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "#E5E7EB",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "#EF4444",
                  borderRadius: 3,
                  width: `${Math.round(reputation * 100)}%`,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
              Need {Math.round((0.7 - reputation) * 100)}% more · Complete tasks
              and get vouched
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {/* Pulse animation for online indicators */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(1.35); }
        }
        .online-dot { animation: pulse-dot 1.8s ease-in-out infinite; }
      `}</style>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0D1421" }}>Vouch for Others</div>
          {/* Live node counter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ECFDF5", borderRadius: 20, padding: "4px 10px" }}>
            <div className="online-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#05C48F" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#05C48F" }}>
              {ELIGIBLE_USERS.filter(u => u.isOnline).length} active now
            </span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
          Stake SOL to help new members join the network
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(135deg,#EEF3FF,#F5F8FF)",
          border: "1px solid #DBEAFE",
          borderRadius: 16,
          padding: "14px 16px",
          marginBottom: 18,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Shield
          size={18}
          color="#0052FF"
          style={{ flexShrink: 0, marginTop: 1 }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1421" }}>
            Staking {stakeAmount} SOL per vouch
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
            If the user behaves dishonestly, your stake will be slashed. Choose
            carefully.
          </div>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search
          size={16}
          color="#9CA3AF"
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
        <input
          type="text"
          placeholder="Search by wallet address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px 12px 40px",
            borderRadius: 14,
            border: "1.5px solid #E5E7EB",
            background: "white",
            fontSize: 14,
            color: "#0D1421",
            outline: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((user) => {
          const done = vouched[user.wallet];
          return (
            <div
              key={user.wallet}
              style={{
                background: "white",
                borderRadius: 18,
                padding: "14px 16px",
                boxShadow: user.isOnline
                  ? "0 0 0 1.5px #05C48F30, 0 2px 10px rgba(0,0,0,0.06)"
                  : "0 1px 6px rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {/* Avatar with online ring */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: `hsl(${(user.wallet.charCodeAt(0) * 7) % 360},55%,52%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "white", fontSize: 14, fontWeight: 800 }}>
                    {user.wallet.slice(0, 2)}
                  </span>
                </div>
                {user.isOnline && (
                  <div
                    className="online-dot"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: "#05C48F",
                      border: "2px solid white",
                    }}
                  />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1421" }}>
                    {user.wallet}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                  {user.tasksCompleted}/20 tasks · Rep {Math.round(user.rep * 100)}%
                  {" · "}
                  <span style={{ color: user.isOnline ? "#05C48F" : "#D1D5DB", fontWeight: 600 }}>
                    {user.isOnline ? `Active ${user.lastSeen}` : `Last seen ${user.lastSeen}`}
                  </span>
                </div>
                <div
                  style={{
                    height: 3,
                    background: "#F3F4F6",
                    borderRadius: 2,
                    marginTop: 6,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: user.isOnline ? "#05C48F" : "#0052FF",
                      borderRadius: 2,
                      width: `${Math.round(user.taskScore * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    background: "#EEF3FF",
                    borderRadius: 10,
                    padding: "3px 9px",
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: "#0052FF" }}
                  >
                    {Math.round(user.taskScore * 100)}%
                  </span>
                </div>
                {done ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <CheckCircle size={13} color="#05C48F" />
                    <span
                      style={{
                        fontSize: 11,
                        color: "#05C48F",
                        fontWeight: 600,
                      }}
                    >
                      Vouched
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setModal(user)}
                    style={{
                      background: "#0052FF",
                      color: "white",
                      border: "none",
                      borderRadius: 10,
                      padding: "7px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Shield size={11} /> Vouch
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <>
          <div
            onClick={() => !vouching && setModal(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(13,20,33,0.55)",
              zIndex: 100,
              backdropFilter: "blur(4px)",
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: 430,
              background: "white",
              borderRadius: "24px 24px 0 0",
              padding: "24px 20px 36px",
              zIndex: 101,
              boxShadow: "0 -12px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: "#E5E7EB",
                borderRadius: 2,
                margin: "0 auto 20px",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1421" }}>
                Confirm Vouch
              </div>
              <button
                onClick={() => !vouching && setModal(null)}
                style={{
                  background: "#F5F7FA",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color="#6B7280" />
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#F9FAFB",
                borderRadius: 16,
                padding: "14px",
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `hsl(${(modal.wallet.charCodeAt(0) * 7) % 360},55%,52%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "white", fontSize: 14, fontWeight: 800 }}>
                  {modal.wallet.slice(0, 2)}
                </span>
              </div>
              <div>
                <div
                  style={{ fontSize: 14, fontWeight: 700, color: "#0D1421" }}
                >
                  {modal.wallet}
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                  {modal.tasksCompleted}/20 tasks · Phase {modal.phase}
                </div>
              </div>
            </div>
            <div
              style={{
                background: "#F9FAFB",
                borderRadius: 16,
                padding: "14px",
                marginBottom: 16,
              }}
            >
              {[
                {
                  label: "Stake amount",
                  value: `${stakeAmount} SOL`,
                  color: "#0D1421",
                },
                {
                  label: "Your reputation",
                  value: `${Math.round(reputation * 100)}%`,
                  color: "#05C48F",
                },
                {
                  label: "Recipient rep gain",
                  value: "+10%",
                  color: "#0052FF",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #F0F0F0",
                  }}
                >
                  <span style={{ fontSize: 13, color: "#6B7280" }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 14,
                padding: "12px 14px",
                marginBottom: 20,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <AlertTriangle
                size={15}
                color="#D97706"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
                If this user behaves dishonestly,{" "}
                <strong>{stakeAmount} SOL</strong> will be slashed from your
                stake. This cannot be undone.
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => !vouching && setModal(null)}
                disabled={vouching}
                style={{
                  flex: 1,
                  background: "#F5F7FA",
                  color: "#6B7280",
                  border: "none",
                  borderRadius: 14,
                  padding: "15px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleVouch}
                disabled={vouching}
                style={{
                  flex: 2,
                  background: vouching ? "#F3F4F6" : "#0052FF",
                  color: vouching ? "#9CA3AF" : "white",
                  border: "none",
                  borderRadius: 14,
                  padding: "15px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: vouching ? "not-allowed" : "pointer",
                  boxShadow: vouching
                    ? "none"
                    : "0 4px 16px rgba(0,82,255,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {vouching ? (
                  "Submitting…"
                ) : (
                  <>
                    <Shield size={15} /> Confirm Vouch
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
