"use client";
import { useStore } from "@/store/useStore";
import {
  CheckCircle, Shield, TrendingUp, Award,
  ArrowUpRight, ArrowDownLeft, Repeat, Zap,
  ChevronRight, Lock, Slash,
} from "lucide-react";

const ACTIVITY_META = {
  task:       { color: "#05C48F", bg: "#ECFDF5", Icon: CheckCircle, label: "Task Verified" },
  vouch:      { color: "#0052FF", bg: "#EEF3FF", Icon: Shield,      label: "Vouch" },
  reputation: { color: "#8B5CF6", bg: "#F5F3FF", Icon: TrendingUp,  label: "Reputation" },
  phase:      { color: "#F59E0B", bg: "#FFFBEB", Icon: Award,       label: "Phase Change" },
  send:       { color: "#EF4444", bg: "#FEF2F2", Icon: ArrowUpRight, label: "Sent" },
  receive:    { color: "#10B981", bg: "#ECFDF5", Icon: ArrowDownLeft, label: "Received" },
  SEND:       { color: "#EF4444", bg: "#FEF2F2", Icon: ArrowUpRight, label: "Sent" },
  RECEIVE:    { color: "#10B981", bg: "#ECFDF5", Icon: ArrowDownLeft, label: "Received" },
  STAKE:      { color: "#0052FF", bg: "#EEF3FF", Icon: Lock,         label: "Staked" },
  UNSTAKE:    { color: "#F59E0B", bg: "#FFFBEB", Icon: Lock,         label: "Unstaked" },
  SLASH:      { color: "#DC2626", bg: "#FEF2F2", Icon: Slash,        label: "Slashed" },
  swap:       { color: "#3B82F6", bg: "#EFF6FF", Icon: Repeat,       label: "Swapped" },
  default:    { color: "#6B7280", bg: "#F9FAFB", Icon: Zap,          label: "Activity" },
};

/** Format a Unix timestamp into a human-readable relative time string */
function relativeTime(ts) {
  if (!ts) return "unknown";
  const diffMs = Date.now() - ts * 1000;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10)  return "just now";
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)   return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/** Convert a raw on-chain TX object to the unified activity shape */
function chainTxToActivity(tx) {
  const type = tx.type === "SEND" ? "SEND" : tx.type; // RECEIVE already remapped by backend
  const shortFrom = tx.from ? `${tx.from.slice(0, 6)}…${tx.from.slice(-4)}` : "?";
  const shortTo   = tx.to   ? `${tx.to.slice(0, 6)}…${tx.to.slice(-4)}`   : "?";

  let message = "";
  if (type === "SEND")    message = `Sent ${tx.amount?.toFixed(4)} POR to ${shortTo}`;
  else if (type === "RECEIVE") message = `Received ${tx.amount?.toFixed(4)} POR from ${shortFrom}`;
  else if (type === "STAKE")   message = `Staked ${tx.amount?.toFixed(4)} POR (${tx.note || "vouch"})`;
  else if (type === "UNSTAKE") message = `Unstaked ${tx.amount?.toFixed(4)} POR (${tx.note || "released"})`;
  else if (type === "SLASH")   message = `Slashed ${tx.amount?.toFixed(4)} POR — ${tx.note || "penalty"}`;
  else message = `${type} · ${tx.amount?.toFixed(4)} POR`;

  const blockLabel = tx.block_index === "Pending" ? "⏳ Pending" : `Block #${tx.block_index}`;

  return {
    id:        tx.tx_id ?? `chain-${tx.timestamp}`,
    type,
    message,
    time:      tx.block_index === "Pending"
                 ? "Pending"
                 : relativeTime(tx.timestamp),
    blockLabel,
    amount:    tx.amount,
    token:     "POR",
    isOnChain: true,
  };
}

const FILTERS = ["All", "Transactions", "Staking", "PoR Events"];

