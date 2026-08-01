import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import Logo from "../components/Logo";
import Input from "../components/Input";
import Button from "../components/Button";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

export default function ForgotPassword({ navigate }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setError("");
    if (!email.trim()) return setError("Enter your email address.");

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://flipcollab.com/",
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } catch (e) {
      setError("Something went wrong. Please check your connection and try again.");
      console.log("Reset password error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <Logo />
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Reset your password</p>

        {sent ? (
          <>
            <p style={{ fontSize: "13px", color: "#777", marginBottom: "2rem", lineHeight: 1.6 }}>
              If an account exists for <strong style={{ color: "#fff" }}>{email}</strong>, we've sent a link to reset your password. Check your inbox.
            </p>
            <Button variant="outline" onClick={() => navigate("login")}>Back to Log In</Button>
          </>
        ) : (
          <>
            <p style={{ fontSize: "13px", color: "#444", marginBottom: "2rem" }}>
              Enter the email on your account and we'll send you a link to reset your password.
            </p>

            <Input label="Email" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus />

            {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}

            <div style={{ marginTop: "1.5rem" }}>
              <Button onClick={handleSend}>{loading ? "Sending..." : "Send Reset Link"}</Button>
            </div>

            <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "13px", color: "#444" }}>
              <span onClick={() => navigate("login")} style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}>Back to Log In</span>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
