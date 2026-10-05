import { useState, useRef, useEffect } from "react";
import PrivacyModal from "./PrivacyModal";
import LocationInput from "../components/LocationInput";
import { type Page } from "../App";
import { supabase, signInWithGoogleIdToken } from "../lib/supabase";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { saveOnboardingDraft, peekOnboardingDraft, clearOnboardingDraft } from "../lib/onboardingDraft";
import { logEvent } from "../lib/debugLog";
import TermsModal from "./TermsModal"; // Assumes TermsModal is in the same folder
import TikTokIcon from "../components/TikTokIcon";
import InstagramIcon from "../components/InstagramIcon";
import { startSocialConnect, getSocialConnections, type SocialConnection, type SocialPlatform } from "../lib/social";
import { uploadToR2 } from "../lib/r2Upload";

interface Props { navigate: (p: Page) => void; setPendingEmail: (email: string) => void; }

const GoogleIcon = (
  <svg className="google-icon" width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

const INDUSTRIES = ["Fashion & Apparel", "Beauty & Cosmetics", "Tech & SaaS", "Health & Wellness", "Food & Beverage", "Fitness", "Design & Home", "Jewellery & Accessories", "Skincare", "Haircare", "Travel & Hospitality", "Parenting & Family", "Pet Care", "Finance & Fintech", "Education & E-learning", "Gaming", "Automotive", "Sports & Outdoors", "Luxury Goods", "Sustainability & Eco", "Alcohol & Beverages", "Subscription Boxes", "Home & Garden", "Art & Creative Tools"];
const ACTIVATION_TYPES = ["UGC Video Assets", "Instagram Reels", "Instagram Stories", "Instagram Carousels", "TikTok Placements", "YouTube Shorts", "Product Reviews", "Unboxings", "Tutorials", "Long-form Vlogs", "GRWM", "Hauls", "Comparisons", "Livestreams", "Podcasts", "Testimonials", "Dedicated Demos"];
const CREATOR_TIERS = [
  { label: "Nano-Tier Scale", sub: "Under 10k: High-engagement niche focus", value: "nano" },
  { label: "Micro-Tier Authority", sub: "10k - 100k: Optimized for reach & conversion", value: "micro" },
  { label: "Mid-Tier Influence", sub: "100k - 500k: Established market presence", value: "mid" },
  { label: "Macro-Tier Reach", sub: "500k - 1M: Mass awareness spikes", value: "macro" },
  { label: "Elite/Mega Impact", sub: "1M+: Cultural celebrity & global visibility", value: "mega" }
];
const TOTAL_SCREENS = 8;
const COMING_SOON_SOCIALS = ["YouTube", "Twitter/X", "Pinterest"];
const CONNECTABLE_SOCIALS: { platform: SocialPlatform; label: string; icon: (size: number) => React.ReactNode }[] = [
  { platform: "tiktok", label: "TikTok", icon: (size) => <TikTokIcon size={size} /> },
  { platform: "instagram", label: "Instagram", icon: (size) => <InstagramIcon size={size} /> },
];

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
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [socialNotice, setSocialNotice] = useState("");

  const logoRef = useRef<HTMLInputElement>(null);

  // Restored unconditionally, regardless of auth state - a plain refresh
  // during the early, pre-signup screens has no Supabase session yet, so
  // gating this behind a logged-in user (as before) meant it only ever
  // resumed after an OAuth redirect and silently did nothing on a normal
  // refresh, which looked like an inconsistent/broken feature.
  useEffect(() => {
    const draft = peekOnboardingDraft("brand");
    logEvent(`BrandOnboarding mount: draftFound=${!!draft}`);
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
      setScreen(typeof draft.screen === "number" ? draft.screen : 5);
    }
  }, []);

  // Autosaves on every step change, on top of the existing pre-redirect
  // saves below (still needed for same-screen redirects, like connecting a
  // social account, where screen doesn't change). Skips the very first run
  // (mount) so it doesn't fire before the restore effect's setState calls
  // above have landed and overwrite a just-restored draft with blank
  // defaults.
  const skippedFirstAutosave = useRef(false);
  useEffect(() => {
    if (!skippedFirstAutosave.current) { skippedFirstAutosave.current = true; return; }
    saveOnboardingDraft("brand", {
      companyName, selectedIndustries, location, website, bio, targetAudience,
      contentTypes, targetTier, termsAccepted, screen,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      logEvent(`BrandOnboarding mount: hasUser=${!!user} emailConfirmed=${!!user?.email_confirmed_at} provider=${user?.app_metadata?.provider ?? "n/a"}`);
      if (!user) return;

      if (user.app_metadata?.provider && user.app_metadata.provider !== "email") {
        setIsOAuthUser(true);
        setEmail(user.email || "");
      }

      if (user.email_confirmed_at) {
        getSocialConnections(user.id).then(setSocialConnections);
      }

      const params = new URLSearchParams(window.location.search);
      const connected = params.get("social_connected");
      const socialError = params.get("social_error");
      if (connected === "tiktok" || connected === "instagram") {
        setSocialNotice(`${connected === "tiktok" ? "TikTok" : "Instagram"} connected.`);
      } else if (socialError) {
        setSocialNotice(`Couldn't connect: ${socialError}`);
      }
      if (connected || socialError) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    });
  }, []);

  const handleConnectSocial = async (platform: SocialPlatform) => {
    setConnectingPlatform(platform);
    saveOnboardingDraft("brand", {
      companyName, selectedIndustries, location, website, bio, targetAudience, contentTypes, targetTier, termsAccepted,
      screen: 6,
    });
    try {
      await startSocialConnect(platform);
    } catch (err) {
      setSocialNotice(`Couldn't start connection: ${(err as Error).message}`);
      setConnectingPlatform(null);
    }
  };

  const handleGoogleCredential = async (idToken: string, nonce: string) => {
    // Saved right before the sign-in call (not eagerly on click) - App.tsx's
    // global auth listener fires the moment this succeeds and needs the
    // draft in place to route back to this same wizard instead of
    // role-select, regardless of which page happens to be showing.
    saveOnboardingDraft("brand", {
      companyName, selectedIndustries, location, website, bio, targetAudience, contentTypes, targetTier, termsAccepted,
    });
    const { data, error: idTokenError } = await signInWithGoogleIdToken(idToken, nonce);
    if (idTokenError) {
      setError(idTokenError.message);
      return;
    }
    // The ID-token flow is a client-side popup, not a page redirect - this
    // component never remounts, so nothing else re-checks auth state after
    // this. Without updating it here directly, the screen keeps showing the
    // email/password form (even though sign-in already succeeded) until the
    // user leaves and comes back and the mount effect finally catches up.
    if (data.user) {
      setIsOAuthUser(true);
      setEmail(data.user.email || "");
    }
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
        try {
          const publicUrl = await uploadToR2({ purpose: "avatar", file: logoFile });
          logoUrl = `${publicUrl}?t=${Date.now()}`;
        } catch (err) {
          console.log("Asset upload catch:", (err as Error).message);
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
    boxSizing: "border-box",
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
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Corporate Protocol</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "1rem" }}>Initialize corporate identity</h1>
      <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2.5rem" }}>Establish parameters to connect with creators who match your target positioning.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase" }}>Registered Business Name</label>
        <input style={inputStyle} placeholder="e.g. Acme Corporation" value={companyName} onChange={e => setCompanyName(e.target.value)} autoFocus />
      </div>
    </div>,

    // Screen 1 — Positioning
    <div key={1}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Market Segment</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Select sector alignment</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Creators categorize partnership offers by operational fields.</p>
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
      <div onMouseDown={() => addIndustry(industryInput)} style={{ padding: "10px 14px", fontSize: "13px", color: "#999", cursor: "pointer", borderTop: filteredIndustries.length ? "1px solid #1a1a1a" : "none" }}>
        Add "{industryInput}"
      </div>
    </div>
  )}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
  <div>
    <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Headquarters Location</label>
    <LocationInput inputStyle={inputStyle} value={location} onChange={setLocation} />
  </div>
