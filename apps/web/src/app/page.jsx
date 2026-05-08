"use client";
import { useState, useCallback, useRef } from "react";
import Splash from "@/components/splash";
import { useStore } from "@/store/useStore";
import { Toaster } from "sonner";
import Home from "@/components/home";
import Merit from "@/components/merit";
import Validate from "@/components/validate";
import Reputation from "@/components/reputation";
import Vouch from "@/components/vouch";
import Activity from "@/components/activity";
import SwapModal  from "@/components/modals/SwapModal";
import SendModal  from "@/components/modals/SendModal";
import ClaimModal from "@/components/modals/ClaimModal";
import SlashModal from "@/components/modals/SlashModal";
import { NodeProvider, NodeStatusBadge } from "@/chain/node.jsx";
import { useSyncStore } from "@/chain/useSyncStore";
import {
  Home as HomeIcon,
  Zap,
  ShieldCheck,
  TrendingUp,
  Users,
  List,
  Bell,
  X,
} from "lucide-react";


export default function App() {
  const {
    activeTab,
    setActiveTab,
    wallet,
    reputation,
    notifications,
    markNotificationsRead,
    resetDemo,
    graduated,
    activeModal,
    setActiveModal,
  } = useStore();

  const [showSplash, setShowSplash] = useState(true);
  useSyncStore(); // polls Python backend every 6s → syncs Zustand store

  const TABS = [
    { id: "home",     label: "Home",     Icon: HomeIcon   },
    graduated
      ? { id: "validate", label: "Validate", Icon: ShieldCheck }
      : { id: "merit",    label: "Merit",    Icon: Zap        },
    { id: "reputation", label: "Rep",      Icon: TrendingUp },
    { id: "vouch",      label: "Vouch",    Icon: Users      },
    { id: "activity",   label: "Activity", Icon: List       },
  ];

  // Long-press on logo resets the demo back to Phase 1
  const pressTimer = useRef(null);
  const [pressing, setPressing] = useState(false);

  const handleLogoPointerDown = useCallback(() => {
    setPressing(true);
    pressTimer.current = setTimeout(async () => {
      // Reset server-side mock-db and client-side Zustand store in sync
      await fetch("/api/reset-demo").catch(() => {});
      resetDemo();
      setPressing(false);
      import("sonner").then(({ toast }) =>
        toast.success("Demo reset!", { description: "Back to Phase 1 — fresh node." })
      );
    }, 1500);
  }, [resetDemo]);

  const handleLogoPointerUp = useCallback(() => {
    clearTimeout(pressTimer.current);
    setPressing(false);
  }, []);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = (notifications || []).filter((n) => !n.read).length;
  const repPercent = Math.round(reputation * 100);
  const repColor =
    reputation >= 0.7 ? "#05C48F" : reputation >= 0.4 ? "#F59E0B" : "#EF4444";
  const repBg =
    reputation >= 0.7 ? "#ECFDF5" : reputation >= 0.4 ? "#FFFBEB" : "#FEF2F2";

  const handleBellClick = useCallback(() => {
    setShowNotifications((v) => !v);
    if (!showNotifications) markNotificationsRead();
  }, [showNotifications, markNotificationsRead]);

  const renderContent = () => {
    switch (activeTab) {
      case "home":       return <Home />;
      case "merit":      return <Merit />;
      case "validate":   return <Validate />;
      case "reputation": return <Reputation />;
      case "vouch":      return <Vouch />;
      case "activity":   return <Activity />;
      default:           return <Home />;
    }
  };

  return (
    <NodeProvider>
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #E8EDF5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        ::-webkit-scrollbar { display: none; }
        button { transition: transform 0.12s ease; }
        button:active { transform: scale(0.96); }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#E8EDF5",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 430,
            minHeight: "100vh",
            height: "100vh",
            background: "#F5F7FA",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            boxShadow: "0 0 60px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}
        >
          {/* ── Header with Ascent Branding ── */}
          <div
            style={{
              background: "#FFFFFF",
              paddingTop: 52,
              paddingBottom: 14,
              paddingLeft: 20,
              paddingRight: 20,
              borderBottom: "1px solid #F0F2F5",
              flexShrink: 0,
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  onPointerDown={handleLogoPointerDown}
                  onPointerUp={handleLogoPointerUp}
                  onPointerLeave={handleLogoPointerUp}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: pressing
                      ? "linear-gradient(135deg,#EF4444,#DC2626)"
                      : "linear-gradient(135deg,#0038E8,#1A6BFF)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    cursor: "pointer",
                    transition: "background 0.3s ease",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontSize: 18,
                      lineHeight: 1,
                      fontWeight: 800,
                    }}
                  >
                    A
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0D1421",
                      letterSpacing: -0.5,
                    }}
                  >
                    Ascent
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9CA3AF",
                      fontWeight: 500,
                    }}
                  >
                    {wallet}
                  </div>
                </div>
              </div>
              {/* Right side: Wallet button + Rep badge + Bell */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <NodeStatusBadge />
                {/* Reputation Orb Badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: repBg,
                    borderRadius: 20,
                    padding: "6px 12px",
                    border: `1.5px solid ${repColor}20`,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: repColor,
                      boxShadow: `0 0 8px ${repColor}60`,
                    }}
                  />
                  <span
                    style={{ fontSize: 13, fontWeight: 800, color: repColor }}
                  >
                    {repPercent}%
                  </span>
                </div>
                <button
                  onClick={handleBellClick}
                  style={{
                    position: "relative",
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Bell size={17} color="#6B7280" />
                  {unreadCount > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 7,
                        right: 7,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#EF4444",
                        border: "2px solid white",
                      }}
                    />
                  )}
                </button>
              </div>
            </div>
            {/* Tagline */}
            <div
              style={{
                fontSize: 10,
                color: "#9CA3AF",
                textAlign: "center",
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              Reputation is the new stake
            </div>
          </div>

          {/* ── Notification Drawer ── */}
          {showNotifications && (
            <div
              style={{
                position: "absolute",
                top: 120,
                left: 12,
                right: 12,
                background: "white",
                borderRadius: 20,
                boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
                zIndex: 50,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderBottom: "1px solid #F5F5F5",
                }}
              >
                <span
                  style={{ fontSize: 15, fontWeight: 700, color: "#0D1421" }}
                >
                  Notifications
                </span>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <X size={18} color="#9CA3AF" />
                </button>
              </div>
              {notifications.map((n, i) => (
                <div
                  key={n.id}
                  style={{
                    padding: "13px 18px",
                    borderBottom:
                      i < notifications.length - 1
                        ? "1px solid #F9F9F9"
                        : "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: n.read ? "#E5E7EB" : "#0052FF",
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: n.read ? 400 : 600,
                        color: "#0D1421",
                      }}
                    >
                      {n.message}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {n.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Content ── */}
          <div
            onClick={() => showNotifications && setShowNotifications(false)}
            style={{
              flex: 1,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {renderContent()}
            <div style={{ height: 24 }} />
          </div>

          {/* ── Bottom Nav ── */}
          <div
            style={{
              background: "white",
              borderTop: "1px solid #F0F2F5",
              paddingBottom: 24,
              paddingTop: 8,
              display: "flex",
              flexShrink: 0,
              zIndex: 30,
            }}
          >
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setActiveTab(id);
                    setShowNotifications(false);
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: active ? "#EEF3FF" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      size={20}
                      color={active ? "#0052FF" : "#9CA3AF"}
                      strokeWidth={active ? 2.5 : 1.8}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: active ? "#0052FF" : "#9CA3AF",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          {/* ── Splash screen (first launch overlay) ── */}
          {showSplash && <Splash onDone={() => setShowSplash(false)} />}

          {/* ── Wallet action modals ── */}
          {activeModal === "swap"  && <SwapModal  onClose={() => setActiveModal(null)} />}
          {activeModal === "send"  && <SendModal  onClose={() => setActiveModal(null)} />}
          {activeModal === "claim" && <ClaimModal onClose={() => setActiveModal(null)} />}
          {activeModal === "slash" && <SlashModal onClose={() => setActiveModal(null)} />}
        </div>
      </div>

      <Toaster
        position="top-center"
        visibleToasts={1}
        richColors
        toastOptions={{
          style: { borderRadius: 14, fontFamily: "inherit", fontSize: 14 },
        }}
      />
    </NodeProvider>
  );
}
