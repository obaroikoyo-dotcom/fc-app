import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { type Page } from "../App";

interface Props { navigate: (p: Page) => void; }

export default function RoleSelect({ navigate }: Props) {
  const [hovered, setHovered] = useState<"brand" | "creator" | null>(null);

  const card = (role: "brand" | "creator", title: string, sub: string, icon: string) => {
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
        <div style={{ fontSize: "28px", marginBottom: "12px" }}>{icon}</div>
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
        
        {/* Exact Logo Container Asset */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <svg 
            width="120" 
            height="74" 
            viewBox="0 0 120 74" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Upper sharp loop piece */}
            <path 
              d="M36.5 56.5 L31.5 61.5 L31.5 52 L59.5 24 L79.5 24 L89 33.5 L56.5 33.5 L47 43 L63.5 43 L54.5 52.5 L36.5 56.5 Z" 
              fill="#FFFFFF" 
            />
            {/* Lower sharp loop piece matching the image flip */}
            <path 
              d="M83.5 17.5 L88.5 12.5 L88.5 22 L60.5 50 L40.5 50 L31 40.5 L63.5 40.5 L73 31 L56.5 31 L65.5 21.5 L83.5 17.5 Z" 
              fill="#FFFFFF" 
            />
            {/* Distinct middle split stroke line */}
            <line 
              x1="31" 
              y1="67" 
              x2="89" 
              y2="9" 
              stroke="#0A0A0A" 
              strokeWidth="4" 
            />
          </svg>
        </div>

        <p style={{
          textAlign: "center",
          fontSize: "13px",
          color: "#444",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "2rem",
        }}>Who are you?</p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {card("brand", "I'm a Brand", "Post campaigns and find the right creators for your product.", "◈")}
          {card("creator", "I'm a Creator", "Apply to brand collabs and grow your portfolio.", "◉")}
        </div>

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