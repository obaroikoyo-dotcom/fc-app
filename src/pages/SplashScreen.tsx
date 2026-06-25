import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<"draw" | "glitch" | "fadeout">("draw");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("glitch"), 1800);
    const t2 = setTimeout(() => setPhase("fadeout"), 3400);
    const t3 = setTimeout(() => onComplete(), 4100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
      opacity: phase === "fadeout" ? 0 : 1,
      transition: phase === "fadeout" ? "opacity 0.8s ease" : "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap');

        @keyframes draw {
          from { stroke-dashoffset: 1000; opacity: 0.2; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }

        @keyframes fillIn {
          from { fill-opacity: 0; }
          to   { fill-opacity: 1; }
        }

        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 6px #fff) drop-shadow(0 0 12px #fff); }
          50%       { filter: drop-shadow(0 0 18px #fff) drop-shadow(0 0 36px #aaa); }
        }

        @keyframes glitch1 {
          0%   { transform: translate(0, 0); opacity: 1; clip-path: inset(0 0 0 0); }
          8%   { transform: translate(-8px, 0); clip-path: inset(20% 0 50% 0); opacity: 1; }
          9%   { transform: translate(8px, 0);  clip-path: inset(60% 0 10% 0); opacity: 0.8; }
          10%  { transform: translate(0, 0);    clip-path: inset(0 0 0 0); opacity: 1; }
          18%  { transform: translate(6px, 2px); clip-path: inset(5% 0 70% 0); opacity: 1; }
          19%  { transform: translate(-6px, -2px); clip-path: inset(75% 0 0% 0); opacity: 0.7; }
          20%  { transform: translate(0, 0);    clip-path: inset(0 0 0 0); opacity: 1; }
          30%  { transform: translate(-10px, 0); clip-path: inset(30% 0 30% 0); opacity: 1; }
          31%  { transform: translate(10px, 0);  clip-path: inset(0 0 60% 0); opacity: 0.9; }
          32%  { transform: translate(0, 0);     clip-path: inset(0 0 0 0); opacity: 1; }
          45%  { transform: translate(4px, -4px); clip-path: inset(50% 0 20% 0); opacity: 1; }
          46%  { transform: translate(-4px, 4px); clip-path: inset(10% 0 55% 0); opacity: 0.8; }
          47%  { transform: translate(0, 0);      clip-path: inset(0 0 0 0); opacity: 1; }
          60%  { transform: translate(-12px, 0); clip-path: inset(40% 0 0% 0); opacity: 1; }
          61%  { transform: translate(12px, 0);  clip-path: inset(0% 0 40% 0); opacity: 0.75; }
          62%  { transform: translate(0, 0);     clip-path: inset(0 0 0 0); opacity: 1; }
          100% { transform: translate(0, 0);     clip-path: inset(0 0 0 0); opacity: 1; }
        }

        @keyframes glitch2 {
          0%   { transform: translate(0, 0); opacity: 0; clip-path: inset(0 0 0 0); }
          8%   { transform: translate(10px, 0); clip-path: inset(20% 0 50% 0); opacity: 0.6; filter: hue-rotate(180deg) brightness(2); }
          9%   { transform: translate(-10px, 0); clip-path: inset(60% 0 10% 0); opacity: 0.5; }
          10%  { opacity: 0; }
          18%  { transform: translate(-8px, -2px); clip-path: inset(5% 0 70% 0); opacity: 0.5; filter: hue-rotate(270deg) brightness(2); }
          19%  { transform: translate(8px, 2px); clip-path: inset(75% 0 0% 0); opacity: 0.4; }
          20%  { opacity: 0; }
          30%  { transform: translate(14px, 0); clip-path: inset(30% 0 30% 0); opacity: 0.55; filter: hue-rotate(90deg) brightness(3); }
          31%  { transform: translate(-14px, 0); clip-path: inset(0 0 60% 0); opacity: 0.45; }
          32%  { opacity: 0; }
          45%  { transform: translate(-6px, 5px); clip-path: inset(50% 0 20% 0); opacity: 0.5; filter: hue-rotate(180deg) brightness(2); }
          46%  { transform: translate(6px, -5px); clip-path: inset(10% 0 55% 0); opacity: 0.4; }
          47%  { opacity: 0; }
          60%  { transform: translate(16px, 0); clip-path: inset(40% 0 0% 0); opacity: 0.6; filter: hue-rotate(0deg) brightness(3); }
          61%  { transform: translate(-16px, 0); clip-path: inset(0% 0 40% 0); opacity: 0.5; }
          62%  { opacity: 0; }
          100% { opacity: 0; }
        }

        @keyframes scanline {
          0%   { top: -10%; opacity: 0.12; }
          100% { top: 110%; opacity: 0; }
        }

        .logo-wrap {
          position: relative;
          width: 140px;
          height: 140px;
          filter: drop-shadow(0 0 8px #fff) drop-shadow(0 0 20px #888);
        }

        .logo-main {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          animation: draw 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .logo-main.glitching {
          animation: glitch1 1.6s steps(1) forwards;
          filter: drop-shadow(0 0 10px #fff) drop-shadow(0 0 24px #fff);
        }

        .logo-ghost {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 0;
          mix-blend-mode: screen;
        }

        .logo-ghost.glitching {
          animation: glitch2 1.6s steps(1) forwards;
        }

        .scanline {
          position: absolute;
          left: -10px;
          right: -10px;
          height: 3px;
          background: rgba(255,255,255,0.15);
          animation: scanline 0.4s linear infinite;
          pointer-events: none;
        }

        .splash-text {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.5s ease, transform 0.5s ease;
          transition-delay: 0.8s;
        }

        .splash-text.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .splash-tagline {
          opacity: 0;
          transition: opacity 0.5s ease;
          transition-delay: 1.1s;
        }

        .splash-tagline.visible {
          opacity: 1;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
        <div className="logo-wrap">
          {phase === "glitch" && <div className="scanline" />}
          <img
            src="/logo.png"
            className={`logo-main${phase === "glitch" ? " glitching" : ""}`}
          />
          <img
            src="/logo.png"
            className={`logo-ghost${phase === "glitch" ? " glitching" : ""}`}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <p className={`splash-text${phase !== "draw" ? " visible" : ""}`} style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "26px",
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.02em",
            margin: 0,
          }}>
            FlipCollab
          </p>
          <p className={`splash-tagline${phase !== "draw" ? " visible" : ""}`} style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            color: "#444",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            margin: 0,
          }}>
            Creator × Brand
          </p>
        </div>
      </div>
    </div>
  );
}