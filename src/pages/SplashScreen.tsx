import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<"fadein" | "glitch" | "fadeout">("fadein");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("glitch"), 1000);
    const t2 = setTimeout(() => setPhase("fadeout"), 2800);
    const t3 = setTimeout(() => onComplete(), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
      opacity: phase === "fadeout" ? 0 : 1,
      transition: phase === "fadeout" ? "opacity 0.7s ease" : "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap');

        @keyframes fadein {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }

        @keyframes glitch {
          0%   { clip-path: inset(0 0 100% 0); transform: translate(0); opacity: 1; }
          5%   { clip-path: inset(10% 0 60% 0); transform: translate(-6px, 2px); opacity: 0.9; }
          10%  { clip-path: inset(40% 0 30% 0); transform: translate(6px, -2px); opacity: 1; }
          15%  { clip-path: inset(70% 0 5% 0);  transform: translate(-4px, 3px); opacity: 0.85; }
          20%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
          25%  { clip-path: inset(20% 0 50% 0);  transform: translate(8px, 0); opacity: 0.9; }
          30%  { clip-path: inset(55% 0 20% 0);  transform: translate(-8px, 1px); opacity: 1; }
          35%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
          40%  { clip-path: inset(30% 0 40% 0);  transform: translate(5px, -3px); opacity: 0.8; }
          45%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
          50%  { clip-path: inset(60% 0 10% 0);  transform: translate(-5px, 2px); opacity: 0.9; }
          55%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
          60%  { clip-path: inset(15% 0 70% 0);  transform: translate(4px, -1px); opacity: 0.85; }
          65%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
          70%  { clip-path: inset(80% 0 2% 0);   transform: translate(-3px, 3px); opacity: 0.9; }
          75%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
          80%  { clip-path: inset(45% 0 25% 0);  transform: translate(6px, -2px); opacity: 0.8; }
          85%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
          90%  { clip-path: inset(5% 0 80% 0);   transform: translate(-4px, 1px); opacity: 0.9; }
          95%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
          100% { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 1; }
        }

        @keyframes glitch-red {
          0%   { clip-path: inset(0 0 100% 0); transform: translate(0); opacity: 0; }
          5%   { clip-path: inset(10% 0 60% 0); transform: translate(6px, -2px); opacity: 0.4; }
          10%  { clip-path: inset(40% 0 30% 0); transform: translate(-6px, 2px); opacity: 0; }
          15%  { clip-path: inset(70% 0 5% 0);  transform: translate(4px, -3px); opacity: 0.3; }
          20%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 0; }
          25%  { clip-path: inset(20% 0 50% 0);  transform: translate(-8px, 0); opacity: 0.35; }
          30%  { clip-path: inset(0 0 0 0);      transform: translate(0); opacity: 0; }
          100% { opacity: 0; }
        }

        .splash-logo {
          animation: fadein 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .splash-logo.glitching {
          animation: glitch 1.8s steps(1) forwards;
        }

        .splash-logo-red {
          position: absolute;
          filter: hue-rotate(0deg) saturate(10) brightness(2);
          mix-blend-mode: screen;
          opacity: 0;
        }

        .splash-logo-red.glitching {
          animation: glitch-red 1.8s steps(1) forwards;
        }

        .splash-text {
          opacity: 0;
          transition: opacity 0.6s ease;
        }

        .splash-text.visible {
          opacity: 1;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
        <div style={{ position: "relative", width: "120px", height: "120px" }}>
          <img
            src="/logo.png"
            className={`splash-logo${phase === "glitch" ? " glitching" : ""}`}
            style={{ width: "120px", height: "120px", objectFit: "contain", position: "relative", zIndex: 2 }}
          />
          <img
            src="/logo.png"
            className={`splash-logo-red${phase === "glitch" ? " glitching" : ""}`}
            style={{ width: "120px", height: "120px", objectFit: "contain", position: "absolute", top: 0, left: 0, zIndex: 1 }}
          />
        </div>
        <p className={`splash-text${phase !== "fadein" ? " visible" : ""}`} style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "24px",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.02em",
        }}>
          FlipCollab
        </p>
      </div>
    </div>
  );
}