import { type InputHTMLAttributes, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function Input({ label, type, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: focused ? "#fff" : "#555",
        transition: "color 0.2s",
      }}>{label}</label>
      <input
        type={type}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: "#111",
          border: `1px solid ${focused ? "#fff" : "#222"}`,
          borderRadius: "8px",
          padding: "12px 14px",
          color: "#fff",
          fontSize: "14px",
          outline: "none",
          transition: "border-color 0.2s",
          width: "100%",
        }}
        {...props}
      />
    </div>
  );
}