</div>
    </div>,

    // Screen 2 — Web Presence & Description
    <div key={2}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Corporate Profile</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Verification parameters</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Provide credentials to support verification steps.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Corporate Website URL</label>
          <input style={inputStyle} placeholder="https://yourbrand.com" value={website} onChange={e => setWebsite(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Executive Summary / Mission Statement</label>
          <input style={inputStyle} placeholder="Describe your brand voice and creative philosophy..." value={bio} onChange={e => setBio(e.target.value)} />
        </div>
      </div>
    </div>,

    // Screen 3 — Campaign & Activation Directives
    <div key={3}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Asset Strategies</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Required media formats</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Select the asset distributions required for your placements.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "2rem" }}>
        {ACTIVATION_TYPES.map(act => (
          <div key={act} onClick={() => toggleContent(act)} style={chipStyle(contentTypes.includes(act))}>
            {act}
          </div>
        ))}
      </div>
      <div>
        <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Target Demographics</label>
        <input style={inputStyle} placeholder="e.g. Gen Z Design Enthusiasts, UK Tech Professionals" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} />
      </div>
    </div>,

    // Screen 4 — Strategic Alignment & Capital Allocation
    <div key={4}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Strategic Alignment</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What is your target creator tier?</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Defining your target allows our algorithm to prioritize the right talent for your brand voice.</p>
      
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
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Authentication</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Secure corporate portal</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Credentials are handled in compliance with standardized protocols.</p>
      {isOAuthUser ? (
        <div style={{ padding: "12px 14px", background: "#111", border: "1px solid #222", borderRadius: "8px", fontSize: "13px", color: "#fff" }}>
          Continuing as <strong>{email}</strong> via Google
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Corporate Email Address</label>
            <input style={inputStyle} placeholder="hello@company.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Portal Password</label>
            <input style={inputStyle} placeholder="••••••••" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Confirm Portal Password</label>
            <input style={inputStyle} placeholder="••••••••" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#222" }} />
            <span style={{ fontSize: "11px", color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "#222" }} />
          </div>

          <GoogleSignInButton onCredential={handleGoogleCredential}>
            <div
              style={{ padding: "13px", borderRadius: "10px", border: "1px solid #222", background: "transparent", color: "#fff", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer" }}
            >
              {GoogleIcon} Continue with Google
            </div>
          </GoogleSignInButton>
        </div>
      )}
      {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}
      {!termsAccepted && (
        <div onClick={() => setShowTerms(true)} style={{ marginTop: "1rem", padding: "10px 14px", background: "#111", border: "1px solid #222", borderRadius: "8px", fontSize: "12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Read & accept Terms and Conditions</span>
          <span style={{ color: "#999" }}>Required →</span>
        </div>
      )}
      {termsAccepted && (
        <p style={{ color: "#fff", fontSize: "12px", marginTop: "1rem" }}>✓ Terms accepted</p>
      )}
      <div onClick={() => setShowPrivacy(true)} style={{ marginTop: "8px", padding: "10px 14px", background: "#111", border: "1px solid #222", borderRadius: "8px", fontSize: "12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
  <span>Read Privacy Policy</span>
  <span style={{ color: "#999" }}>View →</span>
</div>
    </div>,

    // Screen 6 — Connect socials
    <div key={6}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Build Trust</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Connect your socials</h1>
      <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2rem" }}>
        Verified brands get more replies from creators. Connect TikTok or Instagram to show a verified account on your profile — no posting access needed, just proof it's really you.
      </p>
      {socialNotice && (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: "10px", padding: "10px 14px", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "12px", color: "#ccc" }}>{socialNotice}</p>
          <span onClick={() => setSocialNotice("")} style={{ color: "#999", cursor: "pointer", fontSize: "14px" }}>✕</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {CONNECTABLE_SOCIALS.map(({ platform, label, icon }) => {
          const connection = socialConnections.find(c => c.platform === platform);
          return (
            <div key={platform} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {icon(22)}
                  <div>
                    <p style={{ fontSize: "14px", color: "#fff", fontWeight: 600 }}>{label}</p>
                    {connection && <p style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>{connection.username ? `@${connection.username}` : "Connected"}</p>}
                  </div>
                </div>
                {connection ? (
                  <span style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", color: "#34c759" }}>Connected ✓</span>
                ) : (
                  <span onClick={() => handleConnectSocial(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #fff", color: "#fff", cursor: connectingPlatform ? "default" : "pointer", opacity: connectingPlatform && connectingPlatform !== platform ? 0.4 : 1 }}>
                    {connectingPlatform === platform ? "Connecting..." : "Connect"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {COMING_SOON_SOCIALS.map(platform => (
          <div key={platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
            <p style={{ fontSize: "14px", color: "#999", fontWeight: 500 }}>{platform}</p>
            <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #222", color: "#777" }}>Coming soon</span>
          </div>
        ))}
      </div>
    </div>,

    // Screen 7 — Visual Branding Identification
    <div key={7}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Visual Assets</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Upload brand iconography</h1>
      <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2rem" }}>Identifiable logomarks build consistency and trust throughout application touchpoints.</p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <div onClick={() => logoRef.current?.click()} style={{ width: "110px", height: "110px", borderRadius: "14px", border: `2px dashed ${brandLogo ? "#fff" : "#333"}`, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", transition: "border-color 0.2s" }}>
          {brandLogo
            ? <img src={brandLogo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: "32px", color: "#777" }}>+</span>}
        </div>
        <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
        <p style={{ fontSize: "12px", color: "#888" }}>{brandLogo ? "Modify logomark" : "Assign logomark"}</p>
      </div>
    </div>,
  ];

  const canProceed = () => {
    if (screen === 0) return !!companyName.trim();
    if (screen === 4) return !!targetTier;
    if (screen === 5) return isOAuthUser ? termsAccepted : (!!email.trim() && password.length >= 6 && password === confirm && termsAccepted);
    return true;
  };

  const buttonLabel = () => {
    if (screen === 0) return companyName.trim() ? "Continue →" : "Enter company name to proceed";
    if (screen === 1) return (selectedIndustries.length > 0 || location.trim()) ? "Continue →" : "Skip step →";
    if (screen === 2) return (website.trim() || bio.trim()) ? "Continue →" : "Skip step →";
    if (screen === 3) return (contentTypes.length > 0 || targetAudience.trim()) ? "Continue →" : "Skip step →";
    if (screen === 4) return targetTier ? "Continue →" : "Provide parameters to proceed";
    if (screen === 5) {
      if (!termsAccepted) return "Accept Terms and Conditions to proceed";
      if (!isOAuthUser && !email.trim()) return "Enter your email to proceed";
      if (!isOAuthUser && password.length < 6) return "Password must be at least 6 characters";
      if (!isOAuthUser && password !== confirm) return "Passwords must match";
      return "Continue →";
    }
    if (screen === 6) return socialConnections.length > 0 ? "Continue →" : "Skip for now →";
    if (screen === 7) return "Review Agreements & Deploy →";
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
      <div style={{ height: "4px", background: "#262626", borderRadius: "2px", position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: "1.25rem", right: "1.25rem", zIndex: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: "2px", background: "#fff", width: `${progress}%`, transition: "width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)" }} />
      </div>

      {/* Top Nav */}
      <div style={{ padding: "1.25rem 1.25rem 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "calc(22px + env(safe-area-inset-top, 0px))" }}>
        {screen > 0
          ? <span onClick={back} style={{ fontSize: "18px", color: "#999", cursor: "pointer", padding: "4px" }}>←</span>
          : <span onClick={() => navigate("role-select")} style={{ fontSize: "12px", color: "#888", cursor: "pointer" }}>← Back</span>}
        <span style={{ fontSize: "12px", color: "#777" }}>{screen + 1} / {TOTAL_SCREENS}</span>
      </div>

      {/* Screen Content */}
      <div
        key={screen}
        className={animating ? "" : direction === "forward" ? "slide-forward" : "slide-back"}
        style={{ flex: 1, padding: "2rem 1.5rem", overflowY: "auto", paddingBottom: "calc(16rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {screens[screen]}
      </div>

      {/* Bottom Control Area */}
      {/* pointerEvents:none on the wrapper is deliberate - the gradient
          fade makes the top of this box visually blend into the page, but
          without this it still silently intercepts taps on whatever content
          is scrolled underneath it. Only the actual button(s) re-enable
          pointer events. */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "0.5rem 1.5rem calc(0.75rem + env(safe-area-inset-bottom, 0px))", background: "linear-gradient(to top, #0a0a0a 60%, transparent)", pointerEvents: "none" }}>
        {screen === 7 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              onClick={loading ? undefined : handleFinish}
              style={{ padding: "16px", borderRadius: "12px", background: "#fff", color: "#0a0a0a", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: loading ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", opacity: loading ? 0.7 : 1, pointerEvents: "auto" }}
            >
              {loading ? "Registering profile..." : "Finish & Initialize →"}
            </div>
            <div
              onClick={loading ? undefined : handleFinish}
              style={{ padding: "14px", borderRadius: "12px", background: "transparent", color: "#888", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.05em", pointerEvents: "auto" }}
            >
              Skip configuration
            </div>
          </div>
        ) : (
          <div
            className="tap-btn"
            onClick={(!loading && canProceed()) ? (screen === 5 ? (isOAuthUser ? next : handleSignup) : next) : undefined}
            style={{ padding: "16px", borderRadius: "12px", background: canProceed() ? "#fff" : "#1a1a1a", color: canProceed() ? "#0a0a0a" : "#333", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: (!loading && canProceed()) ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s", border: canProceed() ? "none" : "1px solid #222", opacity: (screen === 5 && loading) ? 0.6 : 1, pointerEvents: (screen === 5 && loading) ? "none" : "auto" }}
          >
            {screen === 5 && loading ? "Sending code..." : buttonLabel()}
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
            <img src="/icon-512.png" width="64" height="64" alt="FlipCollab" style={{ display: "block", width: "64px", height: "64px", borderRadius: "14px", margin: "0 auto 1.25rem auto" }} />

            <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#888", marginBottom: "0.75rem" }}>One more step</p>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.75rem" }}>Enter your code</h1>
            <p style={{ fontSize: "13px", color: "#999", lineHeight: 1.7, marginBottom: "1.75rem" }}>
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
            {otpLoading && <p style={{ fontSize: "12px", color: "#999", marginBottom: "1rem" }}>Verifying...</p>}

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