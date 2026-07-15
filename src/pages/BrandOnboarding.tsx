import { useState, useRef, useEffect } from "react";
import PrivacyModal from "./PrivacyModal";
import LocationInput from "../components/LocationInput";
import { type Page } from "../App";
import { supabase, signInWithGoogle } from "../lib/supabase";
import { saveOnboardingDraft, peekOnboardingDraft, clearOnboardingDraft } from "../lib/onboardingDraft";
import { logEvent } from "../lib/debugLog";
import TermsModal from "./TermsModal"; // Assumes TermsModal is in the same folder

interface Props { navigate: (p: Page) => void; setPendingEmail: (email: string) => void; }

const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

const INDUSTRIES = ["Fashion & Apparel", "Beauty & Cosmetics", "Tech & SaaS", "Health & Wellness", "Food & Beverage", "Fitness", "Design & Home", "Jewellery & Accessories", "Skincare", "Haircare", "Travel & Hospitality", "Parenting & Family", "Pet Care", "Finance & Fintech", "Education & E-learning", "Gaming", "Automotive", "Sports & Outdoors", "Luxury Goods", "Sustainability & Eco", "Alcohol & Beverages", "Subscription Boxes", "Home & Garden", "Art & Creative Tools"];
const ACTIVATION_TYPES = ["UGC Video Assets", "Instagram Aires", "TikTok Placements", "Product Reviews", "Long-form Vlogs", "Dedicated Demos"];
const CREATOR_TIERS = [
  { label: "Nano-Tier Scale", sub: "Under 10k: High-engagement niche focus", value: "nano" },
  { label: "Micro-Tier Authority", sub: "10k - 100k: Optimized for reach & conversion", value: "micro" },
  { label: "Mid-Tier Influence", sub: "100k - 500k: Established market presence", value: "mid" },
  { label: "Macro-Tier Reach", sub: "500k - 1M: Mass awareness spikes", value: "macro" },
  { label: "Elite/Mega Impact", sub: "1M+: Cultural celebrity & global visibility", value: "mega" }
];
const TOTAL_SCREENS = 7;

export default function BrandOnboarding({ navigate, setPendingEmail }: Props) {
  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  // Corporate Onboarding Form State
  const [companyName, setCompanyName] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
const [industryInput, setIndustryInput] = useState("");
const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [targetTier, setTargetTier] = useState(""); // Replaced budgetRange state with targetTier
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal Control Interceptor State
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
const [otpError, setOtpError] = useState("");
const [otpLoading, setOtpLoading] = useState(false);
const [otpResending, setOtpResending] = useState(false);
const [otpResent, setOtpResent] = useState(false);
const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
const [showOtp, setShowOtp] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      logEvent(`BrandOnboarding mount: hasUser=${!!user} emailConfirmed=${!!user?.email_confirmed_at} provider=${user?.app_metadata?.provider ?? "n/a"}`);
      if (user && user.email_confirmed_at && user.app_metadata?.provider && user.app_metadata.provider !== "email") {
        setIsOAuthUser(true);
        setEmail(user.email || "");

        // Resuming after a Google redirect - restore whatever was filled in
        // before the redirect tore down component state, and jump straight
        // back to the credentials screen instead of starting over.
        const draft = peekOnboardingDraft("brand");
        logEvent(`BrandOnboarding mount: isOAuthUser=true draftFound=${!!draft}`);
        if (draft) {
          if (typeof draft.companyName === "string") setCompanyName(draft.companyName);
          if (Array.isArray(draft.selectedIndustries)) setSelectedIndustries(draft.selectedIndustries as string[]);
          if (typeof draft.location === "string") setLocation(draft.location);
          if (typeof draft.website === "string") setWebsite(draft.website);
          if (typeof draft.bio === "string") setBio(draft.bio);
          if (typeof draft.targetAudience === "string") setTargetAudience(draft.targetAudience);
          if (Array.isArray(draft.contentTypes)) setContentTypes(draft.contentTypes as string[]);
          if (typeof draft.targetTier === "string") setTargetTier(draft.targetTier);
          if (typeof draft.termsAccepted === "boolean") setTermsAccepted(draft.termsAccepted);
          setScreen(5);
        }
      }
    });
  }, []);

  const handleGoogleContinue = async () => {
    saveOnboardingDraft("brand", {
      companyName, selectedIndustries, location, website, bio, targetAudience, contentTypes, targetTier, termsAccepted,
    });
    await signInWithGoogle();
  };

  const goTo = (next: number) => {
    if (animating) return;
    setDirection(next > screen ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setScreen(next);
      setAnimating(false);
    }, 350);
  };

  const next = () => goTo(screen + 1);
  const back = () => goTo(screen - 1);

  const toggleContent = (c: string) =>
    setContentTypes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

