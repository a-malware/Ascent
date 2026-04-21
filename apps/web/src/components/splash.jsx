"use client";
import { useState, useEffect } from "react";

// ── Deterministic particle data (SSR-safe, no hydration mismatch) ─────────────
function ihash(n) { return ((n * 2654435761) >>> 0); }
const PARTICLE_COLORS = [
  "rgba(0,82,255,0.10)",
  "rgba(0,56,232,0.07)",
  "rgba(5,196,143,0.08)",
  "rgba(0,82,255,0.06)",
  "rgba(77,139,255,0.09)",
];
const PARTICLES = Array.from({ length: 38 }, (_, i) => {
  const h1 = ihash(i);
  const h2 = ihash(i + 77);
  const h3 = ihash(i + 199);
  return {
    id:       i,
    x:        h1 % 100,
    y:        25 + (h2 % 85),
    size:     ((h3 % 24) + 8) / 10,   // 0.8 – 3.2 px
    duration: (h1 % 10) + 12,          // 12 – 22 s
    delay:    -((h2 % 100) / 10),      // pre-seeded so screen looks alive immediately
    color:    PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  };
});

// ── Soft ascending chime via Web Audio API ────────────────────────────────────
function playChime() {
  try {
    const ctx    = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.09;
    master.connect(ctx.destination);
    [[523.25, 0], [659.25, 0.28], [783.99, 0.56], [1046.5, 0.88]].forEach(([freq, t]) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0,     ctx.currentTime + t);
      env.gain.linearRampToValueAtTime(1,     ctx.currentTime + t + 0.06);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.75);
      osc.connect(env);
      env.connect(master);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime  + t + 0.85);
    });
  } catch (_) { /* no audio support – silent fallback */ }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Splash({ onDone }) {
  const [fadeOut,   setFadeOut]   = useState(false);
  const [taglineIn, setTaglineIn] = useState(false);
  const [footerIn,  setFooterIn]  = useState(false);

  useEffect(() => {
    playChime();
    const t1 = setTimeout(() => setTaglineIn(true), 680);
    const t2 = setTimeout(() => setFooterIn(true),  920);
    const t3 = setTimeout(() => setFadeOut(true),   2750);
    const t4 = setTimeout(() => onDone?.(),         3080);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      style={{
        // Sits inside the 430px phone shell (parent has position:relative)
        position:       "absolute",
        inset:          0,
        zIndex:         100,
        // App background color
        background:     "#F5F7FA",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        overflow:       "hidden",
        opacity:        fadeOut ? 0 : 1,
        transition:     "opacity 0.38s cubic-bezier(0.4,0,0.2,1)",
        // App font stack
        fontFamily:     "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ── CSS Keyframes ──────────────────────────────────────────────────── */}
      <style>{`
        @keyframes ascent-particle-rise {
          from { transform: translateY(0);      opacity: 1; }
          88%  { opacity: 1; }
          to   { transform: translateY(-110vh); opacity: 0; }
        }
        @keyframes ascent-orb-enter {
          0%   { transform: scale(0.6);  opacity: 0; }
          55%  { transform: scale(1.06); opacity: 1; }
          78%  { transform: scale(0.97); }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes ascent-ring-cw {
          to { transform: rotate(360deg); }
        }
        @keyframes ascent-ring-ccw {
          to { transform: rotate(-360deg); }
        }
        @keyframes ascent-glow-breathe {
          0%,100% {
            box-shadow:
              0 0 50px 8px  rgba(0,82,255,0.32),
              0 0 110px 18px rgba(0,56,232,0.16),
              inset 0 0 40px rgba(77,139,255,0.12);
          }
          50% {
            box-shadow:
              0 0 75px 16px rgba(0,82,255,0.46),
              0 0 160px 36px rgba(0,56,232,0.24),
              inset 0 0 65px rgba(77,139,255,0.20);
          }
        }
        @keyframes ascent-text-glow {
          0%,100% { text-shadow: 0 2px 16px rgba(0,82,255,0.40); }
          50%      { text-shadow: 0 2px 32px rgba(0,82,255,0.70), 0 0 60px rgba(77,139,255,0.30); }
        }
        @keyframes ascent-bg-radial {
          0%,100% { opacity: 0.55; }
          50%      { opacity: 0.90; }
        }
        @keyframes ascent-badge-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(5,196,143,0); }
          50%      { box-shadow: 0 0 0 8px rgba(5,196,143,0.12); }
        }
      `}</style>

      {/* ── Background radial glow (matches app blue) ────────────────────── */}
      <div style={{
        position:      "absolute",
        inset:         0,
        background:    "radial-gradient(ellipse 60% 50% at 50% 48%, rgba(0,82,255,0.07) 0%, rgba(0,56,232,0.03) 55%, transparent 80%)",
        animation:     "ascent-bg-radial 3.4s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* ── White card layer for subtle depth ───────────────────────────────── */}
      <div style={{
        position:     "absolute",
        top: "10%", bottom: "10%", left: "8%", right: "8%",
        borderRadius: 36,
        background:   "rgba(255,255,255,0.55)",
        backdropFilter: "blur(20px)",
        pointerEvents:"none",
      }} />

      {/* ── Particle field ──────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {PARTICLES.map(p => (
          <div
            key={p.id}
            style={{
              position:     "absolute",
              left:         `${p.x}%`,
              top:          `${p.y}%`,
              width:        p.size,
              height:       p.size,
              borderRadius: "50%",
              background:   p.color,
              animation:    `ascent-particle-rise ${p.duration}s ${p.delay}s linear infinite`,
            }}
          />
        ))}
      </div>

      {/* ── Central stack ───────────────────────────────────────────────────── */}
      <div style={{
        position:       "relative",
        zIndex:         10,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            32,
      }}>
        {/* Orb + rings wrapper */}
        <div style={{
          position:       "relative",
          width:          256,
          height:         256,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}>
          {/* Ambient outer ring */}
          <div style={{
            position:     "absolute",
            inset:        -14,
            borderRadius: "50%",
            border:       "1px solid rgba(0,82,255,0.08)",
          }} />

          {/* Green clockwise rotating ring (accent — matches rep badge) */}
          <div style={{
            position:          "absolute",
            inset:             0,
            borderRadius:      "50%",
            border:            "2.5px solid transparent",
            borderTopColor:    "#05C48F",
            borderRightColor:  "rgba(5,196,143,0.40)",
            borderBottomColor: "rgba(5,196,143,0.08)",
            borderLeftColor:   "transparent",
            animation:         "ascent-ring-cw 3.0s linear infinite",
          }} />

          {/* Blue counter-rotating inner ring */}
          <div style={{
            position:          "absolute",
            inset:             14,
            borderRadius:      "50%",
            border:            "1px solid transparent",
            borderTopColor:    "rgba(0,82,255,0.30)",
            borderBottomColor: "rgba(0,82,255,0.08)",
            animation:         "ascent-ring-ccw 5.5s linear infinite",
          }} />

          {/* ── THE ORB ───────────────────────────────────────────────────── */}
          <div style={{
            width:        220,
            height:       220,
            borderRadius: "50%",
            flexShrink:   0,
            background: [
              // Specular highlight top-left
              "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.32) 0%, transparent 44%)",
              // Secondary refraction bottom-right
              "radial-gradient(circle at 72% 76%, rgba(77,139,255,0.14) 0%, transparent 38%)",
              // Core: app's brand blue gradient
              "radial-gradient(circle at center, #1A6BFF 0%, #0052FF 30%, #0038E8 62%, #001A80 100%)",
            ].join(", "),
            animation: [
              "ascent-orb-enter 0.95s cubic-bezier(0.22,1.5,0.42,1) forwards",
              "ascent-glow-breathe 2.8s ease-in-out 1.1s infinite",
            ].join(", "),
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            position:       "relative",
            overflow:       "hidden",
          }}>
            {/* Inner precision ring */}
            <div style={{
              position:      "absolute",
              inset:         18,
              borderRadius:  "50%",
              border:        "1px solid rgba(255,255,255,0.12)",
              pointerEvents: "none",
            }} />

            {/* Specular arc highlight */}
            <div style={{
              position:      "absolute",
              top:           18,
              left:          16,
              width:         88,
              height:        48,
              borderRadius:  "50%",
              background:    "radial-gradient(ellipse at center, rgba(255,255,255,0.30) 0%, transparent 72%)",
              transform:     "rotate(-22deg)",
              pointerEvents: "none",
            }} />

            {/* Bottom rim glow */}
            <div style={{
              position:      "absolute",
              bottom:        14,
              left:          "22%",
              right:         "22%",
              height:        10,
              borderRadius:  "50%",
              background:    "radial-gradient(ellipse at center, rgba(77,139,255,0.28) 0%, transparent 100%)",
              pointerEvents: "none",
            }} />

            {/* ASCENT text */}
            <span style={{
              color:         "rgba(255,255,255,0.97)",
              fontSize:      26,
              fontWeight:    800,
              letterSpacing: "7px",
              fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              animation:     "ascent-text-glow 2.8s ease-in-out 1.2s infinite",
              position:      "relative",
              zIndex:        2,
              userSelect:    "none",
            }}>
              ASCENT
            </span>
          </div>
        </div>

        {/* ── "Proof of Reputation" badge ──────────────────────────────────── */}
        <div style={{
          opacity:    taglineIn ? 1 : 0,
          transform:  taglineIn ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
          display:    "flex",
          flexDirection: "column",
          alignItems: "center",
          gap:        10,
        }}>
          {/* Tagline */}
          <span style={{
            color:         "#0D1421",
            fontSize:      18,
            fontWeight:    700,
            letterSpacing: "0.3px",
            textAlign:     "center",
          }}>
            Reputation is the new stake.
          </span>

          {/* Sub-tagline pill */}
          <div style={{
            background:   "#EEF3FF",
            borderRadius: 20,
            padding:      "5px 14px",
            display:      "flex",
            alignItems:   "center",
            gap:          6,
            animation:    "ascent-badge-pulse 2.2s ease-in-out 1.5s infinite",
          }}>
            <div style={{
              width:        7,
              height:       7,
              borderRadius: "50%",
              background:   "#05C48F",
              boxShadow:    "0 0 8px rgba(5,196,143,0.6)",
            }} />
            <span style={{
              fontSize:  11,
              fontWeight: 700,
              color:     "#0052FF",
              letterSpacing: "0.5px",
            }}>
              PROOF OF REPUTATION NETWORK
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div style={{
        position:      "absolute",
        bottom:        44,
        left:          0,
        right:         0,
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           4,
        zIndex:        10,
        opacity:       footerIn ? 0.5 : 0,
        transition:    "opacity 1.0s ease",
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {/* Solana gradient logo */}
          <svg width="14" height="11" viewBox="0 0 40 30" fill="none" aria-label="Solana">
            <defs>
              <linearGradient id="ascent-sol-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#9945FF"/>
                <stop offset="100%" stopColor="#14F195"/>
              </linearGradient>
            </defs>
            <path d="M6 26 L34 26 C36.5 26 37.5 25 39 23 L40.5 21 L12 21 C9.5 21 8.5 22 7 24 Z"           fill="url(#ascent-sol-grad)"/>
            <path d="M6 16 L34 16 C36.5 16 37.5 15 39 13 L40.5 11 L12 11 C9.5 11 8.5 12 7 14 Z"           fill="url(#ascent-sol-grad)"/>
            <path d="M39.5 3.5 L11 3.5 C8.5 3.5 7.5 4.5 6 6.5 L4.5 8.5 L33 8.5 C35.5 8.5 36.5 7.5 38 5.5 Z" fill="url(#ascent-sol-grad)"/>
          </svg>
          <span style={{
            color:         "#6B7280",
            fontSize:      11,
            fontWeight:    500,
            letterSpacing: "0.2px",
          }}>
            Powered by Solana
          </span>
        </div>
      </div>

      {/* ── Version ─────────────────────────────────────────────────────────── */}
      <div style={{
        position:   "absolute",
        bottom:     14,
        right:      20,
        zIndex:     10,
        color:      "rgba(0,0,0,0.12)",
        fontSize:   9,
        fontFamily: "monospace",
        userSelect: "none",
        opacity:    footerIn ? 1 : 0,
        transition: "opacity 1.4s ease 0.5s",
      }}>
        v0.1.0-beta
      </div>
    </div>
  );
}
