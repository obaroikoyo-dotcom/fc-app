import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import logo from "../assets/logo.png";
import { startDemoSession } from "../lib/demo/session";
import type { DemoRole } from "../lib/demo/mode";

const BuildingIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="3" width="10" height="18" rx="1" stroke="currentColor" strokeWidth="1.6" />
    <path d="M15 9h4v12H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M17.5 12.5h1M17.5 15.5h1M17.5 18.5h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const CreatorIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// The page at /demo. It only lets someone pick which side of FlipCollab to
// look around; /demo/brand and /demo/creator skip it and go straight in.
export default function DemoEntry() {
  const [hovered, setHovered] = useState<DemoRole | null>(null);

  const choose = (role: DemoRole) => {
    startDemoSession(role);
    // A full load, so the app boots as that person from the start.
    window.location.assign(`/demo/${role}`);
  };

  const card = (role: DemoRole, title: string, sub: string, icon: React.ReactNode) => {
    const isHovered = hovered === role;
    return (
      <div
        onClick={() => choose(role)}
        onMouseEnter={() => setHovered(role)}
        onMouseLeave={() => setHovered(null)}
        style={{
          border: `1px solid ${isHovered ? "#fff" : "#222"}`,
          borderRadius: "12px",
          padding: "2rem 1.5rem",
          cursor: "pointer",
          transition: "all 0.2s",
          background: isHovered ? "#111" : "transparent",
          flex: 1,
          minWidth: "200px",
        }}
      >
        <div style={{ color: "#fff", marginBottom: "12px" }}>{icon}</div>
        <p style={{ fontFamily: "'TikTok Sans', sans-serif", fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>{title}</p>
        <p style={{ fontSize: "13px", color: "#999", lineHeight: 1.5 }}>{sub}</p>
      </div>
    );
  };

  return (
    <AuthLayout>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <img src={logo} className="no-reinvert" style={{ width: "150px", display: "block", margin: "0 auto 1rem" }} />
        <p style={{ fontFamily: "'TikTok Sans', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: "1.5rem" }}>FlipCollab</p>
        <p style={{ textAlign: "center", fontSize: "13px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2rem" }}>Try the demo</p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {card("brand", "I'm a Brand", "Post a campaign and review applications from creators.", BuildingIcon)}
          {card("creator", "I'm a Creator", "Browse campaigns, apply, and see how payment works.", CreatorIcon)}
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "13px", color: "#888", lineHeight: 1.6 }}>
          You get a made-up profile with sample campaigns, chats and payments. Nothing is saved, no one else can see it, and no money moves.
        </p>
        <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "13px", color: "#888" }}>
          Ready for the real thing?{" "}
          <a href="/" style={{ color: "#fff", textDecoration: "underline" }}>Create an account</a>
        </p>
      </div>
    </AuthLayout>
  );
}
