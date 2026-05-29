import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { type Page } from "../App";
// 1. Import your image file here (adjust the path if your file is in a different folder)
import logoImg from "../assets/logo.png"; 

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
        
        {/* 2. Image Logo Wrapper */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
          <img 
            src={logoImg} 
            alt="Platform Logo" 
            style={{ 
              width: "120px",    // Adjust this to make it bigger or smaller
              height: "auto", 
              objectFit: "contain" 
            }} 
          />
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