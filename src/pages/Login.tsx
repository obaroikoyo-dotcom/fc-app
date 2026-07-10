import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import Logo from "../components/Logo";
import Input from "../components/Input";
import Button from "../components/Button";
import { type Page } from "../App";
import { supabase, signInWithGoogle } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

export default function Login({ navigate }: Props) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleLogin = async () => {
    setError("");
    if (!form.email || !form.password) return setError("Email and password required.");

    setLoading(true);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (loginError) {
        if (loginError.message.toLowerCase().includes("invalid") || loginError.message.toLowerCase().includes("credentials")) {
          setError("Account not found or incorrect password. Try signing up instead.");
        } else {
          setError(loginError.message);
        }
        return;
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
        if (profileError) {
          setError("Signed in, but couldn't load your profile. Please try again.");
          return;
        }
        if (profile?.role === "brand") navigate("brand-dashboard");
        else navigate("explore");
      }
    } catch (e) {
      setError("Something went wrong signing in. Please check your connection and try again.");
      console.log("Login error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <Logo />
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Welcome back</p>
        <p style={{ fontSize: "13px", color: "#444", marginBottom: "2rem" }}>Sign in to your FlipCollab account.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input label="Email" type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} />
          <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} />
        </div>

        {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}

        <div style={{ marginTop: "1.5rem" }}>
          <Button onClick={handleLogin}>{loading ? "Signing in..." : "Sign In"}</Button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "1.5rem 0" }}>
          <div style={{ flex: 1, height: "1px", background: "#222" }} />
          <span style={{ fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "#222" }} />
        </div>

        <Button variant="outline" onClick={signInWithGoogle} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          {GoogleIcon} Continue with Google
        </Button>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "13px", color: "#444" }}>
          Don't have an account?{" "}
          <span onClick={() => navigate("role-select")} style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}>Sign up</span>
        </p>
      </div>
    </AuthLayout>
  );
}