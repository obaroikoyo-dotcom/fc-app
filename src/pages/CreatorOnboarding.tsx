import { useState, useRef } from "react";
import TermsModal from "./TermsModal";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter/X", "Facebook", "Pinterest"];
const CONTENT_TYPES = ["Photos", "Reels", "UGC Videos", "Stories", "Reviews", "Unboxings", "Tutorials", "Vlogs"];
const TOTAL_SCREENS = 8;

export default function CreatorOnboarding({ navigate }: Props) {
  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  // Form data
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, string>>({});
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [rates, setRates] = useState({ post: "", story: "", reel: "", video: "", ugc: "" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
const [showTerms, setShowTerms] = useState(false);
const [termsAccepted, setTermsAccepted] = useState(false);

  const picRef = useRef<HTMLInputElement>(null);

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

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const toggleContent = (c: string) =>
    setContentTypes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const handlePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileFile(file);
      setProfilePic(URL.createObjectURL(file));
    }
  };

  const handleFinish = async () => {
    setError("");
    if (!email || !password) return setError("Email and password required.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "creator", name } }
    });

   if (signUpError) {
  if (signUpError.message.toLowerCase().includes("already")) {
    setError("This email is already registered. Try signing in instead.");
  } else {
    setError(signUpError.message);
  }
  setLoading(false);
  setScreen(5);
  return;
}

    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, role: "creator", email });

      let avatarUrl = null;
      if (profileFile) {
        const fileExt = profileFile.name.split(".").pop()?.toLowerCase();
        const filePath = `creators/${data.user.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, profileFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
          avatarUrl = urlData.publicUrl;
        }
      }

      await supabase.from("profiles").insert({
        id: data.user.id,
        name,
        niche,
        location,
        platforms: selectedPlatforms,
        social_links: socialLinks,
        follower_counts: followerCounts,
        content_types: contentTypes,
        rates,
        avatar_url: avatarUrl,
        onboarding_complete: true,
        available: true,
      });
    }

    setLoading(false);
    navigate("explore");
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
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Welcome to FlipCollab</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "1rem" }}>Let's build your creator profile</h1>
      <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7, marginBottom: "2.5rem" }}>Takes about 2 minutes. Your profile helps brands find and connect with you for paid and gifted collabs.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your full name</label>
        <input style={inputStyle} placeholder="e.g. Sofia Martinez" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>
    </div>,

    // Screen 1 — Niche & Location
    <div key={1}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Your Space</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What do you create?</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Brands search by niche to find the right creators.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Niche</label>
          <input style={inputStyle} placeholder="e.g. Beauty, Fitness, Lifestyle" value={niche} onChange={e => setNiche(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Location</label>
          <input style={inputStyle} placeholder="e.g. London, UK" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
      </div>
    </div>,

    // Screen 2 — Platforms
    <div key={2}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Platforms</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Where do you post?</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Select all that apply. You can add more later.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "2rem" }}>
        {PLATFORMS.map(p => <div key={p} onClick={() => togglePlatform(p)} style={chipStyle(selectedPlatforms.includes(p))}>{p}</div>)}
      </div>
      {selectedPlatforms.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your handles & followers</label>
          {selectedPlatforms.map(p => (
            <div key={p} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
              <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>{p}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input style={inputStyle} placeholder={`${p} profile link`} value={socialLinks[p] || ""} onChange={e => setSocialLinks(prev => ({ ...prev, [p]: e.target.value }))} />
                <input style={inputStyle} placeholder="Follower count" type="number" value={followerCounts[p] || ""} onChange={e => setFollowerCounts(prev => ({ ...prev, [p]: e.target.value }))} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>,

    // Screen 3 — Content Types
    <div key={3}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Content</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What do you make?</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Select everything you're comfortable creating.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {CONTENT_TYPES.map(c => <div key={c} onClick={() => toggleContent(c)} style={chipStyle(contentTypes.includes(c))}>{c}</div>)}
      </div>
    </div>,

    // Screen 4 — Rate Card
    <div key={4}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Your Rates</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What do you charge?</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Optional but helps brands know if you're in their budget. You can always update this later.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[
          { key: "post", label: "Feed Post" },
          { key: "story", label: "Story" },
          { key: "reel", label: "Reel" },
          { key: "video", label: "Video" },
          { key: "ugc", label: "UGC Only (no posting)" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>{label}</label>
            <input style={inputStyle} placeholder="£" type="number" value={rates[key as keyof typeof rates]} onChange={e => setRates(r => ({ ...r, [key]: e.target.value }))} />
          </div>
        ))}
      </div>
    </div>,

    // Screen 5 — Sign Up
    <div key={5}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Almost There</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Create your account</h1>
      <p style={{ fontSize: "14px", color: "#555", marginBottom: "2rem" }}>Your details are safe and never shared with brands without your permission.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Email</label>
          <input style={inputStyle} placeholder="you@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Password</label>
          <input style={inputStyle} placeholder="••••••••" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Confirm Password</label>
          <input style={inputStyle} placeholder="••••••••" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
      </div>
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
    </div>,

    // Screen 6 — Profile Photo
    <div key={6}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Almost Done</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Add a profile photo</h1>
      <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7, marginBottom: "2rem" }}>Optional, but creators with a photo get <span style={{ color: "#fff", fontWeight: 600 }}>3x more brand reach-outs</span>. You can always add one later from your profile.</p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <div onClick={() => picRef.current?.click()} style={{ width: "110px", height: "110px", borderRadius: "50%", border: `2px dashed ${profilePic ? "#fff" : "#333"}`, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", transition: "border-color 0.2s" }}>
          {profilePic
            ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: "32px", color: "#333" }}>+</span>}
        </div>
        <input ref={picRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePic} />
        <p style={{ fontSize: "12px", color: "#444" }}>{profilePic ? "Tap to change" : "Tap to upload"}</p>
      </div>
    </div>,

    // Screen 7 — Done
    <div key={7} style={{ textAlign: "center" }}>
      <div style={{ fontSize: "48px", marginBottom: "1.5rem" }}>🎉</div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "1rem" }}>You're all set!</h1>
      <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7, marginBottom: "2.5rem" }}>Your profile is live. Start exploring brand campaigns and apply to the ones that fit your style.</p>
    </div>,
  ];

const buttonLabel = () => {
  if (screen === 0) return name.trim() ? "Continue →" : null;
  if (screen === 1) return (niche.trim() || location.trim()) ? "Continue →" : "Skip for now →";
  if (screen === 2) return selectedPlatforms.length > 0 ? "Continue →" : "Skip for now →";
  if (screen === 3) return contentTypes.length > 0 ? "Continue →" : "Skip for now →";
  if (screen === 4) return Object.values(rates).some(v => v) ? "Continue →" : "Skip for now →";
  if (screen === 5) return email.trim() && password.length >= 6 && password === confirm && termsAccepted ? "Continue →" : null;
  if (screen === 6) return profilePic ? "Finish & Go Explore →" : "Skip for now →";
  return "Continue →";
};

  const isLastScreen = screen === TOTAL_SCREENS - 1;
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

      {/* Bottom Button */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "1.25rem 1.5rem 2rem", background: "linear-gradient(to top, #0a0a0a 60%, transparent)" }}>
        {isLastScreen ? (
          <div
            onClick={() => navigate("explore")}
            style={{ padding: "16px", borderRadius: "12px", background: "#fff", color: "#0a0a0a", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Start Exploring →
          </div>
        ) : screen === 6 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              onClick={loading ? undefined : handleFinish}
              style={{ padding: "16px", borderRadius: "12px", background: "#fff", color: "#0a0a0a", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: loading ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Creating account..." : "Finish & Go Explore →"}
            </div>
            <div
              onClick={loading ? undefined : handleFinish}
              style={{ padding: "14px", borderRadius: "12px", background: "transparent", color: "#444", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.05em" }}
            >
              Skip for now
            </div>
          </div>
        ) : (
          <div
         onClick={buttonLabel() ? next : undefined}
  style={{ padding: "16px", borderRadius: "12px", background: buttonLabel() ? "#fff" : "#1a1a1a", color: buttonLabel() ? "#0a0a0a" : "#333", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: buttonLabel() ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s", border: buttonLabel() ? "none" : "1px solid #222" }}
>
  {buttonLabel() || "Enter your name to continue"}
</div>
        )}
      </div>
      <TermsModal
  isOpen={showTerms}
  onAccept={() => { setTermsAccepted(true); setShowTerms(false); }}
  onClose={() => setShowTerms(false)}
  role="creator"
/>
    </div>
  );
}