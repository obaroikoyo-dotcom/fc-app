import { useState, useRef, useEffect } from "react";
import PrivacyModal from "./PrivacyModal";
import LocationInput from "../components/LocationInput";
import TermsModal from "./TermsModal";
import { type Page } from "../App";
import { supabase, signInWithGoogleIdToken } from "../lib/supabase";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { saveOnboardingDraft, peekOnboardingDraft, clearOnboardingDraft } from "../lib/onboardingDraft";
import { logEvent } from "../lib/debugLog";
import { NICHES } from "../lib/niches";
import { startSocialConnect, getSocialConnections, getSocialPostOptions, setFeaturedPosts, MAX_FEATURED_POSTS, type SocialConnection, type SocialPlatform, type SocialPostOption } from "../lib/social";
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

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter/X", "Facebook", "Pinterest"];
const CONTENT_TYPES = ["Photos", "Reels", "UGC Videos", "Stories", "Reviews", "Unboxings", "Tutorials", "Vlogs", "Hauls", "GRWM", "Comparisons", "Skits", "Livestreams", "Carousels", "Podcasts", "Testimonials", "Video Editing"];
const TOTAL_SCREENS = 9;
const PLATFORM_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const UNAVAILABLE_PLATFORMS = ["Twitter/X", "Facebook", "Pinterest"];

function usernamesMatch(typed: string, real: string | null): boolean {
  if (!typed || !real) return true;
  const norm = (s: string) => s.trim().toLowerCase().replace(/^@/, "");
  return norm(typed) === norm(real);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 92 }, (_, i) => String(CURRENT_YEAR - 8 - i));

function calculateAge(day: string, month: string, year: string): number | null {
  if (!day || !month || !year) return null;
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex === -1) return null;
  const birth = new Date(parseInt(year, 10), monthIndex, parseInt(day, 10));
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear = today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}

// A native <select> instead of a custom dropdown - no portal/z-index
// juggling needed, so it can never visually collide with the fixed
// Continue button, and the OS renders the open list itself.
function DateSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: "100%", appearance: "none", WebkitAppearance: "none", background: "#111", border: "1px solid #222", borderRadius: "10px", padding: "13px 30px 13px 14px", color: value ? "#fff" : "#555", fontSize: "14px", fontFamily: "inherit", cursor: "pointer" }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{ position: "absolute", top: "50%", right: "14px", transform: "translateY(-50%)", color: "#888", fontSize: "10px", pointerEvents: "none" }}>▼</span>
    </div>
  );
}

