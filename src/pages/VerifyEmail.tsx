import { supabase } from "../lib/supabase";
import { type Page } from "../App";

interface Props { navigate: (p: Page) => void; }

export default function VerifyEmail({ navigate }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      <div style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}>

        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "2.5rem", letterSpacing: "-0.02em" }}>FlipCollab</p>

        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "16px", padding: "2.5rem 2rem" }}>

          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#1a1a1a", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", fontSize: "22px" }}>
            ✉️
          </div>

          <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#444", marginBottom: "1rem" }}>One more step</p>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.75rem" }}>Verify your email</h1>

          <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7, marginBottom: "2rem" }}>We've sent a confirmation link to your inbox. Click it to activate your account and start using FlipCollab.</p>

          <div style={{ height: "1px", background: "#1a1a1a", marginBottom: "1.5rem" }} />

          <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.6, marginBottom: "1.5rem" }}>Didn't get it? Check your spam folder. The link expires in 24 hours.</p>

          <div
            onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
                if (profile?.role === "brand") navigate("brand-dashboard");
                else navigate("explore");
              }
            }}
            style={{ padding: "13px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}
          >
            I've confirmed my email
          </div>

          <div
            onClick={() => navigate("role-select")}
            style={{ padding: "13px", borderRadius: "8px", background: "transparent", border: "1px solid #222", color: "#555", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Back to Sign In
          </div>

        </div>

        <p style={{ fontSize: "11px", color: "#333", marginTop: "1.5rem" }}>If you didn't create an account you can safely ignore this.</p>

      </div>
    </div>
  );
}