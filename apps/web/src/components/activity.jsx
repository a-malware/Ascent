"use client";
import { useStore } from "@/store/useStore";
import {
  CheckCircle,
  Shield,
  TrendingUp,
  Award,
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  Zap,
  ChevronRight,
} from "lucide-react";

const ACTIVITY_META = {
  task: {
    color: "#05C48F",
    bg: "#ECFDF5",
    Icon: CheckCircle,
    label: "Task Verified",
  },
  vouch: { color: "#0052FF", bg: "#EEF3FF", Icon: Shield, label: "Vouch" },
  reputation: {
    color: "#8B5CF6",
    bg: "#F5F3FF",
    Icon: TrendingUp,
    label: "Reputation",
  },
  phase: {
    color: "#F59E0B",
    bg: "#FFFBEB",
    Icon: Award,
    label: "Phase Change",
  },
  send: { color: "#EF4444", bg: "#FEF2F2", Icon: ArrowUpRight, label: "Sent" },
  receive: {
    color: "#10B981",
    bg: "#ECFDF5",
    Icon: ArrowDownLeft,
    label: "Received",
  },
  swap: { color: "#3B82F6", bg: "#EFF6FF", Icon: Repeat, label: "Swapped" },
  default: { color: "#6B7280", bg: "#F9FAFB", Icon: Zap, label: "Activity" },
};

export default function Activity() {
  const { activities } = useStore();

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#0D1421",
            marginBottom: 4,
          }}
        >
          Activity
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>
          All wallet transactions & reputation events
        </div>
      </div>

      {/* Filter tabs (simulated) */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 4,
        }}
      >
        {["All", "Transactions", "Merit", "Reputation"].map((filter, i) => (
          <div
            key={filter}
            style={{
              background: i === 0 ? "#0052FF" : "white",
              color: i === 0 ? "white" : "#6B7280",
              borderRadius: 12,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              border: i === 0 ? "none" : "1px solid #E5E7EB",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {filter}
          </div>
        ))}
      </div>

      {/* Activity list */}
      {activities.length === 0 ? (
        <div
          style={{
            background: "white",
            borderRadius: 20,
            padding: "48px 20px",
            textAlign: "center",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#0D1421",
              marginBottom: 6,
            }}
          >
            No Activity Yet
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>
            Your transactions and reputation events will appear here
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activities.map((activity) => {
            const meta = ACTIVITY_META[activity.type] || ACTIVITY_META.default;
            const { Icon, color, bg, label } = meta;
            const isTransaction = ["send", "receive", "swap"].includes(
              activity.type,
            );

            return (
              <div
                key={activity.id}
                style={{
                  background: "white",
                  borderRadius: 18,
                  padding: "16px",
                  boxShadow: "0 1px 5px rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={22} color={color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0D1421",
                      marginBottom: 2,
                    }}
                  >
                    {activity.message}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "#9CA3AF",
                      }}
                    >
                      {activity.time}
                    </span>
                    <div
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        background: "#D1D5DB",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: color,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                </div>
                {isTransaction && activity.amount && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: activity.amount > 0 ? "#10B981" : "#0D1421",
                      }}
                    >
                      {activity.amount > 0 ? "+" : ""}
                      {activity.amount} {activity.token}
                    </div>
                  </div>
                )}
                <ChevronRight size={16} color="#D1D5DB" />
              </div>
            );
          })}
        </div>
      )}

      {/* Load more button */}
      {activities.length > 0 && (
        <button
          style={{
            width: "100%",
            background: "white",
            color: "#0052FF",
            border: "1px solid #E5E7EB",
            borderRadius: 14,
            padding: "14px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            marginTop: 16,
          }}
        >
          Load More
        </button>
      )}
    </div>
  );
}
