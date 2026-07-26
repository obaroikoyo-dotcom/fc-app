import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import logo from "../assets/logo.png";
import { type Page } from "../App";

interface Props { navigate: (p: Page) => void; }

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

export default function RoleSelect({ navigate }: Props) {
  const [hovered, setHovered] = useState<"brand" | "creator" | null>(null);

  const card = (role: "brand" | "creator", title: string, sub: string, icon: React.ReactNode) => {
    const isHovered = hovered === role;
    return (
      <div
        onClick={() => navigate(role === "brand" ? "brand-onboarding" : "creator-onboarding")}
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
        <p style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "18px",
          fontWeight: 700,
          color: "#fff",
          marginBottom: "6px",
        }}>{title}</p>
        <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.5 }}>{sub}</p>
      </div>
    );
  };

  return (
    <AuthLayout>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <img src={logo} className="no-reinvert" style={{ width: "150px", display: "block", margin: "0 auto 1rem" }} />
<p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: "0.75rem" }}>FlipCollab</p>
        <p style={{ textAlign: "center", fontSize: "13px", color: "#555", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          FlipCollab is a marketplace connecting brands with content creators for paid and gifted collaborations.
        </p>
        <p style={{
          textAlign: "center",
          fontSize: "13px",
          color: "#444",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "2rem",
        }}>Who are you?</p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {card("brand", "I'm a Brand", "Post campaigns and find creators who match your product.", BuildingIcon)}
          {card("creator", "I'm a Creator", "Apply to brand campaigns and grow your creator portfolio.", CreatorIcon)}
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "13px", color: "#444" }}>
          Already have an account?{" "}
          <span
            onClick={() => navigate("login")}
            style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}
          >
            Log in
          </span>
        </p>
      </div>
    </AuthLayout>
  );
}     