export default function Activity() {
  const { activities, chainHistory } = useStore();

  // Convert on-chain TXs to the same shape as local activities
  const chainActivities = (chainHistory ?? []).map(chainTxToActivity);

  // Merge: chainActivities first (they have real timestamps), then local PoR events
  // De-duplicate by id — local activities from execSend are overridden by chain version
  const chainIds = new Set(chainActivities.map(a => a.id));
  const localOnly = activities.filter(a => !chainIds.has(a.id));

  // Sort merged list: pending first, then by recency
  const merged = [
    ...chainActivities.filter(a => a.time === "Pending"),
    ...chainActivities.filter(a => a.time !== "Pending"),
    ...localOnly,
  ].slice(0, 60);

  const txTypes   = new Set(["SEND", "RECEIVE", "send", "receive", "swap"]);
  const stakeTypes= new Set(["STAKE", "UNSTAKE", "SLASH"]);

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1421", marginBottom: 4 }}>
          Activity
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>
          On-chain transactions &amp; reputation events
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 20,
        overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4,
      }}>
        {FILTERS.map((filter, i) => (
          <div
            key={filter}
            style={{
              background: i === 0 ? "#0052FF" : "white",
              color:      i === 0 ? "white"   : "#6B7280",
              borderRadius: 12, padding: "8px 16px",
              fontSize: 13, fontWeight: 700,
              border: i === 0 ? "none" : "1px solid #E5E7EB",
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {filter}
          </div>
        ))}
      </div>

      {/* On-chain summary badge */}
      {chainActivities.length > 0 && (
        <div style={{
          background: "#EEF3FF", border: "1px solid #DBEAFE",
          borderRadius: 12, padding: "10px 14px", marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
            🔗 {chainActivities.length} on-chain transaction{chainActivities.length !== 1 ? "s" : ""} found
          </span>
          <span style={{ fontSize: 11, color: "#0052FF", fontWeight: 700 }}>
            Live from PoR-Chain
          </span>
        </div>
      )}

      {/* Activity list */}
      {merged.length === 0 ? (
        <div style={{
          background: "white", borderRadius: 20, padding: "48px 20px",
          textAlign: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0D1421", marginBottom: 6 }}>
            No Activity Yet
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>
            Your transactions and reputation events will appear here
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {merged.map((activity, i) => {
            const meta = ACTIVITY_META[activity.type] || ACTIVITY_META.default;
            const { Icon, color, bg, label } = meta;
            const isTx = txTypes.has(activity.type);
            const isStake = stakeTypes.has(activity.type);
            const isPending = activity.time === "Pending";

            return (
              <div
                key={activity.id ?? i}
                style={{
                  background: isPending ? "#FFFBEB" : "white",
                  borderRadius: 18, padding: "16px",
                  boxShadow: isPending
                    ? "0 0 0 1.5px #FDE68A, 0 2px 8px rgba(0,0,0,0.05)"
                    : "0 1px 5px rgba(0,0,0,0.06)",
                  display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: bg, display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={22} color={color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1421", marginBottom: 2 }}>
                    {activity.message}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{activity.time}</span>
                    <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#D1D5DB" }} />
                    <span style={{ fontSize: 11, color: activity.isOnChain ? "#0052FF" : color, fontWeight: 600 }}>
                      {activity.isOnChain ? (activity.blockLabel ?? label) : label}
                    </span>
                  </div>
                </div>
                {(isTx || isStake) && activity.amount != null && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 800,
                      color: ["RECEIVE", "receive", "UNSTAKE"].includes(activity.type)
                        ? "#10B981" : "#0D1421",
                    }}>
                      {["RECEIVE", "receive", "UNSTAKE"].includes(activity.type) ? "+" : "−"}
                      {typeof activity.amount === "number" ? activity.amount.toFixed(4) : activity.amount} POR
                    </div>
                  </div>
                )}
                <ChevronRight size={16} color="#D1D5DB" />
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {merged.length >= 60 && (
        <button style={{
          width: "100%", background: "white", color: "#0052FF",
          border: "1px solid #E5E7EB", borderRadius: 14, padding: "14px",
          fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 16,
        }}>
          Load More
        </button>
      )}
      <div style={{ height: 20 }} />
    </div>
  );
}
