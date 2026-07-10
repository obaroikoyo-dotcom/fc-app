import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/Button";
import logo from "../assets/logo.png";
import { type Page } from "../App";
import { signInWithGoogle } from "../lib/supabase";

const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

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
<p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: "2rem" }}>FlipCollab</p>
        <p style={{
          textAlign: "center",
          fontSize: "13px",
          color: "#444",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "2rem",
        }}>Who are you?</p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {card("brand", "I'm a Brand", "Post campaigns and find the right creators for your product.", BuildingIcon)}
          {card("creator", "I'm a Creator", "Apply to brand collabs and grow your portfolio.", CreatorIcon)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "2rem 0 1.5rem" }}>
          <div style={{ flex: 1, height: "1px", background: "#222" }} />
          <span style={{ fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "#222" }} />
        </div>

        <Button variant="outline" onClick={signInWithGoogle} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          {GoogleIcon} Continue with Google
        </Button>

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "13px", color: "#444" }}>
          Already have an account?{" "}
          <span
            onClick={() => navigate("login")}
            style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}
          >
            Sign in
          </span>
        </p>
      </div>
    </AuthLayout>
  );
}     