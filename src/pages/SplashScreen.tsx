import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<"fadein" | "glitch" | "fadeout">("fadein");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("glitch"), 1200);
    const t2 = setTimeout(() => setPhase("fadeout"), 2200);
    const t3 = setTimeout(() => onComplete(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
      opacity: phase === "fadeout" ? 0 : 1,
      transition: phase === "fadeout" ? "opacity 0.9s ease" : "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap');

        @keyframes fadein {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }

        @keyframes glitch {
          0%   { clip-path: inset(0 0 100% 0); transform: translate(0, 0); }
          5%   { clip-path: inset(10% 0 60% 0); transform: translate(-4px, 0); }
          10%  { clip-path: inset(50% 0 20% 0); transform: translate(4px, 0); }
          15%  { clip-path: inset(20% 0 70% 0); transform: translate(-3px, 0); }
          20%  { clip-path: inset(70% 0 5% 0);  transform: translate(3px, 0); }
          25%  { clip-path: inset(0 0 0 0);      transform: translate(0, 0); }
          30%  { clip-path: inset(30% 0 40% 0); transform: translate(5px, 0); }
          35%  { clip-path: inset(0 0 0 0);      transform: translate(0, 0); }
          40%  { clip-path: inset(5% 0 80% 0);  transform: translate(-5px, 0); }
          45%  { clip-path: inset(0 0 0 0);      transform: translate(0, 0); }
          100% { clip-path: inset(0 0 0 0);      transform: translate(0, 0); }
        }

        @keyframes glitchRed {
          0%   { clip-path: inset(0 0 100% 0); transform: translate(0, 0); opacity: 0; }
          5%   { clip-path: inset(10% 0 60% 0); transform: translate(4px, 0); opacity: 0.4; }
          10%  { clip-path: inset(50% 0 20% 0); transform: translate(-4px, 0); opacity: 0.3; }
          15%  { clip-path: inset(20% 0 70% 0); transform: translate(3px, 0); opacity: 0.4; }
          20%  { clip-path: inset(70% 0 5% 0);  transform: translate(-3px, 0); opacity: 0.3; }
          25%  { opacity: 0; }
          30%  { clip-path: inset(30% 0 40% 0); transform: translate(-5px, 0); opacity: 0.4; }
          35%  { opacity: 0; }
          40%  { clip-path: inset(5% 0 80% 0);  transform: translate(5px, 0); opacity: 0.3; }
          45%  { opacity: 0; }
          100% { opacity: 0; }
        }

        .logo-fadein {
          animation: fadein 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .logo-glitch {
          animation: glitch 0.6s steps(1) forwards;
        }

        .logo-glitch-red {
          animation: glitchRed 0.6s steps(1) forwards;
          position: absolute;
          inset: 0;
          filter: hue-rotate(200deg) saturate(3);
          pointer-events: none;
        }

        .splash-text {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.5s ease 0.5s, transform 0.5s ease 0.5s;
        }

        .splash-text.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
        <div style={{ position: "relative", width: 120, height: 120 }}>
          <img
            src="/logo.png"
            className={phase === "fadein" ? "logo-fadein" : phase === "glitch" ? "logo-glitch" : ""}
            style={{ width: "120px", height: "120px", objectFit: "contain", display: "block" }}
          />
          {phase === "glitch" && (
            <img
              src="/logo.png"
              className="logo-glitch-red"
              style={{ width: "120px", height: "120px", objectFit: "contain" }}
            />
          )}
        </div>

        <p className={`splash-text${phase !== "fadein" ? " visible" : ""}`} style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "26px",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.02em",
          margin: 0,
        }}>
          FlipCollab
        </p>
      </div>
    </div>
  );
}