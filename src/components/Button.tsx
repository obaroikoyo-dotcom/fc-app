import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "outline";
}

export default function Button({ children, variant = "primary", style, ...props }: ButtonProps) {
  return (
    <button
      style={{
        width: "100%",
        padding: "13px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "inherit",
        background: variant === "primary" ? "#fff" : "transparent",
        color: variant === "primary" ? "#0a0a0a" : "#fff",
        border: variant === "primary" ? "1px solid #fff" : "1px solid #333",
        ...style,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        if (variant === "primary") { el.style.background = "#e0e0e0"; }
        else { el.style.borderColor = "#fff"; }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        if (variant === "primary") { el.style.background = "#fff"; }
        else { el.style.borderColor = "#333"; }
      }}
      {...props}
    >
      {children}
    </button>
  );
}