import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import Logo from "../components/Logo";
import Input from "../components/Input";
import Button from "../components/Button";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

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
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (loginError) { setError(loginError.message); setLoading(false); return; }

    if (data.user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setLoading(false);
      if (profile?.role === "brand") navigate("brand-dashboard");
      else navigate("explore");
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

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "13px", color: "#444" }}>
          Don't have an account?{" "}
          <span onClick={() => navigate("role-select")} style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}>Sign up</span>
        </p>
      </div>
    </AuthLayout>
  );
}