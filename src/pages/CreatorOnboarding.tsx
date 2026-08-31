import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import PrivacyModal from "./PrivacyModal";
import LocationInput from "../components/LocationInput";
import TermsModal from "./TermsModal";
import { type Page } from "../App";
import { supabase, signInWithGoogleIdToken, signInWithAppleIdToken } from "../lib/supabase";
import GoogleSignInButton from "../components/GoogleSignInButton";
import AppleSignInButton from "../components/AppleSignInButton";
import { saveOnboardingDraft, peekOnboardingDraft, clearOnboardingDraft } from "../lib/onboardingDraft";
import { logEvent } from "../lib/debugLog";
import { NICHES } from "../lib/niches";
import { startSocialConnect, getSocialConnections, getSocialPostOptions, setFeaturedPosts, MAX_FEATURED_POSTS, type SocialConnection, type SocialPlatform, type SocialPostOption } from "../lib/social";

interface Props { navigate: (p: Page) => void; setPendingEmail: (email: string) => void; }

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

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter/X", "Facebook", "Pinterest"];
const CONTENT_TYPES = ["Photos", "Reels", "UGC Videos", "Stories", "Reviews", "Unboxings", "Tutorials", "Vlogs", "Hauls", "GRWM", "Comparisons", "Skits", "Livestreams", "Carousels", "Podcasts", "Testimonials"];
const TOTAL_SCREENS = 9;
const PLATFORM_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", tiktok: "TikTok" };
const UNAVAILABLE_PLATFORMS = ["YouTube", "Twitter/X", "Facebook", "Pinterest"];

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

