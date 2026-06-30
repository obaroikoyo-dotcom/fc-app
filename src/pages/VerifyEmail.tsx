import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { type Page } from "../App";

interface Props {
  navigate: (p: Page) => void;
  email: string;
}

export default function VerifyEmail({ navigate, email }: Props) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (idx: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...code];
    next[idx] = value;
    setCode(next);
    setError("");
    if (value && idx < 5) inputsRef.current[idx + 1]?.focus();
    if (next.every(c => c !== "") && idx === 5) verify(next.join(""));
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
    setCode(next);
    const lastIdx = Math.min(pasted.length, 6) - 1;
    inputsRef.current[lastIdx]?.focus();
    if (pasted.length === 6) verify(pasted);
  };

  const verify = async (otp: string) => {
    setLoading(true);
    setError("");

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });

    if (verifyError) {
      setError("Invalid or expired code. Try again.");
      setLoading(false);
      setCode(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
      return;
    }

    if (data.session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();

      setLoading(false);
      if (profile?.role === "brand") navigate("brand-dashboard");
      else navigate("explore");
    } else {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (resendError) {
      setError("Couldn't resend code. Try again shortly.");
    } else {
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { transform: scale(0.85); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .verify-card { animation: fadeInUp 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .otp-box { animation: popIn 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; animation-fill-mode: both; }
        .otp-error { animation: shake 0.4s ease; }
        .otp-box:nth-child(1) { animation-delay: 0.05s; }
        .otp-box:nth-child(2) { animation-delay: 0.10s; }
        .otp-box:nth-child(3) { animation-delay: 0.15s; }
        .otp-box:nth-child(4) { animation-delay: 0.20s; }
        .otp-box:nth-child(5) { animation-delay: 0.25s; }
        .otp-box:nth-child(6) { animation-delay: 0.30s; }
      `}</style>

      <div className="verify-card" style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}>

        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "2.5rem", letterSpacing: "-0.02em" }}>FlipCollab</p>

        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "16px", padding: "2.5rem 2rem" }}>

          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#1a1a1a", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", fontSize: "20px", color: "#fff" }}>
            #
          </div>

          <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#444", marginBottom: "1rem" }}>One more step</p>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.75rem" }}>Enter your code</h1>

          <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7, marginBottom: "2rem" }}>
            We sent a 6-digit code to <span style={{ color: "#fff", fontWeight: 600 }}>{email}</span>. Enter it below to activate your account.
          </p>

          <div className={error ? "otp-error" : ""} style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "1.25rem" }}>
            {code.map((digit, idx) => (
              <input
                key={idx}
                className="otp-box"
                ref={el => { inputsRef.current[idx] = el; }}
                value={digit}
                onChange={e => handleChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                inputMode="numeric"
                maxLength={1}
                disabled={loading}
                style={{
                  width: "44px",
                  height: "52px",
                  textAlign: "center",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "#0a0a0a",
                  border: `1px solid ${error ? "#ff3b30" : digit ? "#fff" : "#222"}`,
                  borderRadius: "10px",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s",
                }}
              />
            ))}
          </div>

          {error && <p style={{ fontSize: "12px", color: "#ff3b30", marginBottom: "1rem" }}>{error}</p>}

          {loading && <p style={{ fontSize: "12px", color: "#555", marginBottom: "1rem" }}>Verifying...</p>}

          <div style={{ height: "1px", background: "#1a1a1a", marginBottom: "1.5rem" }} />

          <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.6, marginBottom: "1rem" }}>
            Didn't get it? Check your spam folder, or
          </p>

          <div
            onClick={resending ? undefined : handleResend}
            style={{ padding: "13px", borderRadius: "8px", background: "transparent", border: "1px solid #222", color: resent ? "#34c759" : "#fff", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: resending ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px", opacity: resending ? 0.6 : 1, transition: "all 0.2s" }}
          >
            {resending ? "Sending..." : resent ? "Code resent" : "Resend code"}
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