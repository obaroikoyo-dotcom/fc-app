import { useState } from "react";
import { hasSeenNotice, markNoticeSeen } from "../lib/demo/session";

// Shown once, the first time someone lands in the demo, so nobody mistakes
// the made-up people and money for real ones. Same card as the app's other
// bottom prompts.
export default function DemoNotice() {
  const [open, setOpen] = useState(() => !hasSeenNotice());
  if (!open) return null;

  const close = () => {
    markNoticeSeen();
    setOpen(false);
  };

  const button: React.CSSProperties = {
    flex: 1, padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textAlign: "center",
    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "none",
  };

  return (
    <div style={{
      position: "fixed", left: "1rem", right: "1rem", bottom: "calc(var(--nav-h) + 2.45rem)", zIndex: 9998,
      background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem",
      display: "flex", flexDirection: "column", gap: "0.75rem",
      fontFamily: "'TikTok Sans', 'Helvetica Neue', sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      <div>
        <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>You're looking at a demo</div>
        <div style={{ color: "#999", fontSize: "12px", lineHeight: 1.5 }}>
          Everything here is made up. Nothing is saved, no one else can see it, and payments are switched off.
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <a href="/" style={{ ...button, background: "#1a1a1a", color: "#999" }}>Create account</a>
        <div onClick={close} style={{ ...button, background: "#fff", color: "#0a0a0a" }}>Got it</div>
      </div>
    </div>
  );
}
