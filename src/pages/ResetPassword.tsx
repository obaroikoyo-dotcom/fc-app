import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import Logo from "../components/Logo";
import Input from "../components/Input";
import Button from "../components/Button";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

export default function ResetPassword({ navigate }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setDone(true);
      }
    } catch (e) {
      setError("Something went wrong. Please check your connection and try again.");
      console.log("Update password error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <Logo />
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Set a new password</p>

        {done ? (
          <>
            <p style={{ fontSize: "13px", color: "#777", marginBottom: "2rem", lineHeight: 1.6 }}>
              Your password has been updated. You can now log in with it.
            </p>
            <Button onClick={() => navigate("login")}>Continue to Log In</Button>
          </>
        ) : (
          <>
            <p style={{ fontSize: "13px", color: "#444", marginBottom: "2rem" }}>Choose a new password for your account.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Input label="New Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
              <Input label="Confirm Password" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>

            {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}

            <div style={{ marginTop: "1.5rem" }}>
              <Button onClick={handleReset}>{loading ? "Updating..." : "Reset Password"}</Button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
