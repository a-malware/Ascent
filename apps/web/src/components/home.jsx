"use client";
import { useStore } from "@/store/useStore";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Download,
  Repeat,
  Vote,
  Zap,
  ChevronRight,
  CheckCircle,
  Shield,
  Award,
  Eye,
  EyeOff,
  Lock,
  Gift,
} from "lucide-react";
import { useState, useRef } from "react";

const ACTIVITY_META = {
  task: { color: "#05C48F", bg: "#ECFDF5", Icon: CheckCircle },
  vouch: { color: "#0052FF", bg: "#EEF3FF", Icon: Shield },
  reputation: { color: "#8B5CF6", bg: "#F5F3FF", Icon: TrendingUp },
  phase: { color: "#F59E0B", bg: "#FFFBEB", Icon: Award },
  send: { color: "#EF4444", bg: "#FEF2F2", Icon: ArrowUpRight },
  receive: { color: "#10B981", bg: "#ECFDF5", Icon: ArrowDownLeft },
  swap: { color: "#3B82F6", bg: "#EFF6FF", Icon: Repeat },
  default: { color: "#6B7280", bg: "#F9FAFB", Icon: Zap },
};

export default function Home() {
  const {
    portfolioBalance,
    portfolioUSD,
    reputation,
    phase,
    tasksCompleted,
    reputationGrowth,
    meritBoost,
    tokens,
    activities,
    setActiveTab,
    graduated,
    claimedGenesis,
    setActiveModal,
  } = useStore();

  const [hideBalance, setHideBalance] = useState(false);
  const longPressRef = useRef(null);

  const startLongPress = () => {
    longPressRef.current = setTimeout(() => setActiveModal("slash"), 700);
  };
  const cancelLongPress = () => clearTimeout(longPressRef.current);

  const repPercent = Math.round(reputation * 100);
  const repColor =
    reputation >= 0.7 ? "#05C48F" : reputation >= 0.4 ? "#F59E0B" : "#EF4444";
  const repBg =
    reputation >= 0.7 ? "#ECFDF5" : reputation >= 0.4 ? "#FFFBEB" : "#FEF2F2";

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {/* Portfolio Balance */}
      <div
        style={{
          background: "white",
          borderRadius: 24,
          padding: "24px 20px",
          marginBottom: 20,
          boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Total Balance
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "#0D1421",
                letterSpacing: -1.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {hideBalance
                ? "••••••"
                : `$${portfolioUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#6B7280",
                marginTop: 4,
              }}
            >
              {hideBalance ? "•••" : `${portfolioBalance.toFixed(2)} SOL`}
            </div>
          </div>
          <button
            onClick={() => setHideBalance(!hideBalance)}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#F5F7FA",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {hideBalance ? (
              <EyeOff size={18} color="#9CA3AF" />
            ) : (
              <Eye size={18} color="#9CA3AF" />
            )}
          </button>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          {[
            { label: "Send",  Icon: Send,     color: "#0052FF", modal: "send" },
            { label: "Swap",  Icon: Repeat,   color: "#8B5CF6", modal: "swap" },
            {
              label: claimedGenesis ? "Claimed" : "Claim",
              Icon: graduated ? (claimedGenesis ? CheckCircle : Gift) : Lock,
              color: graduated && !claimedGenesis ? "#10B981" : "#9CA3AF",
              modal: "claim",
            },
            { label: "Vote",  Icon: Vote,     color: "#F59E0B", modal: null },
          ].map(({ label, Icon, color, modal }) => (
            <button
              key={label}
              onClick={() => modal ? setActiveModal(modal) : setActiveTab("merit")}
              style={{
                background: "#F9FAFB",
                borderRadius: 14,
                padding: "14px 8px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: color + "15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={18} color={color} />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6B7280",
                }}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Large Reputation Orb Card — long-press to open Slash Simulator */}
      <div
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        style={{
          background:
            "linear-gradient(140deg, #0038E8 0%, #0052FF 55%, #2271FF 100%)",
          borderRadius: 24,
          padding: "28px 24px",
          marginBottom: 20,
          position: "relative",
          overflow: "hidden",
          cursor: "default",
          userSelect: "none",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -24,
            left: 20,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              MERIT SCORE
            </div>
            <div
              style={{
                color: "white",
                fontSize: 56,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: -2,
              }}
            >
              {repPercent}
              <span style={{ fontSize: 28, fontWeight: 700 }}>%</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 10,
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: 20,
                  padding: "3px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <TrendingUp size={12} color="white" />
                <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                  +{reputationGrowth.toFixed(1)}% this week
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.18)",
              borderRadius: 14,
              padding: "6px 14px",
              backdropFilter: "blur(10px)",
            }}
          >
            <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>
              Phase {phase}
            </span>
          </div>
        </div>

        {/* Merit boost info */}
        <div
          style={{
            background: "rgba(255,255,255,0.15)",
            borderRadius: 14,
            padding: "12px 14px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Yield Multiplier
              </div>
              <div
                style={{
                  color: "white",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {meritBoost.toFixed(2)}x
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.7)",
                textAlign: "right",
              }}
            >
              Earn {Math.round((meritBoost - 1) * 100)}% more
              <br />
              on staking rewards
            </div>
          </div>
        </div>
      </div>

      {/* Merit Progress Cards — hidden once fully graduated */}
      {!graduated && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: "16px 14px",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
                Tasks Done
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "#05C48F18",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle size={14} color="#05C48F" />
              </div>
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#0D1421",
                marginBottom: 3,
              }}
            >
              {tasksCompleted}/5
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              Phase {phase === 1 ? "1" : "Complete"}
            </div>
          </div>

          <button
            onClick={() => setActiveTab("merit")}
            style={{
              background: "linear-gradient(135deg,#0038E8,#0052FF)",
              borderRadius: 18,
              padding: "16px 14px",
              boxShadow: "0 4px 16px rgba(0,82,255,0.25)",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.8)",
                  fontWeight: 600,
                }}
              >
                Continue
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={14} color="white" />
              </div>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "white",
                marginBottom: 3,
              }}
            >
              Merit Mode
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              Activate now →
            </div>
          </button>
        </div>
      )}

      {/* Graduated validator card — shown only after full graduation */}
      {graduated && (
        <div
          style={{
            background: "linear-gradient(135deg,#05C48F,#059669)",
            borderRadius: 18,
            padding: "18px 16px",
            marginBottom: 20,
            boxShadow: "0 4px 16px rgba(5,196,143,0.28)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Shield size={22} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "white", marginBottom: 2 }}>
              Full Validator
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              All 3 phases complete · Network access unlocked
            </div>
          </div>
          <button
            onClick={() => setActiveTab("validate")}
            style={{
              background: "rgba(255,255,255,0.22)",
              border: "none", borderRadius: 11, padding: "8px 14px",
              color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Validate →
          </button>
        </div>
      )}

      {/* Token List */}
      <div
        style={{
          background: "white",
          borderRadius: 20,
          overflow: "hidden",
          marginBottom: 20,
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid #F5F5F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0D1421" }}>
            Assets
          </span>
          <span style={{ fontSize: 12, color: "#0052FF", fontWeight: 600 }}>
            See all
          </span>
        </div>
        {tokens.map((token, i) => (
          <div
            key={token.symbol}
            style={{
              padding: "14px 16px",
              borderBottom:
                i < tokens.length - 1 ? "1px solid #F9F9F9" : "none",
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "#F3F4F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {token.logo}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0D1421",
                }}
              >
                {token.symbol}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                {token.balance >= 1000
                  ? token.balance.toLocaleString()
                  : token.balance.toFixed(2)}{" "}
                {token.symbol}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0D1421",
                }}
              >
                ${token.value.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: token.change24h >= 0 ? "#10B981" : "#EF4444",
                  marginTop: 1,
                  fontWeight: 600,
                }}
              >
                {token.change24h >= 0 ? "+" : ""}
                {token.change24h.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div
        style={{
          background: "white",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid #F5F5F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0D1421" }}>
            Recent Activity
          </span>
          <button
            onClick={() => setActiveTab("activity")}
            style={{
              fontSize: 12,
              color: "#0052FF",
              fontWeight: 600,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            See all
          </button>
        </div>

        {activities.slice(0, 5).map((activity, i) => {
          const meta = ACTIVITY_META[activity.type] || ACTIVITY_META.default;
          const { Icon, color, bg } = meta;
          return (
            <div
              key={activity.id || i}
              style={{
                padding: "13px 16px",
                borderBottom:
                  i < Math.min(activities.length, 5) - 1
                    ? "1px solid #F9F9F9"
                    : "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0D1421",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {activity.message}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {activity.time}
                </div>
              </div>
              <ChevronRight size={15} color="#D1D5DB" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
