import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import Logo from "../components/Logo";
import Input from "../components/Input";
import Button from "../components/Button";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

export default function BrandSignup({ navigate }: Props) {
  const [form, setForm] = useState({ company: "", email: "", industry: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSignup = async () => {
    setError("");
    if (!form.email || !form.password) return setError("Email and password required.");
    if (form.password !== form.confirm) return setError("Passwords don't match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { role: "brand", company: form.company, industry: form.industry }
      }
    });

    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, role: "brand", email: form.email });
    }

    setLoading(false);
    navigate("brand-profile");
  };

  return (
    <AuthLayout>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <Logo />
        <p onClick={() => navigate("role-select")} style={{ fontSize: "12px", color: "#444", cursor: "pointer", marginBottom: "1.5rem" }}>← Back</p>
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Brand sign up</p>
        <p style={{ fontSize: "13px", color: "#444", marginBottom: "2rem" }}>Post campaigns and connect with creators.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input label="Company Name" type="text" placeholder="Your company name" value={form.company} onChange={set("company")} />
          <Input label="Email" type="email" placeholder="hello@yourbrand.com" value={form.email} onChange={set("email")} />
          <Input label="Industry / Niche" type="text" placeholder="e.g. Beauty, Fashion, Food" value={form.industry} onChange={set("industry")} />
          <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} />
          <Input label="Confirm Password" type="password" placeholder="••••••••" value={form.confirm} onChange={set("confirm")} />
        </div>

        {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}

        <div style={{ marginTop: "1.5rem" }}>
          <Button onClick={handleSignup}>{loading ? "Creating account..." : "Create Brand Account"}</Button>
        </div>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "13px", color: "#444" }}>
          Already have an account?{" "}
          <span onClick={() => navigate("login")} style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}>Sign in</span>
        </p>
      </div>
    </AuthLayout>
  );
}