const addIndustry = (ind: string) => {
  const trimmed = ind.trim();
  if (trimmed && !selectedIndustries.includes(trimmed)) {
    setSelectedIndustries(prev => [...prev, trimmed]);
  }
  setIndustryInput("");
  setShowIndustryDropdown(false);
};

const removeIndustry = (ind: string) =>
  setSelectedIndustries(prev => prev.filter(x => x !== ind));

const filteredIndustries = INDUSTRIES.filter(ind =>
  ind.toLowerCase().includes(industryInput.toLowerCase()) && !selectedIndustries.includes(ind)
);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setBrandLogo(URL.createObjectURL(file));
    }
  };

  const handleSignup = async () => {
    setError("");
    if (!email || !password) return setError("Corporate credentials required.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: "brand", company: companyName } }
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already")) {
          setError("This corporate email is registered. Proceed to authentication.");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      setPendingEmail(email);
      setShowOtp(true);
    } catch (catchErr) {
      console.error("Signup pipeline crash intercepted:", catchErr);
      setError("A network transaction interruption occurred. Please re-verify entries.");
      setLoading(false);
    }
  };

  const verifyOtp = async (otp: string) => {
    setOtpLoading(true);
    setOtpError("");

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });

    if (verifyError) {
      setOtpError("Invalid or expired code. Try again.");
      setOtpLoading(false);
      setOtpCode(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      return;
    }

    setOtpLoading(false);
    if (data.user) {
      setShowOtp(false);
      goTo(6);
    }
  };

  const handleOtpChange = (idx: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...otpCode];
    next[idx] = value;
    setOtpCode(next);
    setOtpError("");
    if (value && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (next.every(c => c !== "") && idx === 5) verifyOtp(next.join(""));
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOtpResend = async () => {
    setOtpResending(true);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setOtpResending(false);
    if (!resendError) {
      setOtpResent(true);
      setTimeout(() => setOtpResent(false), 4000);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    clearOnboardingDraft();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error: coreError } = await supabase
        .from("profiles")
        .insert({ id: user.id, role: "brand", email });

      if (coreError) console.log("Core profile save notice:", coreError.message);

      let logoUrl = null;
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop()?.toLowerCase();
        const filePath = `brands/${user.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, logoFile, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
          logoUrl = urlData.publicUrl;
        } else {
          console.log("Asset upload catch:", uploadError.message);
        }
      }

      const { error: profileError } = await supabase.from("brand_profiles").insert({
        id: user.id,
        company_name: companyName,
        name: companyName,
        industry: selectedIndustries.join(", "),
        niche: selectedIndustries.join(", "),
        location,
        website,
        bio,
        target_audience: targetAudience,
        content_types: contentTypes,
        budget_range: targetTier,
        logo_url: logoUrl,
        avatar_url: logoUrl,
        onboarding_complete: true,
      });

      if (profileError) {
        setError(`Database transmission failure: ${profileError.message}`);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    navigate("brand-dashboard");
  };

  const inputStyle: React.CSSProperties = {
    background: "#111",
    border: "1px solid #222",
    borderRadius: "10px",
    padding: "13px 16px",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 16px",
    borderRadius: "20px",
    border: `1px solid ${active ? "#fff" : "#222"}`,
    background: active ? "#fff" : "transparent",
    color: active ? "#0a0a0a" : "#555",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const screens = [
    // Screen 0 — Welcome
    <div key={0}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Corporate Protocol</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "1rem" }}>Initialize corporate identity</h1>
      <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7, marginBottom: "2.5rem" }}>Establish parameters to connect with creators who match your target positioning.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Registered Business Name</label>
        <input style={inputStyle} placeholder="e.g. Acme Corporation" value={companyName} onChange={e => setCompanyName(e.target.value)} autoFocus />
      </div>
    </div>,

    // Screen 1 — Positioning
    <div key={1}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Market Segment</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Select sector alignment</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Creators categorize partnership offers by operational fields.</p>
      <div style={{ position: "relative", marginBottom: "1.5rem" }}>
  {selectedIndustries.length > 0 && (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
      {selectedIndustries.map(ind => (
        <div key={ind} onClick={() => removeIndustry(ind)} style={{ padding: "6px 10px", borderRadius: "16px", background: "#fff", color: "#0a0a0a", fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          {ind} <span>×</span>
        </div>
      ))}
    </div>
  )}

  <input
    style={inputStyle}
    placeholder="Type to search or add your own sector"
    value={industryInput}
    onChange={e => { setIndustryInput(e.target.value); setShowIndustryDropdown(true); }}
    onFocus={() => setShowIndustryDropdown(true)}
    onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 150)}
    onKeyDown={e => { if (e.key === "Enter" && industryInput.trim()) { e.preventDefault(); addIndustry(industryInput); } }}
  />

  {showIndustryDropdown && industryInput && (
    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", background: "#111", border: "1px solid #222", borderRadius: "10px", maxHeight: "180px", overflowY: "auto", zIndex: 20 }}>
      {filteredIndustries.map(ind => (
        <div key={ind} onMouseDown={() => addIndustry(ind)} style={{ padding: "10px 14px", fontSize: "13px", color: "#fff", cursor: "pointer" }}>{ind}</div>
      ))}
      <div onMouseDown={() => addIndustry(industryInput)} style={{ padding: "10px 14px", fontSize: "13px", color: "#555", cursor: "pointer", borderTop: filteredIndustries.length ? "1px solid #1a1a1a" : "none" }}>
        Add "{industryInput}"
      </div>
    </div>
  )}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
  <div>
    <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Headquarters Location</label>
    <LocationInput inputStyle={inputStyle} value={location} onChange={setLocation} />
  </div>
</div>
    </div>,

    // Screen 2 — Web Presence & Description
    <div key={2}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Corporate Profile</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Verification parameters</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Provide credentials to support verification steps.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Corporate Website URL</label>
          <input style={inputStyle} placeholder="https://yourbrand.com" value={website} onChange={e => setWebsite(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Executive Summary / Mission Statement</label>
          <input style={inputStyle} placeholder="Describe your brand voice and creative philosophy..." value={bio} onChange={e => setBio(e.target.value)} />
        </div>
      </div>
    </div>,

    // Screen 3 — Campaign & Activation Directives
    <div key={3}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Asset Strategies</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Required media formats</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Select the asset distributions required for your placements.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "2rem" }}>
        {ACTIVATION_TYPES.map(act => (
          <div key={act} onClick={() => toggleContent(act)} style={chipStyle(contentTypes.includes(act))}>
            {act}
          </div>
        ))}
      </div>
      <div>
        <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Target Demographics</label>
        <input style={inputStyle} placeholder="e.g. Gen Z Design Enthusiasts, UK Tech Professionals" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} />
      </div>
    </div>,

    // Screen 4 — Strategic Alignment & Capital Allocation
    <div key={4}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Strategic Alignment</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What is your target creator tier?</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Defining your target allows our algorithm to prioritize the right talent for your brand voice.</p>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "2rem" }}>
        {CREATOR_TIERS.map(tier => (
          <div 
            key={tier.value} 
            onClick={() => setTargetTier(tier.value)} 
            style={{ 
              ...chipStyle(targetTier === tier.value), 
              borderRadius: "12px", 
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: 700, color: targetTier === tier.value ? "#0a0a0a" : "#fff" }}>{tier.label}</span>
            <span style={{ fontSize: "11px", opacity: 0.6, color: targetTier === tier.value ? "#333" : "#555" }}>{tier.sub}</span>
          </div>
        ))}
      </div>
    </div>,

    // Screen 5 — Access Credentials
    <div key={5}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Authentication</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Secure corporate portal</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Credentials are handled in compliance with standardized protocols.</p>
      {isOAuthUser ? (
        <div style={{ padding: "12px 14px", background: "#111", border: "1px solid #222", borderRadius: "8px", fontSize: "13px", color: "#fff" }}>
          Continuing as <strong>{email}</strong> via Google
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Corporate Email Address</label>
            <input style={inputStyle} placeholder="hello@company.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Portal Password</label>
            <input style={inputStyle} placeholder="••••••••" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Confirm Portal Password</label>
            <input style={inputStyle} placeholder="••••••••" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#222" }} />
            <span style={{ fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "#222" }} />
          </div>

          <div
            onClick={handleGoogleContinue}
            style={{ padding: "13px", borderRadius: "10px", border: "1px solid #222", background: "transparent", color: "#fff", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer" }}
          >
            {GoogleIcon} Continue with Google
          </div>
        </div>
      )}
      {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}
      {!termsAccepted && (
        <div onClick={() => setShowTerms(true)} style={{ marginTop: "1rem", padding: "10px 14px", background: "#111", border: "1px solid #222", borderRadius: "8px", fontSize: "12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Read & accept Terms and Conditions</span>
          <span style={{ color: "#555" }}>Required →</span>
        </div>
      )}
      {termsAccepted && (
        <p style={{ color: "#fff", fontSize: "12px", marginTop: "1rem" }}>✓ Terms accepted</p>
      )}
      <div onClick={() => setShowPrivacy(true)} style={{ marginTop: "8px", padding: "10px 14px", background: "#111", border: "1px solid #222", borderRadius: "8px", fontSize: "12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
  <span>Read Privacy Policy</span>
  <span style={{ color: "#555" }}>View →</span>
</div>
    </div>,

    // Screen 6 — Visual Branding Identification
    <div key={6}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Visual Assets</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Upload brand iconography</h1>
      <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7, marginBottom: "2rem" }}>Identifiable logomarks build consistency and trust throughout application touchpoints.</p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <div onClick={() => logoRef.current?.click()} style={{ width: "110px", height: "110px", borderRadius: "14px", border: `2px dashed ${brandLogo ? "#fff" : "#333"}`, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", transition: "border-color 0.2s" }}>
          {brandLogo
            ? <img src={brandLogo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: "32px", color: "#333" }}>+</span>}
        </div>
        <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
        <p style={{ fontSize: "12px", color: "#444" }}>{brandLogo ? "Modify logomark" : "Assign logomark"}</p>
      </div>
    </div>,
  ];

  const buttonLabel = () => {
    if (screen === 0) return companyName.trim() ? "Continue →" : null;
    if (screen === 1) return (selectedIndustries.length > 0 || location.trim()) ? "Continue →" : "Skip step →";
    if (screen === 2) return (website.trim() || bio.trim()) ? "Continue →" : "Skip step →";
    if (screen === 3) return (contentTypes.length > 0 || targetAudience.trim()) ? "Continue →" : "Skip step →";
    if (screen === 4) return targetTier ? "Continue →" : "Provide parameters to proceed";
    if (screen === 5) return (isOAuthUser ? termsAccepted : (email.trim() && password.length >= 6 && password === confirm && termsAccepted)) ? "Continue →" : null;
    if (screen === 6) return brandLogo ? "Review Agreements & Deploy →" : "Review Agreements & Deploy →";
    return "Continue →";
  };

  const progress = ((screen + 1) / TOTAL_SCREENS) * 100;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0px 1000px #111 inset !important;
          -webkit-text-fill-color: #fff !important;
        }
        @keyframes slideInForward {
          from { transform: translateX(60px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInBack {
          from { transform: translateX(-60px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .slide-forward { animation: slideInForward 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .slide-back { animation: slideInBack 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .tap-btn { -webkit-tap-highlight-color: transparent; transition: transform 0.1s ease; }
        .tap-btn:active { transform: scale(0.96); }
      `}</style>

      {/* Progress Bar */}
      <div style={{ height: "2px", background: "#111", position: "fixed", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <div style={{ height: "100%", background: "#fff", width: `${progress}%`, transition: "width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)" }} />
      </div>

      {/* Top Nav */}
      <div style={{ padding: "1.25rem 1.25rem 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
        {screen > 0
          ? <span onClick={back} style={{ fontSize: "18px", color: "#555", cursor: "pointer", padding: "4px" }}>←</span>
          : <span onClick={() => navigate("role-select")} style={{ fontSize: "12px", color: "#444", cursor: "pointer" }}>← Back</span>}
        <span style={{ fontSize: "12px", color: "#333" }}>{screen + 1} / {TOTAL_SCREENS}</span>
      </div>

      {/* Screen Content */}
      <div
        key={screen}
        className={animating ? "" : direction === "forward" ? "slide-forward" : "slide-back"}
        style={{ flex: 1, padding: "2rem 1.5rem", overflowY: "auto", paddingBottom: "10rem" }}
      >
        {screens[screen]}
      </div>

      {/* Bottom Control Area */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "1.25rem 1.5rem 2rem", background: "linear-gradient(to top, #0a0a0a 60%, transparent)" }}>
        {screen === 6 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              onClick={loading ? undefined : handleFinish}
              style={{ padding: "16px", borderRadius: "12px", background: "#fff", color: "#0a0a0a", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: loading ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Registering profile..." : "Finish & Initialize →"}
            </div>
            <div
              onClick={loading ? undefined : handleFinish}
              style={{ padding: "14px", borderRadius: "12px", background: "transparent", color: "#444", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.05em" }}
            >
              Skip configuration
            </div>
          </div>
        ) : (
          <div
            className="tap-btn"
            onClick={(!loading && buttonLabel()) ? (screen === 5 ? (isOAuthUser ? next : handleSignup) : next) : undefined}
            style={{ padding: "16px", borderRadius: "12px", background: buttonLabel() ? "#fff" : "#1a1a1a", color: buttonLabel() ? "#0a0a0a" : "#333", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: (!loading && buttonLabel()) ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s", border: buttonLabel() ? "none" : "1px solid #222", opacity: (screen === 5 && loading) ? 0.6 : 1, pointerEvents: (screen === 5 && loading) ? "none" : "auto" }}
          >
            {screen === 5 && loading ? "Sending code..." : (buttonLabel() || "Provide name to proceed")}
          </div>
        )}
      </div>

      {/* Terms & Conditions Modal Overlay Interceptor */}
      <TermsModal 
        isOpen={showTerms}
        role="brand"
        onClose={() => setShowTerms(false)}
        onAccept={() => {
          setTermsAccepted(true);
          setShowTerms(false);
        }}
      />
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />

      {showOtp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "16px", width: "100%", maxWidth: "360px", padding: "2rem 1.75rem", textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
              <svg width="24" height="24" viewBox="0 0 365 219" xmlns="http://www.w3.org/2000/svg">
                <path fill="#0a0a0a" d="M96.064575,165.549103 C96.366272,165.727371 96.667969,165.905640 97.020691,167.005798 C97.020691,171.608582 97.020691,176.211365 97.020691,180.814133 C97.424942,181.114319 97.829193,181.414505 98.233437,181.714676 C112.648994,169.587921 127.064552,157.461166 142.352478,144.600555 C136.653229,143.119751 132.347198,142.000931 127.689224,140.117615 C127.401375,135.075287 127.113518,130.032959 126.973160,124.267860 C128.984497,117.933220 135.203888,117.274460 139.932022,114.509651 C155.839188,105.207825 171.638748,95.721939 187.475739,86.308678 C187.475739,81.703476 187.475739,76.882881 187.475739,71.560562 C199.698669,77.999992 211.662857,84.303108 224.050797,90.829468 C211.899780,100.692886 199.833862,110.487228 187.173111,120.764412 C187.504791,113.638428 187.794525,107.413536 188.107529,100.688721 C176.578140,106.953163 164.937210,113.278221 153.019852,119.753464 C153.019852,128.063873 153.106766,136.719467 152.942032,145.370270 C152.911331,146.981888 152.323242,149.053528 151.220428,150.097000 C144.539169,156.418716 137.624146,162.492935 130.805710,168.670242 C119.956711,178.499100 109.033417,188.248886 98.336990,198.241348 C95.231705,201.142258 95.152985,204.950058 97.201767,209.194946 C103.133720,203.998001 108.661530,199.143433 114.202187,194.303558 C124.588501,185.230896 134.993423,176.179520 145.369888,167.095627 C156.346924,157.485947 167.147339,147.667404 178.310654,138.279892 C187.504074,130.548904 197.168274,123.380470 206.526382,115.841782 C216.044556,108.174164 225.652557,100.596611 234.831161,92.535484 C242.725525,85.602264 250.409851,78.357109 257.535583,70.647736 C262.086914,65.723610 265.476868,59.720032 269.270355,54.121033 C269.441528,53.868385 268.453339,52.830238 267.078735,52.001575 C239.384109,52.054615 211.689484,52.107655 183.141708,52.016808 C181.365662,52.220932 179.304489,51.914135 177.863312,52.718365 C171.889130,56.052246 165.844223,59.361343 160.293884,63.334187 C142.027573,76.408920 124.005127,89.823792 105.801323,102.986748 C100.091866,107.115173 95.788017,111.704567 96.962341,119.483917 C97.280693,121.592850 96.936661,123.801773 96.237114,126.246277 C96.460686,127.509384 96.684258,128.772491 97.016251,130.843353 C97.000595,132.201004 96.984940,133.558655 96.440697,135.056396 C96.343376,135.367905 96.246063,135.679413 95.986572,136.916962 C96.040627,146.281021 96.094688,155.645096 96.064575,165.549103 M268.743988,141.763657 C268.770264,140.839050 268.796509,139.914444 268.968628,138.063904 C268.973663,119.750961 269.030243,101.437645 268.898254,83.125687 C268.885986,81.426476 267.676086,79.735893 267.022247,78.041290 C265.681519,78.851440 264.154022,79.460625 263.030609,80.504608 C256.130219,86.916985 249.380585,93.492241 242.448868,99.869919 C240.085922,102.043976 236.203033,103.322350 235.114822,105.897491 C234.163528,108.148582 236.246307,111.628464 236.836929,114.595688 C238.044830,120.663971 239.928818,127.158257 235.640747,132.438889 C232.546341,136.249557 228.330673,139.533447 223.978882,141.864670 C212.656128,147.930222 200.982910,153.341537 188.925125,159.271774 C188.532455,153.090378 188.180252,147.545990 187.788666,141.381638 C174.279053,153.046722 161.510452,164.071960 148.805481,175.042252 C163.134384,183.761902 177.085220,192.251465 191.036057,200.741043 C191.380646,200.313141 191.725250,199.885239 192.069839,199.457336 C191.270569,195.139252 190.471298,190.821167 189.658249,186.428650 C190.906189,186.077881 192.752045,185.654800 194.533447,185.043854 C218.178879,176.934647 240.343750,165.827255 260.791931,151.475250 C263.901611,149.292648 265.688232,145.225082 268.743988,141.763657 z"/>
                <path fill="#fff" d="M128.041168,140.882126 C132.347198,142.000931 136.653229,143.119751 142.352478,144.600555 C127.064552,157.461166 112.648994,169.587921 98.233437,181.714676 C97.829193,181.414505 97.424942,181.114319 97.020691,180.814133 C97.020691,176.211365 97.020691,171.608582 97.008347,166.274246 C96.997238,165.362289 96.998489,165.181900 97.297333,164.707855 C97.730225,157.650772 97.973732,150.886917 97.947639,144.124069 C97.937180,141.414383 97.333435,138.706955 96.997574,135.727798 C96.984940,133.558655 97.000595,132.201004 97.240967,130.232178 C97.276009,128.402283 97.086334,127.183540 96.896652,125.964798 C96.936661,123.801773 97.280693,121.592850 96.962341,119.483917 C95.788017,111.704567 100.091866,107.115173 105.801323,102.986748 C124.005127,89.823792 142.027573,76.408920 160.293884,63.334187 C165.844223,59.361343 171.889130,56.052246 177.863312,52.718365 C179.304489,51.914135 181.365662,52.220932 183.676743,52.472023 C185.237396,53.284367 186.262344,53.951061 187.288757,53.953350 C213.030014,54.010765 238.771545,54.022274 264.512543,53.920010 C265.679047,53.915379 266.841064,52.771313 268.005157,52.157959 C268.453339,52.830238 269.441528,53.868385 269.270355,54.121033 C265.476868,59.720032 262.086914,65.723610 257.535583,70.647736 C250.409851,78.357109 242.725525,85.602264 234.831161,92.535484 C225.652557,100.596611 216.044556,108.174164 206.526382,115.841782 C197.168274,123.380470 187.504074,130.548904 178.310654,138.279892 C167.147339,147.667404 156.346924,157.485947 145.369888,167.095627 C134.993423,176.179520 124.588501,185.230896 114.202187,194.303558 C108.661530,199.143433 103.133720,203.998001 97.201767,209.194946 C95.152985,204.950058 95.231705,201.142258 98.336990,198.241348 C109.033417,188.248886 119.956711,178.499100 130.805710,168.670242 C137.624146,162.492935 144.539169,156.418716 151.220428,150.097000 C152.323242,149.053528 152.911331,146.981888 152.942032,145.370270 C153.106766,136.719467 153.019852,128.063873 153.019852,119.753464 C164.937210,113.278221 176.578140,106.953163 188.107529,100.688721 C187.794525,107.413536 187.504791,113.638428 187.173111,120.764412 C199.833862,110.487228 211.899780,100.692886 224.050797,90.829468 C211.662857,84.303108 199.698669,77.999992 187.475739,71.560562 C187.475739,76.882881 187.475739,81.703476 187.475739,86.308678 C171.638748,95.721939 155.839188,105.207825 139.932022,114.509651 C135.203888,117.274460 128.984497,117.933220 126.518005,124.739204 C125.845863,130.034561 125.566727,134.858078 125.527977,139.683517 C125.524826,140.076309 127.164734,140.482285 128.041168,140.882126 z"/>
                <path fill="#fff" d="M268.086823,142.029373 C265.688232,145.225082 263.901611,149.292648 260.791931,151.475250 C240.343750,165.827255 218.178879,176.934647 194.533447,185.043854 C192.752045,185.654800 190.906189,186.077881 189.658249,186.428650 C190.471298,190.821167 191.270569,195.139252 192.069839,199.457336 C191.725250,199.885239 191.380646,200.313141 191.036057,200.741043 C177.085220,192.251465 163.134384,183.761902 148.805481,175.042252 C161.510452,164.071960 174.279053,153.046722 187.788666,141.381638 C188.180252,147.545990 188.532455,153.090378 188.925125,159.271774 C200.982910,153.341537 212.656128,147.930222 223.978882,141.864670 C228.330673,139.533447 232.546341,136.249557 235.640747,132.438889 C239.928818,127.158257 238.044830,120.663971 236.836929,114.595688 C236.246307,111.628464 234.163528,108.148582 235.114822,105.897491 C236.203033,103.322350 240.085922,102.043976 242.448868,99.869919 C249.380585,93.492241 256.130219,86.916985 263.030609,80.504608 C264.154022,79.460625 265.681519,78.851440 267.022247,78.041290 C267.676086,79.735893 268.885986,81.426476 268.898254,83.125687 C269.030243,101.437645 268.973663,119.750961 268.580200,138.587204 C268.156769,140.083466 268.121796,141.056412 268.086823,142.029373 z"/>
              </svg>
            </div>

            <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#444", marginBottom: "0.75rem" }}>One more step</p>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.75rem" }}>Enter your code</h1>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7, marginBottom: "1.75rem" }}>
              We sent a 6-digit code to <span style={{ color: "#fff", fontWeight: 600 }}>{email}</span>
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "1.25rem" }}>
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el; }}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  inputMode="numeric"
                  maxLength={1}
                  disabled={otpLoading}
                  style={{ width: "36px", height: "44px", textAlign: "center", fontSize: "17px", fontWeight: 700, color: "#fff", background: "#111", border: `1px solid ${otpError ? "#ff3b30" : digit ? "#fff" : "#222"}`, borderRadius: "10px", outline: "none", fontFamily: "inherit" }}
                />
              ))}
            </div>

            {otpError && <p style={{ fontSize: "12px", color: "#ff3b30", marginBottom: "1rem" }}>{otpError}</p>}
            {otpLoading && <p style={{ fontSize: "12px", color: "#555", marginBottom: "1rem" }}>Verifying...</p>}

            <div
              onClick={otpResending ? undefined : handleOtpResend}
              style={{ padding: "13px", borderRadius: "8px", background: "transparent", border: "1px solid #222", color: otpResent ? "#34c759" : "#fff", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: otpResending ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              {otpResending ? "Sending..." : otpResent ? "Code resent" : "Resend code"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}