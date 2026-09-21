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
        // Pill-shaped, with a 2px border (and 1px less padding to match) so
        // it has the same chunky outline as the buttons on the landing page.
        padding: "12px",
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
        fontFamily: "inherit",
        background: variant === "primary" ? "#fff" : "transparent",
        color: variant === "primary" ? "#0a0a0a" : "#fff",
        border: variant === "primary" ? "2px solid #fff" : "2px solid #2b2b2b",
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
        else { el.style.borderColor = "#2b2b2b"; }
      }}
      {...props}
    >
      {children}
    </button>
  );
}