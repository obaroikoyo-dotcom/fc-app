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
        
        {/* Seamless Logo & Brand Name Header Section */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          gap: "12px",
          marginBottom: "1.5rem"
        }}>
          {/* Custom SVG interpretation of your geometric arrows logo */}
          <svg 
            width="54" 
            height="54" 
            viewBox="0 0 100 100" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block" }}
          >
            {/* Outer Hex/Rhombus Boundary */}
            <path 
              d="M75 25 L45 42 L45 55 L75 38 Z" 
              fill="#fff" 
            />
            <path 
              d="M25 75 L55 58 L55 45 L25 62 Z" 
              fill="#fff" 
            />
            {/* Directing Lines and Arrows */}
            <path 
              d="M25 70 L70 25 M70 25 L58 25 M70 25 L70 37" 
              stroke="#fff" 
              strokeWidth="6" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M75 30 L30 75 M30 75 L42 75 M30 75 L30 63" 
              stroke="#fff" 
              strokeWidth="6" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>

          {/* Optional Typography placeholder for your platform name */}
          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "22px",
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            margin: 0
          }}>
            Ecosystem
          </h1>
        </div>

        <p style={{
          textAlign: "center",
          fontSize: "12px",
          color: "#444",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: "2.5rem",
        }}>Who are you?</p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {card("brand", "I'm a Brand", "Post campaigns and find the right creators for your product.", "◈")}
          {card("creator", "I'm a Creator", "Apply to brand collabs and grow your portfolio.", "◉")}
        </div>

        <p style={{ textAlign: "center", marginTop: "2.5rem", fontSize: "13px", color: "#444" }}>
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