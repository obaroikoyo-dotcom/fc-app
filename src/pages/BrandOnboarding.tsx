import { useState, useRef } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import TermsModal from "./TermsModal"; // Assumes TermsModal is in the same folder

interface Props { navigate: (p: Page) => void; }

const INDUSTRIES = ["Fashion & Apparel", "Beauty & Cosmetics", "Tech & SaaS", "Health & Wellness", "Food & Beverage", "Fitness", "Design & Home"];
const ACTIVATION_TYPES = ["UGC Video Assets", "Instagram Reels", "TikTok Placements", "Product Reviews", "Long-form Vlogs", "Dedicated Demos"];
const CREATOR_TIERS = [
  { label: "Nano-Tier Scale", sub: "Under 10k: High-engagement niche focus", value: "nano" },
  { label: "Micro-Tier Authority", sub: "10k - 100k: Optimized for reach & conversion", value: "micro" },
  { label: "Mid-Tier Influence", sub: "100k - 500k: Established market presence", value: "mid" },
  { label: "Macro-Tier Reach", sub: "500k - 1M: Mass awareness spikes", value: "macro" },
  { label: "Elite/Mega Impact", sub: "1M+: Cultural celebrity & global visibility", value: "mega" }
];
const TOTAL_SCREENS = 7;

export default function BrandOnboarding({ navigate }: Props) {
  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  // Corporate Onboarding Form State
  const [companyName, setCompanyName] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [targetTier, setTargetTier] = useState(""); // Replaced budgetRange state with targetTier
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal Control Interceptor State
  const [showTerms, setShowTerms] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);

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

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setBrandLogo(URL.createObjectURL(file));
    }
  };

  // Intercept method to make sure terms are approved right before hitting database
  const triggerTermsCheck = () => {
    setError("");
    if (!email || !password) {
      setError("Corporate credentials required.");
      setScreen(5); // Bring them back to fix authentication text inputs
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      setScreen(5);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setScreen(5);
      return;
    }
    
    // Open terms modal gateway
    setShowTerms(true);
  };

 const handleFinish = async () => {
    setError("");
    if (!email || !password) return setError("Corporate credentials required.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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
        setScreen(5); 
        return;
      }

      const targetUser = signUpData?.user;

      if (targetUser) {
        // 1. Core structural profile hook (Await completely before going to step 2)
        const { error: coreError } = await supabase
          .from("profiles")
          .insert({ id: targetUser.id, role: "brand", email });

        if (coreError) console.log("Core profile save notice:", coreError.message);

        // 2. Handle visual asset identification payload
        let logoUrl = null;
        if (logoFile) {
          const fileExt = logoFile.name.split(".").pop()?.toLowerCase();
          const filePath = `brands/${targetUser.id}.${fileExt}`;
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

        // 3. Populate dedicated brand parameters row
        const { error: profileError } = await supabase.from("brand_profiles").insert({
          id: targetUser.id, // Explicitly anchor the row identifier
          company_name: companyName,
          name: companyName,
          industry: selectedIndustry,
          niche: selectedIndustry,
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
      } else {
        setError("Unable to initialize corporate security context token.");
        setLoading(false);
        return;
      }

      // 4. Structural transaction verified. Proceed to dashboard layout.
      setLoading(false);
      navigate("brand-dashboard");

    } catch (catchErr: any) {
      console.error("Onboarding pipeline crash intercepted:", catchErr);
      setError("A network transaction interruption occurred. Please re-verify entries.");
      setLoading(false);
    }
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "2rem" }}>
        {INDUSTRIES.map(ind => (
          <div key={ind} onClick={() => setSelectedIndustry(ind)} style={chipStyle(selectedIndustry === ind)}>
            {ind}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Headquarters Location</label>
          <input style={inputStyle} placeholder="e.g. London, UK" value={location} onChange={e => setLocation(e.target.value)} />
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

    // Screen 4 — Strategic Alignment
    <div key={4}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Strategic Alignment</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What is your target creator tier?</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Defining your target allows our algorithm to prioritize the right talent for your brand voice.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
      </div>
      {error && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "1rem" }}>{error}</p>}
      <div style={{ marginTop: "1rem", padding: "10px 14px", background: "#111", border: "1px solid #222", borderRadius: "8px", fontSize: "12px", color: "#777", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
  <span>Terms & Conditions will be shown before account creation</span>
  <span style={{ color: "#555" }}>Required</span>
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
    if (screen === 1) return (selectedIndustry || location.trim()) ? "Continue →" : "Skip step →";
    if (screen === 2) return (website.trim() || bio.trim()) ? "Continue →" : "Skip step →";
    if (screen === 3) return (contentTypes.length > 0 || targetAudience.trim()) ? "Continue →" : "Skip step →";
    if (screen === 4) return targetTier ? "Continue →" : "Skip step →"; // Corrected condition tracker
    if (screen === 5) return email.trim() && password.length >= 6 && password === confirm ? "Continue →" : null;
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
              onClick={loading ? undefined : triggerTermsCheck}
              style={{ padding: "16px", borderRadius: "12px", background: "#fff", color: "#0a0a0a", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: loading ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Registering profile..." : "Finish & Initialize →"}
            </div>
            <div
              onClick={loading ? undefined : triggerTermsCheck}
              style={{ padding: "14px", borderRadius: "12px", background: "transparent", color: "#444", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.05em" }}
            >
              Skip configuration
            </div>
          </div>
        ) : (
          <div
            onClick={buttonLabel() ? next : undefined}
            style={{ padding: "16px", borderRadius: "12px", background: buttonLabel() ? "#fff" : "#1a1a1a", color: buttonLabel() ? "#0a0a0a" : "#333", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: buttonLabel() ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s", border: buttonLabel() ? "none" : "1px solid #222" }}
          >
            {buttonLabel() || "Provide name to proceed"}
          </div>
        )}
      </div>

      {/* Terms & Conditions Modal Overlay Interceptor */}
      <TermsModal 
        isOpen={showTerms}
        role="brand"
        onClose={() => setShowTerms(false)}
        onAccept={() => {
          setShowTerms(false);
          handleFinish(); // Fires original Supabase write flow smoothly
        }}
      />
    </div>
  );
}