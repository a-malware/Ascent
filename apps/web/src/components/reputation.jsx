"use client";
import { useState } from "react";
import { useStore } from "@/store/useStore";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Shield,
  Award,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const generateHistory = () => {
  const history = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const month = d.toLocaleString("default", { month: "short" });
    const day = d.getDate();
    // Simulate sitting at 0 rep before registration, then bumping to 0.10 recently
    const isPast = i > 4; 
    const rep = isPast ? (0.01 + Math.random() * 0.02) : 0.10; 
    history.push({ date: `${month} ${day}`, rep: Number(rep.toFixed(3)) });
  }
  return history;
};

const FULL_HISTORY = generateHistory();
const RANGE_MAP = {
  "1W":  FULL_HISTORY.slice(-7),
  "1M":  FULL_HISTORY.slice(-30),
  "3M":  FULL_HISTORY.slice(-90),
  "ALL": FULL_HISTORY,
};

const VOUCH_HISTORY = [];
const EVENT_HISTORY = [
  { label: "Node registered",  delta: +0.10, date: "Apr 1",  type: "phase" },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        fontSize: 13,
      }}
    >
      <div style={{ color: "#9CA3AF", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, color: "#0052FF", fontSize: 16 }}>
        {Math.round(payload[0].value * 100)}%
      </div>
    </div>
  );
};

export default function Reputation() {
  const { reputation } = useStore();
  const [range, setRange] = useState("3M");

  // Dynamically update the current day's graph point to reflect live reputation
  const baseData = RANGE_MAP[range] || FULL_HISTORY;
  const data = baseData.map((d, i) =>
    i === baseData.length - 1 ? { ...d, rep: reputation } : d
  );
  const repPct = Math.round(reputation * 100);
  const repColor =
    reputation >= 0.7 ? "#05C48F" : reputation >= 0.4 ? "#F59E0B" : "#EF4444";
  const prev = data.length > 1 ? data[data.length - 2].rep : data[0].rep;
  const change = ((reputation - prev) / prev) * 100;
  const isUp = change >= 0;

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {/* Score hero + chart */}
      <div
        style={{
          background: "white",
          borderRadius: 24,
          padding: "22px 20px 0",
          marginBottom: 20,
          boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "#9CA3AF",
                fontWeight: 600,
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              REPUTATION SCORE
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: "#0D1421",
                lineHeight: 1,
                letterSpacing: -2,
              }}
            >
              {repPct}
              <span style={{ fontSize: 26, fontWeight: 700 }}>%</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  background: isUp ? "#ECFDF5" : "#FEF2F2",
                  borderRadius: 20,
                  padding: "3px 9px",
                }}
              >
                {isUp ? (
                  <ArrowUpRight size={13} color="#05C48F" />
                ) : (
                  <ArrowDownRight size={13} color="#EF4444" />
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: isUp ? "#05C48F" : "#EF4444",
                  }}
                >
                  {isUp ? "+" : ""}
                  {change.toFixed(1)}% this period
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: repColor + "18",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={24} color={repColor} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {["1W", "1M", "3M", "ALL"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                background: range === r ? "#0052FF" : "#F5F7FA",
                color: range === r ? "white" : "#9CA3AF",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart
            data={data}
            margin={{ top: 0, right: 0, left: -28, bottom: 0 }}
          >
            <defs>
              <linearGradient id="repGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0052FF" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#0052FF" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F5F5F5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#C4C9D4" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fontSize: 10, fill: "#C4C9D4" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "#0052FF",
                strokeWidth: 1.5,
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="rep"
              stroke="#0052FF"
              strokeWidth={2.5}
              fill="url(#repGrad)"
              dot={false}
              activeDot={{
                r: 5,
                fill: "#0052FF",
                stroke: "white",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Highest",      value: `${repPct}%`,      color: repColor },
          { label: "Days Active",  value: "3",               color: "#0052FF" },
          { label: "Vouches",      value: "0 received",      color: "#8B5CF6" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: "white",
              borderRadius: 16,
              padding: "14px 10px",
              textAlign: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
            <div
              style={{
                fontSize: 10,
                color: "#9CA3AF",
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Decay warning */}
      <div
        style={{
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: 16,
          padding: "12px 14px",
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>⏳</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>
            Decay Factor Active
          </div>
          <div style={{ fontSize: 12, color: "#78350F", marginTop: 2 }}>
            Your reputation decays 0.5% per day of inactivity. Keep
            participating.
          </div>
        </div>
      </div>

      {/* Vouch history */}
      <div
        style={{
          background: "white",
          borderRadius: 20,
          marginBottom: 16,
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            padding: "14px 16px 10px",
            borderBottom: "1px solid #F5F5F5",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Shield size={15} color="#0052FF" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1421" }}>
            Vouch History
          </span>
        </div>
        {VOUCH_HISTORY.map((v, i) => (
          <div
            key={i}
            style={{
              padding: "13px 16px",
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
                background: "#EEF3FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Shield size={18} color="#0052FF" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0D1421" }}>
                Vouched by {v.wallet}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                Stake: {v.stake} · {v.date}
              </div>
            </div>
            <div
              style={{
                background: "#ECFDF5",
                borderRadius: 10,
                padding: "4px 10px",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#05C48F" }}>
                {Math.round(v.rep * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Event history */}
      <div
        style={{
          background: "white",
          borderRadius: 20,
          marginBottom: 16,
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            padding: "14px 16px 10px",
            borderBottom: "1px solid #F5F5F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={15} color="#8B5CF6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1421" }}>
              Score History
            </span>
          </div>
          <button
            style={{
              background: "#F5F7FA",
              border: "none",
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 11,
              color: "#6B7280",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Download size={11} /> Export
          </button>
        </div>
        {EVENT_HISTORY.map((e, i) => {
          const up = e.delta > 0;
          return (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                borderBottom:
                  i < EVENT_HISTORY.length - 1 ? "1px solid #F9F9F9" : "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: up ? "#ECFDF5" : "#FEF2F2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {up ? (
                  <ArrowUpRight size={16} color="#05C48F" />
                ) : (
                  <ArrowDownRight size={16} color="#EF4444" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 500, color: "#0D1421" }}
                >
                  {e.label}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                  {e.date}
                </div>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: up ? "#05C48F" : "#EF4444",
                }}
              >
                {up ? "+" : ""}
                {(e.delta * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
