import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<"fadein" | "shake" | "fadeout">("fadein");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("shake"), 1000);
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
      transition: phase === "fadeout" ? "opacity 0.8s ease" : "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400&display=swap');

        @keyframes fadein {
          from { opacity: 0; transform: scale(0.9); }
          to   { opacity: 1; transform: scale(1); }
        }

        @keyframes rumble {
          0%   { transform: translate(0, 0) rotate(0deg); }
          10%  { transform: translate(-3px, 1px) rotate(-1deg); }
          20%  { transform: translate(3px, -1px) rotate(1deg); }
          30%  { transform: translate(-2px, 2px) rotate(-0.5deg); }
          40%  { transform: translate(4px, -2px) rotate(1.5deg); }
          50%  { transform: translate(-4px, 1px) rotate(-1deg); }
          60%  { transform: translate(2px, 3px) rotate(0.5deg); }
          70%  { transform: translate(-3px, -1px) rotate(-1.5deg); }
          80%  { transform: translate(3px, 2px) rotate(1deg); }
          90%  { transform: translate(-1px, -2px) rotate(-0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }

        .logo-fadein {
          animation: fadein 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .logo-rumble {
          animation: rumble 0.08s linear infinite, pulse 0.4s ease-in-out infinite;
        }

        .splash-text {
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s;
        }

        .splash-text.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .splash-tagline {
          opacity: 0;
          transition: opacity 0.5s ease 0.7s;
        }

        .splash-tagline.visible {
          opacity: 1;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
        <img
          src="/logo.png"
          className={phase === "fadein" ? "logo-fadein" : phase === "shake" ? "logo-rumble" : ""}
          style={{ width: "130px", height: "130px", objectFit: "contain" }}
        />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
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
          <p className={`splash-tagline${phase !== "fadein" ? " visible" : ""}`} style={{
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