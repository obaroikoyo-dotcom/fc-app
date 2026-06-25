import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<"fadein" | "glitch" | "fadeout">("fadein");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("glitch"), 800);
    const t2 = setTimeout(() => setPhase("fadeout"), 2200);
    const t3 = setTimeout(() => onComplete(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
      opacity: phase === "fadeout" ? 0 : 1,
      transition: phase === "fadeout" ? "opacity 0.6s ease" : "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap');

        @keyframes glitch {
          0%   { transform: translate(0, 0) scale(1); filter: none; }
          10%  { transform: translate(-4px, 2px) scale(1.02); filter: hue-rotate(90deg) brightness(1.5); }
          20%  { transform: translate(4px, -2px) scale(0.98); filter: hue-rotate(180deg) brightness(0.8); }
          30%  { transform: translate(-2px, 4px) scale(1.01); filter: hue-rotate(270deg) brightness(1.3); }
          40%  { transform: translate(3px, -1px) scale(1); filter: invert(1); }
          50%  { transform: translate(-3px, 3px) scale(1.03); filter: hue-rotate(90deg) brightness(1.2); }
          60%  { transform: translate(2px, -3px) scale(0.99); filter: none; }
          70%  { transform: translate(-4px, 1px) scale(1.01); filter: hue-rotate(180deg) brightness(1.4); }
          80%  { transform: translate(1px, 2px) scale(1); filter: invert(0.5); }
          90%  { transform: translate(-1px, -2px) scale(1.02); filter: none; }
          100% { transform: translate(0, 0) scale(1); filter: none; }
        }

        @keyframes fadein {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }

        .splash-logo {
          animation: fadein 0.7s ease forwards;
        }

        .splash-logo.glitching {
          animation: glitch 1.4s steps(1) forwards;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
        <img
          src="./logo.png"
          className={`splash-logo${phase === "glitch" ? " glitching" : ""}`}
          style={{ width: "90px", height: "90px", objectFit: "contain" }}
        />
        <p style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "22px",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.02em",
          opacity: phase === "fadein" ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}>
          FlipCollab
        </p>
      </div>
    </div>
  );
}