export default function CreatorOnboarding({ navigate, setPendingEmail }: Props) {
  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  // Form data
  const [name, setName] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [showAgeWarning, setShowAgeWarning] = useState(false);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
const [nicheInput, setNicheInput] = useState("");
const [showNicheDropdown, setShowNicheDropdown] = useState(false);
  const [location, setLocation] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, string>>({});
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [rates, setRates] = useState({ post: "", story: "", reel: "", video: "", ugc: "" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
  const picRef = useRef<HTMLInputElement>(null);
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [socialNotice, setSocialNotice] = useState("");
  const [pickerPlatform, setPickerPlatform] = useState<SocialPlatform | null>(null);
  const [postOptions, setPostOptions] = useState<SocialPostOption[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [savingSelection, setSavingSelection] = useState(false);

  // Restored unconditionally, regardless of auth state - a plain refresh
  // during the early, pre-signup screens has no Supabase session yet, so
  // gating this behind a logged-in user (as before) meant it only ever
  // resumed after an OAuth redirect and silently did nothing on a normal
  // refresh, which looked like an inconsistent/broken feature.
  useEffect(() => {
    const draft = peekOnboardingDraft("creator");
    logEvent(`CreatorOnboarding mount: draftFound=${!!draft}`);
    if (draft) {
      if (typeof draft.name === "string") setName(draft.name);
      if (typeof draft.birthDay === "string") setBirthDay(draft.birthDay);
      if (typeof draft.birthMonth === "string") setBirthMonth(draft.birthMonth);
      if (typeof draft.birthYear === "string") setBirthYear(draft.birthYear);
      if (Array.isArray(draft.selectedNiches)) setSelectedNiches(draft.selectedNiches as string[]);
      if (typeof draft.location === "string") setLocation(draft.location);
      if (Array.isArray(draft.selectedPlatforms)) setSelectedPlatforms(draft.selectedPlatforms as string[]);
      if (draft.socialLinks && typeof draft.socialLinks === "object") setSocialLinks(draft.socialLinks as Record<string, string>);
      if (draft.followerCounts && typeof draft.followerCounts === "object") setFollowerCounts(draft.followerCounts as Record<string, string>);
      if (Array.isArray(draft.contentTypes)) setContentTypes(draft.contentTypes as string[]);
      if (draft.rates && typeof draft.rates === "object") setRates(draft.rates as typeof rates);
      if (typeof draft.termsAccepted === "boolean") setTermsAccepted(draft.termsAccepted);
      setScreen(typeof draft.screen === "number" ? draft.screen : 5);
    }
  }, []);

  // Autosaves on every step change, on top of the existing pre-redirect
  // saves below (which are still needed for same-screen redirects, like
  // connecting a social account, where screen doesn't change). Skips the
  // very first run (mount) - otherwise this would fire before the restore
  // effect's setState calls above have landed and overwrite a just-restored
  // draft with blank defaults.
  const skippedFirstAutosave = useRef(false);
  useEffect(() => {
    if (!skippedFirstAutosave.current) { skippedFirstAutosave.current = true; return; }
    saveOnboardingDraft("creator", {
      name, birthDay, birthMonth, birthYear, selectedNiches, location,
      selectedPlatforms, socialLinks, followerCounts, contentTypes, rates, termsAccepted,
      screen,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      logEvent(`CreatorOnboarding mount: hasUser=${!!user} emailConfirmed=${!!user?.email_confirmed_at} provider=${user?.app_metadata?.provider ?? "n/a"}`);
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
      if (connected === "instagram" || connected === "tiktok" || connected === "youtube") {
        openPostPicker(connected);
      } else if (socialError) {
        setSocialNotice(`Couldn't connect: ${socialError}`);
      }
      if (connected || socialError) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    });
  }, []);

  // The moment a connection's real username differs from whatever was
  // typed on the platforms screen, pre-fill that field with the verified
  // one so the mismatch is already resolved by default - the user can just
  // continue. If they go on to edit it into something else that still
  // doesn't match, the live mismatch check below catches that on its own.
  useEffect(() => {
    socialConnections.forEach(connection => {
      const label = PLATFORM_LABEL[connection.platform];
      if (connection.username && socialLinks[label] !== connection.username && !usernamesMatch(socialLinks[label] || "", connection.username)) {
        setSocialLinks(prev => ({ ...prev, [label]: connection.username! }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialConnections]);

  const handleConnectSocial = async (platform: SocialPlatform) => {
    setConnectingPlatform(platform);
    saveOnboardingDraft("creator", {
      name, birthDay, birthMonth, birthYear, selectedNiches, location,
      selectedPlatforms, socialLinks, followerCounts, contentTypes, rates, termsAccepted,
      screen: 6,
    });
    try {
      await startSocialConnect(platform);
    } catch (err) {
      setSocialNotice(`Couldn't start connection: ${(err as Error).message}`);
      setConnectingPlatform(null);
    }
  };

  const openPostPicker = async (platform: SocialPlatform) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const options = await getSocialPostOptions(user.id, platform);
    setPostOptions(options);
    setSelectedPostIds(options.filter(o => o.featured).map(o => o.post_id));
    setPickerPlatform(platform);
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPostIds(prev => {
      if (prev.includes(postId)) return prev.filter(id => id !== postId);
      if (prev.length >= MAX_FEATURED_POSTS) return prev;
      return [...prev, postId];
    });
  };

  const savePostSelection = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !pickerPlatform) return;
    setSavingSelection(true);
    await setFeaturedPosts(user.id, pickerPlatform, selectedPostIds);
    setSavingSelection(false);
    setPickerPlatform(null);
    setSocialNotice("Featured videos updated.");
  };

  const handleGoogleCredential = async (idToken: string, nonce: string) => {
    saveOnboardingDraft("creator", {
      name, birthDay, birthMonth, birthYear, selectedNiches, location,
      selectedPlatforms, socialLinks, followerCounts, contentTypes, rates, termsAccepted,
      screen: 5,
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

  const computedAge = calculateAge(birthDay, birthMonth, birthYear);

  const updateBirthDay = (v: string) => { setBirthDay(v); setShowAgeWarning(false); };
  const updateBirthMonth = (v: string) => { setBirthMonth(v); setShowAgeWarning(false); };
  const updateBirthYear = (v: string) => { setBirthYear(v); setShowAgeWarning(false); };

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

  const handleContinueFromWelcome = () => {
    if (computedAge === null || computedAge < 18) {
      setShowAgeWarning(true);
      return;
    }
    next();
  };
  const back = () => goTo(screen - 1);

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const toggleContent = (c: string) =>
    setContentTypes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const addNiche = (n: string) => {
    const trimmed = n.trim();
    if (trimmed && !selectedNiches.includes(trimmed)) {
      setSelectedNiches(prev => [...prev, trimmed]);
    }
    setNicheInput("");
    setShowNicheDropdown(false);
  };

  const removeNiche = (n: string) =>
    setSelectedNiches(prev => prev.filter(x => x !== n));

  const filteredNiches = NICHES.filter(n =>
    n.toLowerCase().includes(nicheInput.toLowerCase()) && !selectedNiches.includes(n)
  );

  const handlePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileFile(file);
      setProfilePic(URL.createObjectURL(file));
    }
  };

  const handleSignup = async () => {
    setError("");
    if (!email || !password) return setError("Email and password required.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
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
      return;
    }

    setLoading(false);
    setPendingEmail(email);
    setShowOtp(true);
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
      await supabase.from("profiles").insert({ id: user.id, role: "creator", email });

      let avatarUrl = null;
      if (profileFile) {
        try {
          const publicUrl = await uploadToR2({ purpose: "avatar", file: profileFile });
          avatarUrl = `${publicUrl}?t=${Date.now()}`;
        } catch (err) {
          console.error("Failed to upload avatar:", err);
        }
      }

      await supabase.from("creator_profiles").insert({
        id: user.id,
        name,
        age: computedAge,
        niche: selectedNiches.join(", "),
        location,
        avatar_url: avatarUrl,
        platforms: selectedPlatforms,
        social_links: socialLinks,
        follower_counts: followerCounts,
        content_types: contentTypes,
        rates,
        available: true,
        onboarding_complete: true,
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
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Welcome to FlipCollab</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "1rem" }}>Let's build your creator profile</h1>
      <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2.5rem" }}>Your profile helps brands find and connect with you for paid and gifted collabs.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your full name</label>
        <input style={inputStyle} placeholder="e.g. Sofia Martinez" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
        <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase" }}>Date of birth</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <DateSelect value={birthDay} onChange={updateBirthDay} options={DAY_OPTIONS} placeholder="Day" />
          <div style={{ flex: 1.6 }}><DateSelect value={birthMonth} onChange={updateBirthMonth} options={MONTHS} placeholder="Month" /></div>
          <DateSelect value={birthYear} onChange={updateBirthYear} options={YEAR_OPTIONS} placeholder="Year" />
        </div>
        {showAgeWarning && (
          <p style={{ fontSize: "12px", color: "#ff9500", lineHeight: 1.5 }}>
            {computedAge === null ? "Please enter your date of birth to continue." : "You're too young for FlipCollab right now."}
          </p>
        )}
      </div>
    </div>,

    // Screen 1 — Niche & Location
    <div key={1}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Your Space</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What do you create?</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Brands search by niche to find the right creators.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ position: "relative" }}>
  <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Niche</label>

  {selectedNiches.length > 0 && (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
      {selectedNiches.map(n => (
        <div key={n} onClick={() => removeNiche(n)} style={{ padding: "6px 10px", borderRadius: "16px", background: "#fff", color: "#0a0a0a", fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          {n} <span>×</span>
        </div>
      ))}
    </div>
  )}

  <input
    style={inputStyle}
    placeholder="Type to search or add your own"
    value={nicheInput}
    onChange={e => { setNicheInput(e.target.value); setShowNicheDropdown(true); }}
    onFocus={() => setShowNicheDropdown(true)}
    onBlur={() => setTimeout(() => setShowNicheDropdown(false), 150)}
    onKeyDown={e => { if (e.key === "Enter" && nicheInput.trim()) { e.preventDefault(); addNiche(nicheInput); } }}
  />

  {showNicheDropdown && nicheInput && (
    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", background: "#111", border: "1px solid #222", borderRadius: "10px", maxHeight: "180px", overflowY: "auto", zIndex: 20 }}>
      {filteredNiches.map(n => (
        <div key={n} onMouseDown={() => addNiche(n)} style={{ padding: "10px 14px", fontSize: "13px", color: "#fff", cursor: "pointer" }}>{n}</div>
      ))}
      <div onMouseDown={() => addNiche(nicheInput)} style={{ padding: "10px 14px", fontSize: "13px", color: "#999", cursor: "pointer", borderTop: filteredNiches.length ? "1px solid #1a1a1a" : "none" }}>
        Add "{nicheInput}"
      </div>
    </div>
  )}
</div>
        <div>
          <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Location</label>
          <LocationInput inputStyle={inputStyle} value={location} onChange={setLocation} />
        </div>
      </div>
    </div>,

    // Screen 2 — Platforms
    <div key={2}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Platforms</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Where do you post?</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Select all that apply. You can add more later.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "2rem" }}>
        {PLATFORMS.map(p => <div key={p} onClick={() => togglePlatform(p)} style={chipStyle(selectedPlatforms.includes(p))}>{p}</div>)}
      </div>
      {selectedPlatforms.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your handles & followers</label>
          {selectedPlatforms.map(p => (
            <div key={p} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
              <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>{p}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input style={inputStyle} placeholder={`${p} username`} value={socialLinks[p] || ""} onChange={e => setSocialLinks(prev => ({ ...prev, [p]: e.target.value }))} />
                <input style={inputStyle} placeholder="Follower count" type="number" value={followerCounts[p] || ""} onChange={e => setFollowerCounts(prev => ({ ...prev, [p]: e.target.value }))} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>,

    // Screen 3 — Content Types
    <div key={3}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Content</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What do you make?</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Select everything you're comfortable creating.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {CONTENT_TYPES.map(c => <div key={c} onClick={() => toggleContent(c)} style={chipStyle(contentTypes.includes(c))}>{c}</div>)}
      </div>
    </div>,

    // Screen 4 — Rate Card
    <div key={4}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Your Rates</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>What do you charge?</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "1.5rem" }}>Optional. What you'd charge a brand for each one. You can always update this later.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem 0.75rem" }}>
        {[
          { key: "post", label: "Feed post for brand" },
          { key: "story", label: "Story for brand" },
          { key: "reel", label: "Reel for brand" },
          { key: "video", label: "Video for brand" },
          { key: "ugc", label: "UGC only (you film, brand posts)" },
        ].map(({ key, label }, i, all) => (
          <div key={key} style={i === all.length - 1 ? { gridColumn: "1 / -1" } : undefined}>
            <label style={{ fontSize: "12px", color: "#ccc", display: "block", marginBottom: "6px", lineHeight: 1.3 }}>{label}</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#888", fontSize: "15px", pointerEvents: "none" }}>£</span>
              <input style={{ ...inputStyle, width: "100%", paddingLeft: "32px" }} placeholder="0" type="number" min="0" inputMode="decimal" value={rates[key as keyof typeof rates]} onChange={e => setRates(r => ({ ...r, [key]: e.target.value }))} />
            </div>
          </div>
        ))}
      </div>
    </div>,

    // Screen 5 — Sign Up
    <div key={5}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Almost There</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Create your account</h1>
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Your details are safe and never shared with brands without your permission.</p>
      {isOAuthUser ? (
        <div style={{ padding: "12px 14px", background: "#111", border: "1px solid #222", borderRadius: "8px", fontSize: "13px", color: "#fff" }}>
          Continuing as <strong>{email}</strong> via Google
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Email</label>
            <input style={inputStyle} placeholder="you@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Password</label>
            <input style={inputStyle} placeholder="••••••••" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Confirm Password</label>
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

    // Screen 6 — Verify Accounts
    <div key={6}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Prove It's You</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Verify your accounts</h1>
      <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2rem" }}>
        Connect Instagram, TikTok, or YouTube to prove these are really your accounts, and pick up to 5 of your own posts to feature on your public profile. The account you connect should match the username you entered earlier.
      </p>
      {socialNotice && (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: "10px", padding: "10px 14px", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "12px", color: "#ccc" }}>{socialNotice}</p>
          <span onClick={() => setSocialNotice("")} style={{ color: "#999", cursor: "pointer", fontSize: "14px" }}>✕</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {(["instagram", "tiktok", "youtube"] as SocialPlatform[]).map(platform => {
          const connection = socialConnections.find(c => c.platform === platform);
          const label = PLATFORM_LABEL[platform];
          const typedUsername = socialLinks[label];
          const mismatch = !!connection && !!typedUsername && !usernamesMatch(typedUsername, connection.username);
          return (
            <div key={platform} style={{ background: "#111", border: `1px solid ${mismatch ? "#ff3b30" : "#1a1a1a"}`, borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "14px", color: platform === "youtube" ? "#999" : "#fff", fontWeight: platform === "youtube" ? 500 : 600 }}>{label}</p>
                  {connection && <p style={{ fontSize: "11px", color: mismatch ? "#ff3b30" : "#555", marginTop: "2px" }}>{connection.username ? `@${connection.username}` : "Connected"}</p>}
                </div>
                {connection ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span onClick={() => openPostPicker(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #fff", color: "#fff", cursor: "pointer" }}>Choose videos</span>
                    <span style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: `1px solid ${mismatch ? "#ff3b30" : "#333"}`, color: mismatch ? "#ff3b30" : "#34c759" }}>{mismatch ? "Mismatch" : "Connected ✓"}</span>
                  </div>
                ) : platform === "youtube" ? (
                  <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #222", color: "#777" }}>Coming soon</span>
                ) : (
                  <span onClick={() => handleConnectSocial(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #fff", color: "#fff", cursor: connectingPlatform ? "default" : "pointer", opacity: connectingPlatform && connectingPlatform !== platform ? 0.4 : 1 }}>
                    {connectingPlatform === platform ? "Connecting..." : "Connect"}
                  </span>
                )}
              </div>
              {mismatch && (
                <div style={{ marginTop: "10px" }}>
                  <p style={{ fontSize: "11px", color: "#ff3b30", marginBottom: "8px", lineHeight: 1.5 }}>
                    This is @{connection!.username}, but you entered "{typedUsername}" earlier - it needs to match the connected account.
                  </p>
                  <label style={{ fontSize: "10px", color: "#999", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Change username</label>
                  <input
                    style={{ ...inputStyle, padding: "10px 12px", fontSize: "13px" }}
                    value={typedUsername}
                    onChange={e => setSocialLinks(prev => ({ ...prev, [label]: e.target.value }))}
                  />
                </div>
              )}
            </div>
          );
        })}
        {UNAVAILABLE_PLATFORMS.map(platform => (
          <div key={platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
            <p style={{ fontSize: "14px", color: "#999", fontWeight: 500 }}>{platform}</p>
            <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #222", color: "#777" }}>Coming soon</span>
          </div>
        ))}
      </div>
    </div>,

    // Screen 7 — Profile Photo
    <div key={7}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 700, color: "#999", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.5rem" }}>Almost Done</p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.5rem" }}>Add a profile photo</h1>
      <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2rem" }}>Optional, but creators with a photo get <span style={{ color: "#fff", fontWeight: 600 }}>3x more brand reach-outs</span>. You can always add one later from your profile.</p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <div onClick={() => picRef.current?.click()} style={{ width: "110px", height: "110px", borderRadius: "50%", border: `2px dashed ${profilePic ? "#fff" : "#333"}`, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", transition: "border-color 0.2s" }}>
          {profilePic
            ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: "32px", color: "#777" }}>+</span>}
        </div>
        <input ref={picRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePic} />
        <p style={{ fontSize: "12px", color: "#888" }}>{profilePic ? "Tap to change" : "Tap to upload"}</p>
      </div>
    </div>,

    // Screen 8 — Done
    <div key={8} style={{ textAlign: "center" }}>
      <div style={{ fontSize: "48px", marginBottom: "1.5rem" }}>🎉</div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: "1rem" }}>You're all set!</h1>
      <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2.5rem" }}>Your profile is live. Start exploring brand campaigns and apply to the ones that fit your style.</p>
    </div>,
  ];

const canProceed = () => {
  if (screen === 0) return !!name.trim();
  if (screen === 5) return isOAuthUser ? termsAccepted : (!!email.trim() && password.length >= 6 && password === confirm && termsAccepted);
  return true;
};

const buttonLabel = () => {
  if (screen === 0) return name.trim() ? "Continue →" : "Enter your name to continue";
  if (screen === 1) return (selectedNiches.length > 0 || location.trim()) ? "Continue →" : "Skip for now →";
  if (screen === 2) return selectedPlatforms.length > 0 ? "Continue →" : "Skip for now →";
  if (screen === 3) return contentTypes.length > 0 ? "Continue →" : "Skip for now →";
  if (screen === 4) return Object.values(rates).some(v => v) ? "Continue →" : "Skip for now →";
  if (screen === 5) {
    if (!termsAccepted) return "Accept Terms and Conditions to proceed";
    if (!isOAuthUser && !email.trim()) return "Enter your email to proceed";
    if (!isOAuthUser && password.length < 6) return "Password must be at least 6 characters";
    if (!isOAuthUser && password !== confirm) return "Passwords must match";
    return "Continue →";
  }
  if (screen === 6) return "Continue →";
  if (screen === 7) return profilePic ? "Finish & Go Explore →" : "Skip for now →";
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

      {/* Bottom Button */}
      {/* pointerEvents:none on the wrapper is deliberate - the gradient
          fade makes the top of this box visually blend into the page, but
          without this it still silently intercepts taps on whatever content
          is scrolled underneath it. Only the actual button(s) re-enable
          pointer events. */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "0.5rem 1.5rem calc(0.75rem + env(safe-area-inset-bottom, 0px))", background: "linear-gradient(to top, #0a0a0a 60%, transparent)", pointerEvents: "none" }}>
        {isLastScreen ? (
          <div
            onClick={() => navigate("explore")}
            style={{ padding: "16px", borderRadius: "12px", background: "#fff", color: "#0a0a0a", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", pointerEvents: "auto" }}
          >
            Start Exploring →
          </div>
        ) : screen === 7 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              onClick={loading ? undefined : handleFinish}
              style={{ padding: "16px", borderRadius: "12px", background: "#fff", color: "#0a0a0a", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: loading ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", opacity: loading ? 0.7 : 1, pointerEvents: "auto" }}
            >
              {loading ? "Creating account..." : "Finish & Go Explore →"}
            </div>
            <div
              onClick={loading ? undefined : handleFinish}
              style={{ padding: "14px", borderRadius: "12px", background: "transparent", color: "#888", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.05em", pointerEvents: "auto" }}
            >
              Skip for now
            </div>
          </div>
        ) : (
          <div
            className="tap-btn"
            onClick={(!loading && canProceed()) ? (screen === 5 ? (isOAuthUser ? next : handleSignup) : screen === 0 ? handleContinueFromWelcome : next) : undefined}
            style={{ padding: "16px", borderRadius: "12px", background: canProceed() ? "#fff" : "#1a1a1a", color: canProceed() ? "#0a0a0a" : "#333", fontSize: "14px", fontWeight: 700, textAlign: "center", cursor: (!loading && canProceed()) ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s", border: canProceed() ? "none" : "1px solid #222", opacity: (screen === 5 && loading) ? 0.6 : 1, pointerEvents: (screen === 5 && loading) ? "none" : "auto" }}
          >
            {screen === 5 && loading ? "Sending code..." : buttonLabel()}
          </div>
        )}
      </div>
      <TermsModal
  isOpen={showTerms}
  onAccept={() => { setTermsAccepted(true); setShowTerms(false); }}
  onClose={() => setShowTerms(false)}
  role="creator"
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
        className="tap-btn"
        onClick={otpResending ? undefined : handleOtpResend}
        style={{ padding: "13px", borderRadius: "8px", background: "transparent", border: "1px solid #222", color: otpResent ? "#34c759" : "#fff", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: otpResending ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", pointerEvents: otpResending ? "none" : "auto" }}
      >
        {otpResending ? "Sending..." : otpResent ? "Code resent" : "Resend code"}
      </div>
    </div>
  </div>
)}
{pickerPlatform && (
  <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", zIndex: 9999, display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111" }}>
      <span onClick={() => setPickerPlatform(null)} style={{ fontSize: "20px", color: "#fff", cursor: "pointer" }}>←</span>
      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Choose {pickerPlatform ? PLATFORM_LABEL[pickerPlatform] : ""} videos</span>
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", paddingBottom: "6rem" }}>
      <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.6, marginBottom: "1rem" }}>
        Pick up to {MAX_FEATURED_POSTS} to feature on your public profile ({selectedPostIds.length}/{MAX_FEATURED_POSTS} selected). You can change this anytime from Settings.
      </p>
      {postOptions.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#999" }}>No posts found yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
          {postOptions.map(post => {
            const selected = selectedPostIds.includes(post.post_id);
            return (
              <div
                key={post.post_id}
                onClick={() => togglePostSelection(post.post_id)}
                style={{ position: "relative", aspectRatio: "1", borderRadius: "8px", overflow: "hidden", border: selected ? "2px solid #fff" : "1px solid #1a1a1a", cursor: "pointer" }}
              >
                {post.thumbnail_url && (
                  <img src={post.thumbnail_url} alt={post.caption || ""} onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {selected && (
                  <div style={{ position: "absolute", top: "6px", right: "6px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}>✓</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "1rem 1.25rem calc(1rem + env(safe-area-inset-bottom, 0px))", background: "#0a0a0a", borderTop: "1px solid #1a1a1a" }}>
      <div
        onClick={() => !savingSelection && savePostSelection()}
        style={{ padding: "13px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        {savingSelection ? "Saving..." : "Save Selection"}
      </div>
    </div>
  </div>
)}
    </div>
  );
}