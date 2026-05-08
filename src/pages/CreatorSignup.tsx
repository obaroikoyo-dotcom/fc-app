import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import Logo from "../components/Logo";
import Input from "../components/Input";
import Button from "../components/Button";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

export default function CreatorSignup({ navigate }: Props) {
  const [form, setForm] = useState({ name: "", email: "", instagram: "", niche: "", followers: "", password: "", confirm: "" });
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
        data: { role: "creator", name: form.name, niche: form.niche, instagram: form.instagram, followers: form.followers }
      }
    });

    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, role: "creator", email: form.email });
    }

    setLoading(false);
    navigate("explore");
  };

  return (
    <AuthLayout>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <Logo />
        <p onClick={() => navigate("role-select")} style={{ fontSize: "12px", color: "#444", cursor: "pointer", marginBottom: "1.5rem" }}>← Back</p>
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Creator sign up</p>
        <p style={{ fontSize: "13px", color: "#444", marginBottom: "2rem" }}>Apply to brand campaigns and build your portfolio.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input label="Full Name" type="text" placeholder="Your name" value={form.name} onChange={set("name")} />
          <Input label="Email" type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} />
          <Input label="Instagram Handle" type="text" placeholder="@yourhandle" value={form.instagram} onChange={set("instagram")} />
          <Input label="Niche" type="text" placeholder="e.g. Lifestyle, Beauty, Fitness" value={form.niche} onChange={set("niche")} />
          <Input label="Follower Count" type="number" placeholder="e.g. 8500" value={form.followers} onChange={set("followers")} />
          <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} />
          <Input label="Confirm Password" type="password" placeholder="••••••••" value={form.confirm} onChange={set("confirm")} />
        </div>

        {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}

        <div style={{ marginTop: "1.5rem" }}>
          <Button onClick={handleSignup}>{loading ? "Creating account..." : "Create Creator Account"}</Button>
        </div>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "13px", color: "#444" }}>
          Already have an account?{" "}
          <span onClick={() => navigate("login")} style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}>Sign in</span>
        </p>
      </div>
    </AuthLayout>
  );
}