function DateDropdown({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateRect = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 6, left: r.left, width: r.width });
  };

  const toggleOpen = () => {
    if (!open) updateRect();
    setOpen(p => !p);
  };

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open]);

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <div
        ref={triggerRef}
        onClick={toggleOpen}
        style={{ background: "#111", border: "1px solid #222", borderRadius: "10px", padding: "13px 14px", color: value ? "#fff" : "#555", fontSize: "14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>{value || placeholder}</span>
        <span style={{ color: "#888", fontSize: "10px" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && rect && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
          <div style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, background: "#111", border: "1px solid #222", borderRadius: "10px", zIndex: 9999, maxHeight: "220px", overflowY: "auto" }}>
            {options.map(o => (
              <div
                key={o}
                onClick={() => { onChange(o); setOpen(false); }}
                style={{ padding: "10px 14px", fontSize: "13px", color: value === o ? "#fff" : "#777", cursor: "pointer", borderBottom: "1px solid #1a1a1a", background: value === o ? "#1a1a1a" : "transparent" }}
              >
                {o}
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
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
      if (connected === "instagram" || connected === "tiktok") {
        setSocialNotice(`${connected === "instagram" ? "Instagram" : "TikTok"} connected. Choose which videos to feature.`);
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

  const handleAppleCredential = async (idToken: string, nonce: string) => {
    saveOnboardingDraft("creator", {
      name, birthDay, birthMonth, birthYear, selectedNiches, location,
      selectedPlatforms, socialLinks, followerCounts, contentTypes, rates, termsAccepted,
      screen: 5,
    });
    const { data, error: idTokenError } = await signInWithAppleIdToken(idToken, nonce);
    if (idTokenError) {
      setError(idTokenError.message);
      return;
    }
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
        const fileExt = profileFile.name.split(".").pop()?.toLowerCase();
        const filePath = `creators/${user.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, profileFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
          avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
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
      <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2.5rem" }}>Takes about 2 minutes. Your profile helps brands find and connect with you for paid and gifted collabs.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your full name</label>
        <input style={inputStyle} placeholder="e.g. Sofia Martinez" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
        <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase" }}>Date of birth</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <DateDropdown value={birthDay} onChange={updateBirthDay} options={DAY_OPTIONS} placeholder="Day" />
          <div style={{ flex: 1.6 }}><DateDropdown value={birthMonth} onChange={updateBirthMonth} options={MONTHS} placeholder="Month" /></div>
          <DateDropdown value={birthYear} onChange={updateBirthYear} options={YEAR_OPTIONS} placeholder="Year" />
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
      <p style={{ fontSize: "14px", color: "#999", marginBottom: "2rem" }}>Optional but helps brands know if you're in their budget. You can always update this later.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[
          { key: "post", label: "Feed Post" },
          { key: "story", label: "Story" },
          { key: "reel", label: "Reel" },
          { key: "video", label: "Video" },
          { key: "ugc", label: "UGC Only (no posting)" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>{label}</label>
            <input style={inputStyle} placeholder="£" type="number" value={rates[key as keyof typeof rates]} onChange={e => setRates(r => ({ ...r, [key]: e.target.value }))} />
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

          <AppleSignInButton onCredential={handleAppleCredential}>
            <div
              style={{ padding: "13px", borderRadius: "10px", border: "1px solid #222", background: "transparent", color: "#fff", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer" }}
            >
              {AppleIcon} Continue with Apple
            </div>
          </AppleSignInButton>
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
        Connect Instagram or TikTok to prove these are really your accounts, and pick up to 5 of your own posts to feature on your public profile. The account you connect should match the username you entered earlier.
      </p>
      {socialNotice && (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: "10px", padding: "10px 14px", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "12px", color: "#ccc" }}>{socialNotice}</p>
          <span onClick={() => setSocialNotice("")} style={{ color: "#999", cursor: "pointer", fontSize: "14px" }}>✕</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {(["instagram", "tiktok"] as SocialPlatform[]).map(platform => {
          const connection = socialConnections.find(c => c.platform === platform);
          const label = PLATFORM_LABEL[platform];
          const typedUsername = socialLinks[label];
          const mismatch = !!connection && !!typedUsername && !usernamesMatch(typedUsername, connection.username);
          return (
            <div key={platform} style={{ background: "#111", border: `1px solid ${mismatch ? "#ff3b30" : "#1a1a1a"}`, borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "14px", color: "#fff", fontWeight: 600 }}>{label}</p>
                  {connection && <p style={{ fontSize: "11px", color: mismatch ? "#ff3b30" : "#555", marginTop: "2px" }}>{connection.username ? `@${connection.username}` : "Connected"}</p>}
                </div>
                {connection ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span onClick={() => openPostPicker(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #fff", color: "#fff", cursor: "pointer" }}>Choose videos</span>
                    <span style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: `1px solid ${mismatch ? "#ff3b30" : "#333"}`, color: mismatch ? "#ff3b30" : "#34c759" }}>{mismatch ? "Mismatch" : "Connected ✓"}</span>
                  </div>
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
      <div style={{ height: "2px", background: "#111", position: "fixed", top: "env(safe-area-inset-top, 0px)", left: 0, right: 0, zIndex: 10 }}>
        <div style={{ height: "100%", background: "#fff", width: `${progress}%`, transition: "width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)" }} />
      </div>

      {/* Top Nav */}
      <div style={{ padding: "1.25rem 1.25rem 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "calc(8px + env(safe-area-inset-top, 0px))" }}>
        {screen > 0
          ? <span onClick={back} style={{ fontSize: "18px", color: "#999", cursor: "pointer", padding: "4px" }}>←</span>
          : <span onClick={() => navigate("role-select")} style={{ fontSize: "12px", color: "#888", cursor: "pointer" }}>← Back</span>}
        <span style={{ fontSize: "12px", color: "#777" }}>{screen + 1} / {TOTAL_SCREENS}</span>
      </div>

      {/* Screen Content */}
      <div
        key={screen}
        className={animating ? "" : direction === "forward" ? "slide-forward" : "slide-back"}
        style={{ flex: 1, padding: "2rem 1.5rem", overflowY: "auto", paddingBottom: "calc(13rem + env(safe-area-inset-bottom, 0px))" }}
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
      <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
        <svg width="24" height="24" viewBox="0 0 365 219" xmlns="http://www.w3.org/2000/svg">
          <path fill="#0a0a0a" d="M96.064575,165.549103 C96.366272,165.727371 96.667969,165.905640 97.020691,167.005798 C97.020691,171.608582 97.020691,176.211365 97.020691,180.814133 C97.424942,181.114319 97.829193,181.414505 98.233437,181.714676 C112.648994,169.587921 127.064552,157.461166 142.352478,144.600555 C136.653229,143.119751 132.347198,142.000931 127.689224,140.117615 C127.401375,135.075287 127.113518,130.032959 126.973160,124.267860 C128.984497,117.933220 135.203888,117.274460 139.932022,114.509651 C155.839188,105.207825 171.638748,95.721939 187.475739,86.308678 C187.475739,81.703476 187.475739,76.882881 187.475739,71.560562 C199.698669,77.999992 211.662857,84.303108 224.050797,90.829468 C211.899780,100.692886 199.833862,110.487228 187.173111,120.764412 C187.504791,113.638428 187.794525,107.413536 188.107529,100.688721 C176.578140,106.953163 164.937210,113.278221 153.019852,119.753464 C153.019852,128.063873 153.106766,136.719467 152.942032,145.370270 C152.911331,146.981888 152.323242,149.053528 151.220428,150.097000 C144.539169,156.418716 137.624146,162.492935 130.805710,168.670242 C119.956711,178.499100 109.033417,188.248886 98.336990,198.241348 C95.231705,201.142258 95.152985,204.950058 97.201767,209.194946 C103.133720,203.998001 108.661530,199.143433 114.202187,194.303558 C124.588501,185.230896 134.993423,176.179520 145.369888,167.095627 C156.346924,157.485947 167.147339,147.667404 178.310654,138.279892 C187.504074,130.548904 197.168274,123.380470 206.526382,115.841782 C216.044556,108.174164 225.652557,100.596611 234.831161,92.535484 C242.725525,85.602264 250.409851,78.357109 257.535583,70.647736 C262.086914,65.723610 265.476868,59.720032 269.270355,54.121033 C269.441528,53.868385 268.453339,52.830238 267.078735,52.001575 C239.384109,52.054615 211.689484,52.107655 183.141708,52.016808 C181.365662,52.220932 179.304489,51.914135 177.863312,52.718365 C171.889130,56.052246 165.844223,59.361343 160.293884,63.334187 C142.027573,76.408920 124.005127,89.823792 105.801323,102.986748 C100.091866,107.115173 95.788017,111.704567 96.962341,119.483917 C97.280693,121.592850 96.936661,123.801773 96.237114,126.246277 C96.460686,127.509384 96.684258,128.772491 97.016251,130.843353 C97.000595,132.201004 96.984940,133.558655 96.440697,135.056396 C96.343376,135.367905 96.246063,135.679413 95.986572,136.916962 C96.040627,146.281021 96.094688,155.645096 96.064575,165.549103 M268.743988,141.763657 C268.770264,140.839050 268.796509,139.914444 268.968628,138.063904 C268.973663,119.750961 269.030243,101.437645 268.898254,83.125687 C268.885986,81.426476 267.676086,79.735893 267.022247,78.041290 C265.681519,78.851440 264.154022,79.460625 263.030609,80.504608 C256.130219,86.916985 249.380585,93.492241 242.448868,99.869919 C240.085922,102.043976 236.203033,103.322350 235.114822,105.897491 C234.163528,108.148582 236.246307,111.628464 236.836929,114.595688 C238.044830,120.663971 239.928818,127.158257 235.640747,132.438889 C232.546341,136.249557 228.330673,139.533447 223.978882,141.864670 C212.656128,147.930222 200.982910,153.341537 188.925125,159.271774 C188.532455,153.090378 188.180252,147.545990 187.788666,141.381638 C174.279053,153.046722 161.510452,164.071960 148.805481,175.042252 C163.134384,183.761902 177.085220,192.251465 191.036057,200.741043 C191.380646,200.313141 191.725250,199.885239 192.069839,199.457336 C191.270569,195.139252 190.471298,190.821167 189.658249,186.428650 C190.906189,186.077881 192.752045,185.654800 194.533447,185.043854 C218.178879,176.934647 240.343750,165.827255 260.791931,151.475250 C263.901611,149.292648 265.688232,145.225082 268.743988,141.763657 z"/>
          <path fill="#fff" d="M128.041168,140.882126 C132.347198,142.000931 136.653229,143.119751 142.352478,144.600555 C127.064552,157.461166 112.648994,169.587921 98.233437,181.714676 C97.829193,181.414505 97.424942,181.114319 97.020691,180.814133 C97.020691,176.211365 97.020691,171.608582 97.008347,166.274246 C96.997238,165.362289 96.998489,165.181900 97.297333,164.707855 C97.730225,157.650772 97.973732,150.886917 97.947639,144.124069 C97.937180,141.414383 97.333435,138.706955 96.997574,135.727798 C96.984940,133.558655 97.000595,132.201004 97.240967,130.232178 C97.276009,128.402283 97.086334,127.183540 96.896652,125.964798 C96.936661,123.801773 97.280693,121.592850 96.962341,119.483917 C95.788017,111.704567 100.091866,107.115173 105.801323,102.986748 C124.005127,89.823792 142.027573,76.408920 160.293884,63.334187 C165.844223,59.361343 171.889130,56.052246 177.863312,52.718365 C179.304489,51.914135 181.365662,52.220932 183.676743,52.472023 C185.237396,53.284367 186.262344,53.951061 187.288757,53.953350 C213.030014,54.010765 238.771545,54.022274 264.512543,53.920010 C265.679047,53.915379 266.841064,52.771313 268.005157,52.157959 C268.453339,52.830238 269.441528,53.868385 269.270355,54.121033 C265.476868,59.720032 262.086914,65.723610 257.535583,70.647736 C250.409851,78.357109 242.725525,85.602264 234.831161,92.535484 C225.652557,100.596611 216.044556,108.174164 206.526382,115.841782 C197.168274,123.380470 187.504074,130.548904 178.310654,138.279892 C167.147339,147.667404 156.346924,157.485947 145.369888,167.095627 C134.993423,176.179520 124.588501,185.230896 114.202187,194.303558 C108.661530,199.143433 103.133720,203.998001 97.201767,209.194946 C95.152985,204.950058 95.231705,201.142258 98.336990,198.241348 C109.033417,188.248886 119.956711,178.499100 130.805710,168.670242 C137.624146,162.492935 144.539169,156.418716 151.220428,150.097000 C152.323242,149.053528 152.911331,146.981888 152.942032,145.370270 C153.106766,136.719467 153.019852,128.063873 153.019852,119.753464 C164.937210,113.278221 176.578140,106.953163 188.107529,100.688721 C187.794525,107.413536 187.504791,113.638428 187.173111,120.764412 C199.833862,110.487228 211.899780,100.692886 224.050797,90.829468 C211.662857,84.303108 199.698669,77.999992 187.475739,71.560562 C187.475739,76.882881 187.475739,81.703476 187.475739,86.308678 C171.638748,95.721939 155.839188,105.207825 139.932022,114.509651 C135.203888,117.274460 128.984497,117.933220 126.518005,124.739204 C125.845863,130.034561 125.566727,134.858078 125.527977,139.683517 C125.524826,140.076309 127.164734,140.482285 128.041168,140.882126 z"/>
          <path fill="#fff" d="M268.086823,142.029373 C265.688232,145.225082 263.901611,149.292648 260.791931,151.475250 C240.343750,165.827255 218.178879,176.934647 194.533447,185.043854 C192.752045,185.654800 190.906189,186.077881 189.658249,186.428650 C190.471298,190.821167 191.270569,195.139252 192.069839,199.457336 C191.725250,199.885239 191.380646,200.313141 191.036057,200.741043 C177.085220,192.251465 163.134384,183.761902 148.805481,175.042252 C161.510452,164.071960 174.279053,153.046722 187.788666,141.381638 C188.180252,147.545990 188.532455,153.090378 188.925125,159.271774 C200.982910,153.341537 212.656128,147.930222 223.978882,141.864670 C228.330673,139.533447 232.546341,136.249557 235.640747,132.438889 C239.928818,127.158257 238.044830,120.663971 236.836929,114.595688 C236.246307,111.628464 234.163528,108.148582 235.114822,105.897491 C236.203033,103.322350 240.085922,102.043976 242.448868,99.869919 C249.380585,93.492241 256.130219,86.916985 263.030609,80.504608 C264.154022,79.460625 265.681519,78.851440 267.022247,78.041290 C267.676086,79.735893 268.885986,81.426476 268.898254,83.125687 C269.030243,101.437645 268.973663,119.750961 268.580200,138.587204 C268.156769,140.083466 268.121796,141.056412 268.086823,142.029373 z"/>
        </svg>
      </div>

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
      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Choose {pickerPlatform === "instagram" ? "Instagram" : "TikTok"} videos</span>
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
                <img src={post.thumbnail_url} alt={post.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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