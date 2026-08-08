import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import Logo from "../components/Logo";
import Input from "../components/Input";
import Button from "../components/Button";
import GoogleSignInButton from "../components/GoogleSignInButton";
import AppleSignInButton from "../components/AppleSignInButton";
import { type Page } from "../App";
import { supabase, signInWithGoogleIdToken, signInWithAppleIdToken } from "../lib/supabase";
import { markGoogleLoginIntent, clearGoogleLoginIntent, markAppleLoginIntent, clearAppleLoginIntent } from "../lib/authIntent";

interface Props { navigate: (p: Page) => void; }

const GoogleIcon = (
  <svg className="google-icon" width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

const AppleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
    <path d="M16.365 1.43c0 1.14-.415 2.19-1.15 2.99-.83.9-2.16 1.59-3.29 1.5-.14-1.09.42-2.24 1.14-2.98.8-.84 2.2-1.47 3.3-1.51zM20.5 17.14c-.5 1.16-.74 1.68-1.38 2.72-.9 1.44-2.16 3.24-3.73 3.25-1.4.02-1.76-.92-3.65-.91-1.89.01-2.29.93-3.69.91-1.57-.02-2.76-1.63-3.66-3.07-2.5-4-2.77-8.68-1.22-11.17.95-1.53 2.53-2.53 4.27-2.55 1.5-.03 2.62.98 3.85.98 1.22 0 2.9-1.21 4.9-1.03.83.03 3.17.34 4.66 2.53-.12.08-2.78 1.63-2.75 4.85.03 3.86 3.4 5.14 3.4 5.14z" />
  </svg>
);

export default function Login({ navigate }: Props) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleGoogleCredential = async (idToken: string, nonce: string) => {
    setError("");
    markGoogleLoginIntent();

    const { data, error: idTokenError } = await signInWithGoogleIdToken(idToken, nonce);
    if (idTokenError) {
      clearGoogleLoginIntent();
      setError(idTokenError.message);
      return;
    }

    // signInWithIdToken silently creates a new account for a Google identity
    // that's never signed in before - not what "sign in" should do. A missing
    // profile row means there's genuinely no FlipCollab account behind this
    // Google account, so undo the phantom sign-in and tell them to sign up.
    if (data.user) {
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
      if (!profile) {
        await supabase.auth.signOut();
        clearGoogleLoginIntent();
        setError("No account found for that Google account. Try signing up instead.");
        return;
      }
    }

    clearGoogleLoginIntent();
    // Successful sign-in is picked up by App.tsx's onAuthStateChange, which
    // handles routing from here.
  };

  const handleAppleCredential = async (idToken: string, nonce: string) => {
    setError("");
    markAppleLoginIntent();

    const { data, error: idTokenError } = await signInWithAppleIdToken(idToken, nonce);
    if (idTokenError) {
      clearAppleLoginIntent();
      setError(idTokenError.message);
      return;
    }

    // Same phantom-account guard as the Google handler above - signInWithIdToken
    // silently creates a new account for an Apple identity that's never signed
    // in before, which isn't what "sign in" should do here.
    if (data.user) {
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
      if (!profile) {
        await supabase.auth.signOut();
        clearAppleLoginIntent();
        setError("No account found for that Apple account. Try signing up instead.");
        return;
      }
    }

    clearAppleLoginIntent();
  };

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
        <p style={{ fontSize: "13px", color: "#888", marginBottom: "2rem" }}>Log in to your FlipCollab account.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input label="Email" type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} />
          <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} />
        </div>

        <p style={{ textAlign: "right", marginTop: "10px", fontSize: "12px" }}>
          <span onClick={() => navigate("forgot-password")} style={{ color: "#bbb", cursor: "pointer", textDecoration: "underline" }}>Forgot password?</span>
        </p>

        {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}

        <div style={{ marginTop: "1.5rem" }}>
          <Button onClick={handleLogin}>{loading ? "Logging in..." : "Log In"}</Button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "1.5rem 0" }}>
          <div style={{ flex: 1, height: "1px", background: "#222" }} />
          <span style={{ fontSize: "11px", color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "#222" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <GoogleSignInButton onCredential={handleGoogleCredential}>
            <Button variant="outline" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              {GoogleIcon} Continue with Google
            </Button>
          </GoogleSignInButton>

          <AppleSignInButton onCredential={handleAppleCredential}>
            <Button variant="outline" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              {AppleIcon} Continue with Apple
            </Button>
          </AppleSignInButton>
        </div>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "13px", color: "#888" }}>
          Don't have an account?{" "}
          <span onClick={() => navigate("role-select")} style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}>Sign up</span>
        </p>
      </div>
    </AuthLayout>
  );
}