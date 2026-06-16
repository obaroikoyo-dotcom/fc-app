import { useState, useRef, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props {
  navigate: (p: Page) => void;
  navigateToProfile: (id: string) => void;
  toggleTheme: () => void;
  isInverted: boolean;
}

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter/X", "Facebook", "Pinterest"];
const CONTENT_TYPES = ["Photos", "Reels", "UGC Videos", "Stories", "Reviews", "Unboxings", "Tutorials", "Vlogs"];
const LANGUAGES = ["English", "Spanish", "French", "Arabic", "Portuguese", "German", "Italian", "Mandarin", "Hindi", "Other"];
const AGE_RANGES = ["9-15", "16-17", "18-24", "25-34", "35-44", "45+"];
const NICHES = ["Tech", "Beauty", "Fitness", "Gaming", "Fashion", "Food", "Travel", "Lifestyle", "Finance", "Parenting", "Education", "Sports", "Music", "Comedy", "Art", "Wellness", "Pets", "DIY", "Business", "Automotive"];

type SettingsSection =
  | "main"
  | "edit-profile"
  | "niche-selection"
  | "manage-accounts"
  | "payouts"
  | "notifications"
  | "visibility"
  | "share-profile"
  | "favourites"
  | "applications"
  | "audience-data"
  | "rates"
  | "past-collabs"
  | "help"
  | "privacy-policy"
  | "terms";

export default function CreatorProfile({ navigate, navigateToProfile, toggleTheme, isInverted }: Props) {
  const [view, setView] = useState<"profile" | "settings">("profile");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("main");

  // Profile data
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [available, setAvailable] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, string>>({});
  const [engagementRates, setEngagementRates] = useState<Record<string, string>>({});
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [audienceAgeRanges, setAudienceAgeRanges] = useState<string[]>([]);
  const [audienceLocation, setAudienceLocation] = useState("");
  const [rates, setRates] = useState({ post: "", story: "", reel: "", video: "", ugc: "" });
  const [collabs, setCollabs] = useState([{ brand: "", description: "" }]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [favTab, setFavTab] = useState<"creators" | "campaigns">("campaigns");

  // Settings-specific data
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletTab, setWalletTab] = useState<"balance" | "withdraw">("balance");
  const [favourites, setFavourites] = useState<any[]>([]);
  const [campaignFavourites, setCampaignFavourites] = useState<any[]>([]);
  const [appliedCampaigns, setAppliedCampaigns] = useState<any[]>([]);
  const [appFilter, setAppFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [profileVisible, setProfileVisible] = useState(true);
  const [rateVisible, setRateVisible] = useState(true);
  const [shareLink, setShareLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState("");
const [withdrawAmount, setWithdrawAmount] = useState("");
const [withdrawPaypal, setWithdrawPaypal] = useState("");
const [withdrawBankName, setWithdrawBankName] = useState("");
const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
const [withdrawSortCode, setWithdrawSortCode] = useState("");
const [withdrawing, setWithdrawing] = useState(false);
const [withdrawSuccess, setWithdrawSuccess] = useState(false);
const [withdrawError, setWithdrawError] = useState("");

  const picRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
    loadFavourites();
    loadCampaignFavourites();
    loadWallet();

    const channel = supabase
      .channel("wallet-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, () => {
        loadWallet();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setShareLink(`https://flipcollab.app/profile/${user.id}`);

    const { data } = await supabase.from("creator_profiles").select("*").eq("id", user.id).single();
    if (data) {
      setName(data.name || "");
      setBio(data.bio || "");
      setNiche(data.niche || "");
      setLocation(data.location || "");
      setAge(data.age?.toString() || "");
      setGender(data.gender || "");
      setAvailable(data.available ?? true);
      setSelectedPlatforms(data.platforms || []);
      setSocialLinks(data.social_links || {});
      setFollowerCounts(data.follower_counts || {});
      setEngagementRates(data.engagement_rates || {});
      setContentTypes(data.content_types || []);
      setLanguages(data.languages || []);
      setAudienceAgeRanges(Array.isArray(data.audience_age_range) ? data.audience_age_range : data.audience_age_range ? [data.audience_age_range] : []);
      setAudienceLocation(data.audience_location || "");
      setRates(data.rates || { post: "", story: "", reel: "", video: "", ugc: "" });
      setCollabs(data.collabs?.length ? data.collabs : [{ brand: "", description: "" }]);
      setProfilePic(data.avatar_url || null);
      setAvatarUrl(data.avatar_url || null);
    }

    const { data: apps } = await supabase
      .from("applications")
      .select(`*, campaigns(id, name, description, type, budget, brand_id, brand_profiles(name, logo_url))`)
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    if (apps) setAppliedCampaigns(apps);
  };

  const loadFavourites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("favourites").select("creator_id, profiles(name, avatar_url), creator_profiles(name, niche, avatar_url)").eq("user_id", user.id);
    if (data) setFavourites(data);
  };

  const loadCampaignFavourites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("campaign_favourites").select("campaign_id, campaigns(name, description, type, budget, brand_profiles(name))").eq("user_id", user.id);
    if (data) setCampaignFavourites(data);
  };

  const loadWallet = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("transactions").select("*").eq("creator_id", user.id).order("created_at", { ascending: false });
    if (data) {
      setTransactions(data);
      setWalletBalance(data.filter(t => t.status === "completed").reduce((sum, t) => sum + t.creator_payout, 0));
    }
  };

  const handlePic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const fileExt = file.name.split(".").pop();
    const filePath = `creators/${userId}.${fileExt}`;
    const { error } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setProfilePic(data.publicUrl);
      setAvatarUrl(data.publicUrl);
      const { data: existing } = await supabase.from("creator_profiles").select("id").eq("id", userId).single();
      if (existing) {
        await supabase.from("creator_profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
      } else {
        await supabase.from("creator_profiles").insert({ id: userId, avatar_url: data.publicUrl });
      }
    }
  };

  const togglePlatform = (p: string) => setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleContent = (c: string) => setContentTypes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleLanguage = (l: string) => setLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleAgeRange = (a: string) => setAudienceAgeRanges(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const updateCollab = (i: number, k: string, v: string) => setCollabs(prev => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  
  const handleWithdraw = async () => {
    if (!userId || !withdrawAmount || !withdrawMethod) return;
    const amount = parseFloat(withdrawAmount);
    if (amount <= 0 || amount > walletBalance / 100) {
      setWithdrawError("Invalid amount.");
      return;
    }
    if (withdrawMethod === "paypal" && !withdrawPaypal) {
      setWithdrawError("Enter your PayPal email.");
      return;
    }
    if (withdrawMethod === "bank" && (!withdrawBankName || !withdrawAccountNumber || !withdrawSortCode)) {
      setWithdrawError("Fill in all bank details.");
      return;
    }
    setWithdrawing(true);
    setWithdrawError("");
    const { error } = await supabase.from("withdrawal_requests").insert({
      creator_id: userId,
      amount: Math.round(amount * 100),
      method: withdrawMethod,
      paypal_email: withdrawMethod === "paypal" ? withdrawPaypal : null,
      bank_name: withdrawMethod === "bank" ? withdrawBankName : null,
      account_number: withdrawMethod === "bank" ? withdrawAccountNumber : null,
      sort_code: withdrawMethod === "bank" ? withdrawSortCode : null,
      status: "pending",
    });
    setWithdrawing(false);
    if (error) {
      setWithdrawError("Failed to submit. Try again.");
    } else {
      setWithdrawSuccess(true);
      setWithdrawAmount("");
      setWithdrawPaypal("");
      setWithdrawBankName("");
      setWithdrawAccountNumber("");
      setWithdrawSortCode("");
      setTimeout(() => setWithdrawSuccess(false), 3000);
    }
  };
  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    const profileData = {
      id: userId, name, bio, niche, location,
      age: age ? parseInt(age) : null,
      gender, available,
      platforms: selectedPlatforms,
      social_links: socialLinks,
      follower_counts: followerCounts,
      engagement_rates: engagementRates,
      content_types: contentTypes,
      languages,
      audience_age_range: audienceAgeRanges,
      audience_location: audienceLocation,
      rates, collabs,
      avatar_url: avatarUrl,
    };
    const { data: existing } = await supabase.from("creator_profiles").select("id").eq("id", userId).single();
    if (existing) {
      await supabase.from("creator_profiles").update(profileData).eq("id", userId);
    } else {
      await supabase.from("creator_profiles").insert(profileData);
    }
    setSaving(false);
setSaved(true);
await loadProfile();
setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid #222", borderRadius: "8px",
    padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none",
    width: "100%", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 500, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "#555", marginBottom: "6px", display: "block",
  };
  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: "20px",
    border: `1px solid ${active ? "#fff" : "#222"}`,
    background: active ? "#fff" : "transparent",
    color: active ? "#0a0a0a" : "#555",
    fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
  });
  const settingsRow = (label: string, sub: string, onClick: () => void, danger = false): React.ReactNode => (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #111", cursor: "pointer" }}>
      <div>
        <p style={{ fontSize: "14px", color: danger ? "#ff4444" : "#fff", fontWeight: 500 }}>{label}</p>
        {sub && <p style={{ fontSize: "12px", color: "#444", marginTop: "2px" }}>{sub}</p>}
      </div>
      {!danger && <span style={{ color: "#333", fontSize: "16px" }}>›</span>}
    </div>
  );
  const sectionHeader = (title: string) => (
    <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, padding: "20px 0 8px" }}>{title}</p>
  );

  // ─── PUBLIC PROFILE VIEW ─────────────────────────────────────────────────
  const renderProfile = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>My Profile</span>
        <div onClick={() => { setView("settings"); setSettingsSection("main"); }} style={{ width: "36px", height: "36px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}>
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
        </div>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", paddingTop: "5rem" }}>
        {/* Avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", border: "1px solid #333", background: "#111", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#333" }}>
            {profilePic ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◉"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff" }}>{name || "Your Name"}</p>
              {available && <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: "1px solid #fff", color: "#fff" }}>Open to collabs</span>}
            </div>
            <p style={{ fontSize: "13px", color: "#555" }}>{niche}{location ? ` · ${location}` : ""}</p>
          </div>
        </div>

        {/* Bio */}
        {bio && <p style={{ fontSize: "13px", color: "#777", lineHeight: 1.7, marginBottom: "1.5rem" }}>{bio}</p>}

        {/* Niche tags */}
        {niche && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.5rem" }}>
            {niche.split(",").map(n => n.trim()).filter(Boolean).map(n => (
              <span key={n} style={{ padding: "5px 12px", borderRadius: "20px", border: "1px solid #222", color: "#555", fontSize: "12px" }}>{n}</span>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "1.5rem" }} />

        {/* Platforms */}
        {selectedPlatforms.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Platforms</label>
            {selectedPlatforms.map(p => (
              <div key={p} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "8px" }}>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>{p}</p>
                <div style={{ display: "flex", gap: "1rem", fontSize: "12px", color: "#555" }}>
                  {followerCounts[p] && <span>{Number(followerCounts[p]).toLocaleString()} followers</span>}
                  {engagementRates[p] && <span>{engagementRates[p]}% engagement</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content types */}
        {contentTypes.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Content I Create</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {contentTypes.map(c => <span key={c} style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #222", color: "#555", fontSize: "12px" }}>{c}</span>)}
            </div>
          </div>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Languages</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {languages.map(l => <span key={l} style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #222", color: "#555", fontSize: "12px" }}>{l}</span>)}
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "1.5rem" }} />

        {/* Audience */}
        {(audienceAgeRanges.length > 0 || audienceLocation) && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Audience</label>
            <div style={{ display: "flex", gap: "1rem", fontSize: "13px", color: "#555", flexWrap: "wrap" }}>
              {audienceAgeRanges.length > 0 && <span>Age: {audienceAgeRanges.join(", ")}</span>}
              {audienceLocation && <span>{audienceLocation}</span>}
            </div>
          </div>
        )}

        {/* Rate card */}
        {Object.values(rates).some(v => v) && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Rate Card</label>
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
              {rates.post && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>Post</span><span style={{ color: "#fff" }}>£{rates.post}</span></div>}
              {rates.story && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>Story</span><span style={{ color: "#fff" }}>£{rates.story}</span></div>}
              {rates.reel && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>Reel</span><span style={{ color: "#fff" }}>£{rates.reel}</span></div>}
              {rates.video && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>Video</span><span style={{ color: "#fff" }}>£{rates.video}</span></div>}
              {rates.ugc && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>UGC Only</span><span style={{ color: "#fff" }}>£{rates.ugc}</span></div>}
            </div>
          </div>
        )}

        {/* Past collabs */}
        {collabs.filter(c => c.brand).length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Past Collabs</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {collabs.filter(c => c.brand).map((c, i) => (
                <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{c.brand}</p>
                  <p style={{ color: "#555", fontSize: "12px" }}>{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── SETTINGS SHELL ───────────────────────────────────────────────────────
  const renderSettingsHeader = (title: string, onBack: () => void) => (
    <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", background: "#0a0a0a", position: "sticky", top: 0, zIndex: 10 }}>
      <span onClick={onBack} style={{ fontSize: "20px", color: "#fff", cursor: "pointer" }}>←</span>
      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{title}</span>
    </div>
  );

  // ─── SETTINGS MAIN MENU ───────────────────────────────────────────────────
  const renderSettingsMain = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111" }}>
        <span onClick={() => setView("profile")} style={{ fontSize: "20px", color: "#fff", cursor: "pointer" }}>←</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Settings</span>
      </div>

      {/* Theme toggle at top */}
      <div style={{ margin: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px 16px" }}>
        <div>
          <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Inverted Light Mode</p>
          <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>Toggle display theme</p>
        </div>
        <div onClick={toggleTheme} style={{ width: "44px", height: "24px", borderRadius: "12px", background: isInverted ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
          <div style={{ position: "absolute", top: "3px", left: isInverted ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: isInverted ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
        </div>
      </div>

      <div style={{ padding: "0 1.25rem" }}>
        {sectionHeader("Account Settings")}
        {settingsRow("Edit Profile", "Name, bio, niche, location, platforms", () => setSettingsSection("edit-profile"))}
        {settingsRow("Niche Selection", "Choose your content categories", () => setSettingsSection("niche-selection"))}
        {settingsRow("Manage Accounts", "Link TikTok, Instagram and more", () => setSettingsSection("manage-accounts"))}
        {settingsRow("Payouts", `Balance: £${(walletBalance / 100).toFixed(2)}`, () => setSettingsSection("payouts"))}
        {settingsRow("Notifications", notificationsEnabled ? "Push notifications on" : "Push notifications off", () => setSettingsSection("notifications"))}
        {settingsRow("Visibility", "Control what others see", () => setSettingsSection("visibility"))}
        {settingsRow("Share Profile", "Get your shareable link", () => setSettingsSection("share-profile"))}

        {sectionHeader("FlipCollab Activity")}
        {settingsRow("Favourited Creators & Campaigns", `${favourites.length + campaignFavourites.length} saved`, () => setSettingsSection("favourites"))}
        {settingsRow("Applications", `${appliedCampaigns.length} total`, () => setSettingsSection("applications"))}

        {sectionHeader("What Brands Look At")}
        {settingsRow("Audience & Rates", "Age ranges, location, rate card", () => setSettingsSection("audience-data"))}
        {settingsRow("Past Collaborations", `${collabs.filter(c => c.brand).length} added`, () => setSettingsSection("past-collabs"))}

        {sectionHeader("General")}
        {settingsRow("About FlipCollab", "Learn about us", () => window.open("https://flipcollab.app/about", "_blank"))}
        {settingsRow("Help Centre", "FAQs and support", () => setSettingsSection("help"))}
        {settingsRow("Privacy Policy", "How we use your data", () => setSettingsSection("privacy-policy"))}
        {settingsRow("Terms of Service", "Platform rules", () => setSettingsSection("terms"))}

        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "2rem" }}>
          <div onClick={async () => { await supabase.auth.signOut(); navigate("role-select"); }} style={{ padding: "14px", borderRadius: "8px", border: "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Sign Out
          </div>
          <div onClick={async () => {
            const confirmed = window.confirm("Are you sure you want to delete your account? This cannot be undone.");
            if (!confirmed) return;
            if (userId) {
              await supabase.from("profiles").delete().eq("id", userId);
              await supabase.functions.invoke("delete-user", { body: { user_id: userId } });
              await supabase.auth.signOut();
            }
            navigate("role-select");
          }} style={{ padding: "14px", borderRadius: "8px", border: "1px solid rgba(255,68,68,0.3)", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", color: "#ff4444", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Delete Account
          </div>
        </div>
      </div>
    </div>
  );

  // ─── EDIT PROFILE ─────────────────────────────────────────────────────────
  const renderEditProfile = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "8rem" }}>
      {renderSettingsHeader("Edit Profile", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1rem" }}>
          <div onClick={() => picRef.current?.click()} style={{ width: "80px", height: "80px", borderRadius: "50%", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", marginBottom: "8px" }}>
            {profilePic ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "24px", color: "#333" }}>+</span>}
          </div>
          <span style={{ fontSize: "12px", color: "#444" }}>Tap to change photo</span>
          <input ref={picRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePic} />
        </div>

        {/* Availability */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px 16px" }}>
          <div>
            <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Open to Collabs</p>
            <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>Brands can see you're available</p>
          </div>
          <div onClick={() => setAvailable(p => !p)} style={{ width: "44px", height: "24px", borderRadius: "12px", background: available ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: "3px", left: available ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: available ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
          </div>
        </div>

        <div><label style={labelStyle}>Full Name</label><input style={inputStyle} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label style={labelStyle}>Niche</label><input style={inputStyle} placeholder="e.g. Lifestyle, Beauty" value={niche} onChange={e => setNiche(e.target.value)} /></div>
        <div><label style={labelStyle}>Location</label><input style={inputStyle} placeholder="e.g. London, UK" value={location} onChange={e => setLocation(e.target.value)} /></div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}><label style={labelStyle}>Age</label><input style={inputStyle} placeholder="e.g. 22" type="number" value={age} onChange={e => setAge(e.target.value)} /></div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Gender</label>
            <select style={{ ...inputStyle, appearance: "none" }} value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">Select</option>
              <option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
            </select>
          </div>
        </div>
        <div><label style={labelStyle}>Bio</label><textarea style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }} placeholder="Tell brands about yourself..." value={bio} onChange={e => setBio(e.target.value)} /></div>

        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1rem" }}>
          <label style={labelStyle}>Preferred Posting Platforms</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {PLATFORMS.map(p => <div key={p} onClick={() => togglePlatform(p)} style={chipStyle(selectedPlatforms.includes(p))}>{p}</div>)}
          </div>
        </div>

        {selectedPlatforms.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={labelStyle}>Social Media Details</label>
            {selectedPlatforms.map(p => (
              <div key={p} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>{p}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input style={inputStyle} placeholder={`${p} profile link`} value={socialLinks[p] || ""} onChange={e => setSocialLinks(prev => ({ ...prev, [p]: e.target.value }))} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input style={{ ...inputStyle, flex: 1 }} placeholder="Followers" type="number" value={followerCounts[p] || ""} onChange={e => setFollowerCounts(prev => ({ ...prev, [p]: e.target.value }))} />
                    <input style={{ ...inputStyle, flex: 1 }} placeholder="Engagement %" type="number" value={engagementRates[p] || ""} onChange={e => setEngagementRates(prev => ({ ...prev, [p]: e.target.value }))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1rem" }}>
          <label style={labelStyle}>Content I Create</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {CONTENT_TYPES.map(c => <div key={c} onClick={() => toggleContent(c)} style={chipStyle(contentTypes.includes(c))}>{c}</div>)}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Languages Spoken</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {LANGUAGES.map(l => <div key={l} onClick={() => toggleLanguage(l)} style={chipStyle(languages.includes(l))}>{l}</div>)}
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: "72px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
        <div onClick={saveProfile} style={{ padding: "14px", borderRadius: "8px", background: saved ? "#1a1a1a" : "#fff", color: saved ? "#fff" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Profile"}
        </div>
      </div>
    </div>
  );

  // ─── NICHE SELECTION ──────────────────────────────────────────────────────
  const renderNicheSelection = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "8rem" }}>
      {renderSettingsHeader("Niche Selection", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "13px", color: "#555", marginBottom: "1.5rem", lineHeight: 1.6 }}>Select all niches that describe your content. This helps brands find you in search.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {NICHES.map(n => {
            const active = niche.split(",").map(x => x.trim()).includes(n);
            return (
              <div key={n} onClick={() => {
                const current = niche.split(",").map(x => x.trim()).filter(Boolean);
                const updated = current.includes(n) ? current.filter(x => x !== n) : [...current, n];
                setNiche(updated.join(", "));
              }} style={chipStyle(active)}>{n}</div>
            );
          })}
        </div>
        <div style={{ marginTop: "1.5rem" }}>
          <label style={labelStyle}>Or type your own</label>
          <input style={inputStyle} placeholder="e.g. Beauty, Fitness, Lifestyle" value={niche} onChange={e => setNiche(e.target.value)} />
        </div>
      </div>
      <div style={{ position: "fixed", bottom: "72px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
        <div onClick={saveProfile} style={{ padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </div>
      </div>
    </div>
  );

  // ─── MANAGE ACCOUNTS ──────────────────────────────────────────────────────
  const renderManageAccounts = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {renderSettingsHeader("Manage Accounts", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <div style={{ background: "#111", border: "1px dashed #222", borderRadius: "12px", padding: "2rem", textAlign: "center" }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>Coming Soon</p>
          <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.6 }}>Direct TikTok, Instagram, and YouTube account linking is in progress. We're waiting on platform API permissions. Check back soon.</p>
        </div>
        <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "10px" }}>
          {["TikTok", "Instagram", "YouTube", "Twitter/X", "Facebook"].map(platform => (
            <div key={platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
              <p style={{ fontSize: "14px", color: "#555", fontWeight: 500 }}>{platform}</p>
              <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #222", color: "#333" }}>Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── PAYOUTS ──────────────────────────────────────────────────────────────
  const renderPayouts = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Payouts", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
            {(["balance", "withdraw"] as const).map(t => (
              <div key={t} onClick={() => setWalletTab(t)} style={{ flex: 1, padding: "12px", textAlign: "center", cursor: "pointer", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: walletTab === t ? "#fff" : "#444", borderBottom: walletTab === t ? "1px solid #fff" : "1px solid transparent" }}>{t}</div>
            ))}
          </div>
          {walletTab === "balance" && (
            <div style={{ padding: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Available Balance (Net)</p>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "36px", fontWeight: 800, color: "#fff" }}>£{(walletBalance / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p style={{ fontSize: "11px", color: "#444", marginTop: "4px" }}>Platform matching fee automatically deducted.</p>
              {transactions.length > 0 && (
                <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "8px", textAlign: "left" }}>
                  {transactions.map((t, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#0a0a0a", borderRadius: "8px", border: "1px solid #1a1a1a" }}>
                      <div>
                        <p style={{ fontSize: "12px", color: "#fff", fontWeight: 600 }}>Campaign</p>
                        <p style={{ fontSize: "10px", color: "#444", marginTop: "2px", textTransform: "uppercase" }}>{t.status}</p>
                      </div>
                      <p style={{ fontSize: "13px", color: t.status === "completed" ? "#34c759" : "#ff9500", fontWeight: 600 }}>+£{(t.creator_payout / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {walletTab === "withdraw" && (
  <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
    <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
      <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Available to withdraw</p>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: "#fff" }}>£{(walletBalance / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    </div>
    <div>
      <label style={labelStyle}>Withdraw to</label>
      <select style={{ ...inputStyle, appearance: "none" }} value={withdrawMethod} onChange={e => { setWithdrawMethod(e.target.value); setWithdrawError(""); }}>
        <option value="">Select method</option>
        <option value="paypal">PayPal</option>
        <option value="bank">Bank Account</option>
      </select>
    </div>
    {withdrawMethod === "paypal" && (
      <div>
        <label style={labelStyle}>PayPal Email</label>
        <input style={inputStyle} placeholder="your@paypal.com" type="email" value={withdrawPaypal} onChange={e => setWithdrawPaypal(e.target.value)} />
      </div>
    )}
    {withdrawMethod === "bank" && (
      <>
        <div>
          <label style={labelStyle}>Bank Name</label>
          <input style={inputStyle} placeholder="e.g. Barclays" value={withdrawBankName} onChange={e => setWithdrawBankName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Account Number</label>
          <input style={inputStyle} placeholder="12345678" value={withdrawAccountNumber} onChange={e => setWithdrawAccountNumber(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Sort Code</label>
          <input style={inputStyle} placeholder="00-00-00" value={withdrawSortCode} onChange={e => setWithdrawSortCode(e.target.value)} />
        </div>
      </>
    )}
    <input style={inputStyle} placeholder="Amount (£)" type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
    {withdrawError && <p style={{ fontSize: "12px", color: "#ff4444", margin: 0 }}>{withdrawError}</p>}
    {withdrawSuccess && <p style={{ fontSize: "12px", color: "#34c759", margin: 0 }}>Request submitted. We'll process it within 24 hours.</p>}
    <div onClick={!withdrawing ? handleWithdraw : undefined} style={{ padding: "13px", borderRadius: "8px", background: walletBalance > 0 && withdrawMethod && withdrawAmount ? "#fff" : "#1a1a1a", color: walletBalance > 0 && withdrawMethod && withdrawAmount ? "#0a0a0a" : "#333", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: walletBalance > 0 && withdrawMethod && withdrawAmount ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {withdrawing ? "Submitting..." : "Request Withdrawal"}
    </div>
    <p style={{ fontSize: "11px", color: "#333", textAlign: "center" }}>Withdrawals processed within 24 hours.</p>
  </div>
)}
        </div>
      </div>
    </div>
  );

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  const renderNotifications = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {renderSettingsHeader("Notifications", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
          <div>
            <p style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>Push Notifications</p>
            <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>New messages, applications, and deals</p>
          </div>
          <div onClick={() => setNotificationsEnabled(p => !p)} style={{ width: "44px", height: "24px", borderRadius: "12px", background: notificationsEnabled ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: "3px", left: notificationsEnabled ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: notificationsEnabled ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
          </div>
        </div>
      </div>
    </div>
  );

  // ─── VISIBILITY ───────────────────────────────────────────────────────────
  const renderVisibility = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {renderSettingsHeader("Visibility", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          { label: "Public Profile", sub: "Brands can find and view your profile", val: profileVisible, set: setProfileVisible },
          { label: "Rate Card", sub: "Show your rates to brands", val: rateVisible, set: setRateVisible },
        ].map(({ label, sub, val, set }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
            <div>
              <p style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>{label}</p>
              <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>{sub}</p>
            </div>
            <div onClick={() => set((p: boolean) => !p)} style={{ width: "44px", height: "24px", borderRadius: "12px", background: val ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: "3px", left: val ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: val ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── SHARE PROFILE ────────────────────────────────────────────────────────
  const renderShareProfile = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {renderSettingsHeader("Share Profile", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "13px", color: "#555", marginBottom: "1.5rem", lineHeight: 1.6 }}>Share your FlipCollab profile link with brands or on your socials.</p>
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "1rem" }}>
          <p style={{ fontSize: "12px", color: "#555", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shareLink}</p>
          <div onClick={() => { navigator.clipboard.writeText(shareLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }} style={{ padding: "7px 14px", background: linkCopied ? "#1a1a1a" : "#fff", color: linkCopied ? "#555" : "#0a0a0a", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }}>
            {linkCopied ? "Copied ✓" : "Copy"}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── FAVOURITES ───────────────────────────────────────────────────────────
  const renderFavourites = () => (
  <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
    {renderSettingsHeader("Favourites", () => setSettingsSection("main"))}
    <div style={{ display: "flex", borderBottom: "1px solid #111" }}>
      {(["campaigns", "creators"] as const).map(t => (
        <div key={t} onClick={() => setFavTab(t)} style={{ flex: 1, padding: "10px 4px", textAlign: "center", cursor: "pointer", fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: favTab === t ? "#fff" : "#444", borderBottom: favTab === t ? "2px solid #fff" : "2px solid transparent" }}>{t}</div>
      ))}
    </div>
    <div style={{ padding: "1.25rem" }}>
      {favTab === "campaigns" && (
        campaignFavourites.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#333", textAlign: "center", padding: "1rem", border: "1px dashed #1a1a1a", borderRadius: "10px" }}>No campaigns saved yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {campaignFavourites.map((f, i) => {
              const camp = f.campaigns as any;
              const baseBudget = parseInt(camp?.budget, 10) || 0;
              return (
                <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                    <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{camp?.name || "Campaign"}</p>
                    <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: "1px solid #333", color: "#555", textTransform: "uppercase" }}>{camp?.type}{camp?.type === "paid" && baseBudget ? ` · £${(baseBudget * 0.9).toLocaleString()}` : ""}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#444" }}>{camp?.brand_profiles?.name || "Brand"}</p>
                </div>
              );
            })}
          </div>
        )
      )}
      {favTab === "creators" && (
        favourites.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#333", textAlign: "center", padding: "1rem", border: "1px dashed #1a1a1a", borderRadius: "10px" }}>No creators favourited yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {favourites.map((f, i) => (
              <div key={i} onClick={() => navigateToProfile(f.creator_id)} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {((f.creator_profiles as any)?.avatar_url || (f.profiles as any)?.avatar_url) ? <img src={(f.creator_profiles as any)?.avatar_url || (f.profiles as any)?.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◉"}
                </div>
                <div>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{(f.creator_profiles as any)?.name || (f.profiles as any)?.name || "Creator"}</p>
<p style={{ color: "#444", fontSize: "11px", marginTop: "2px" }}>{(f.creator_profiles as any)?.niche || ""}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  </div>
);

  // ─── APPLICATIONS ─────────────────────────────────────────────────────────
  const renderApplications = () => {
    const filtered = appFilter === "all" ? appliedCampaigns : appFilter === "accepted" ? appliedCampaigns.filter(a => a.status === "accepted" || a.status === "paid") : appliedCampaigns.filter(a => a.status === appFilter);
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
        {renderSettingsHeader("Applications", () => setSettingsSection("main"))}
        <div style={{ display: "flex", borderBottom: "1px solid #111" }}>
          {(["all", "pending", "accepted", "rejected"] as const).map(f => (
            <div key={f} onClick={() => setAppFilter(f)} style={{ flex: 1, padding: "10px 4px", textAlign: "center", cursor: "pointer", fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: appFilter === f ? "#fff" : "#444", borderBottom: appFilter === f ? "2px solid #fff" : "2px solid transparent" }}>{f}</div>
          ))}
        </div>
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#333", textAlign: "center", padding: "2rem", border: "1px dashed #1a1a1a", borderRadius: "10px" }}>No {appFilter === "all" ? "" : appFilter} applications yet</p>
          ) : filtered.map((a, i) => {
            const campaignData = a.campaigns as any;
            const brandData = campaignData?.brand_profiles as any;
            const baseBudget = parseInt(campaignData?.budget, 10) || 0;
            return (
              <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{campaignData?.name || "Campaign"}</p>
                  <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: `1px solid ${a.status === "paid" ? "#34c759" : a.status === "accepted" ? "#fff" : a.status === "rejected" ? "#333" : "#555"}`, color: a.status === "paid" ? "#34c759" : a.status === "accepted" ? "#fff" : a.status === "rejected" ? "#444" : "#777", textTransform: "uppercase" }}>{a.status === "paid" ? "paid out" : a.status}</span>
                </div>
                {campaignData?.type === "paid" && baseBudget > 0 && <p style={{ fontSize: "11px", color: "#34c759", marginBottom: "4px" }}>Take-home: £{(baseBudget * 0.9).toLocaleString()}</p>}
                <p style={{ fontSize: "12px", color: "#444" }}>{brandData?.name || "Brand"}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── AUDIENCE & RATES ─────────────────────────────────────────────────────
  const renderAudienceData = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "8rem" }}>
      {renderSettingsHeader("Audience & Rates", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label style={labelStyle}>Audience Age Ranges</label>
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "10px" }}>Select all that apply to your audience</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {AGE_RANGES.map(a => <div key={a} onClick={() => toggleAgeRange(a)} style={chipStyle(audienceAgeRanges.includes(a))}>{a}</div>)}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Audience Location</label>
          <input style={inputStyle} placeholder="e.g. Mostly UK, US" value={audienceLocation} onChange={e => setAudienceLocation(e.target.value)} />
        </div>
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1rem" }}>
          <label style={labelStyle}>Rate Card (£)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { key: "post", label: "Feed Post" },
              { key: "story", label: "Story" },
              { key: "reel", label: "Reel" },
              { key: "video", label: "Video" },
              { key: "ugc", label: "UGC Only (no posting)" },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ ...labelStyle, marginBottom: 0, minWidth: "120px" }}>{label}</label>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="£" type="number" value={rates[key as keyof typeof rates]} onChange={e => setRates(r => ({ ...r, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ position: "fixed", bottom: "72px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
        <div onClick={saveProfile} style={{ padding: "14px", borderRadius: "8px", background: saved ? "#1a1a1a" : "#fff", color: saved ? "#fff" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </div>
      </div>
    </div>
  );

  // ─── PAST COLLABS ─────────────────────────────────────────────────────────
  const renderPastCollabs = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "8rem" }}>
      {renderSettingsHeader("Past Collaborations", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {collabs.map((c, i) => (
            <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
              <input style={inputStyle} placeholder="Brand name" value={c.brand} onChange={e => updateCollab(i, "brand", e.target.value)} />
              <input style={inputStyle} placeholder="What did you create?" value={c.description} onChange={e => updateCollab(i, "description", e.target.value)} />
            </div>
          ))}
          <span onClick={() => setCollabs(prev => [...prev, { brand: "", description: "" }])} style={{ fontSize: "12px", color: "#555", cursor: "pointer", textAlign: "center", padding: "10px", border: "1px dashed #222", borderRadius: "8px" }}>+ Add collab</span>
        </div>
      </div>
      <div style={{ position: "fixed", bottom: "72px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
        <div onClick={saveProfile} style={{ padding: "14px", borderRadius: "8px", background: saved ? "#1a1a1a" : "#fff", color: saved ? "#fff" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </div>
      </div>
    </div>
  );

  // ─── HELP ─────────────────────────────────────────────────────────────────
  const renderHelp = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {renderSettingsHeader("Help Centre", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        {[
          { q: "How do I get paid?", a: "Once a brand approves your content, funds are released from escrow to your wallet. You can withdraw via PayPal or bank transfer." },
          { q: "What is the platform fee?", a: "FlipCollab deducts a 10% platform fee from your earnings on each completed collaboration. Brands are charged an additional 5% on their end." },
          { q: "How do I apply to campaigns?", a: "Browse campaigns in the Explore tab. Tap Apply, write a pitch message, select your platforms, and submit." },
          { q: "Can I message brands directly?", a: "Yes — use the Search tab to find brands and tap DM to start a conversation." },
          { q: "How do I delete my account?", a: "Go to Settings and scroll to the bottom. Tap Delete Account. This is permanent and cannot be undone." },
        ].map(({ q, a }, i) => (
          <div key={i} style={{ marginBottom: "1rem", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
            <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>{q}</p>
            <p style={{ color: "#555", fontSize: "12px", lineHeight: 1.6 }}>{a}</p>
          </div>
        ))}
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: "12px" }}>Still need help? Email us at</p>
          <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>Flipcollab@hotmail.com</p>
        </div>
      </div>
    </div>
  );

  // ─── PRIVACY POLICY / TERMS ───────────────────────────────────────────────
  const renderDoc = (title: string, content: string) => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {renderSettingsHeader(title, () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.8 }}>{content}</p>
        <p style={{ fontSize: "12px", color: "#333", marginTop: "1.5rem" }}>For the full document, visit flipcollab.app or email Flipcollab@hotmail.com</p>
      </div>
    </div>
  );

  // ─── ROUTER ───────────────────────────────────────────────────────────────
  if (view === "profile") return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      {renderProfile()}
    </>
  );

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      {settingsSection === "main" && renderSettingsMain()}
      {settingsSection === "edit-profile" && renderEditProfile()}
      {settingsSection === "niche-selection" && renderNicheSelection()}
      {settingsSection === "manage-accounts" && renderManageAccounts()}
      {settingsSection === "payouts" && renderPayouts()}
      {settingsSection === "notifications" && renderNotifications()}
      {settingsSection === "visibility" && renderVisibility()}
      {settingsSection === "share-profile" && renderShareProfile()}
      {settingsSection === "favourites" && renderFavourites()}
      {settingsSection === "applications" && renderApplications()}
      {settingsSection === "audience-data" && renderAudienceData()}
      {settingsSection === "past-collabs" && renderPastCollabs()}
      {settingsSection === "help" && renderHelp()}
      {settingsSection === "privacy-policy" && renderDoc("Privacy Policy", "FlipCollab collects your name, email, profile information, and payment data to operate the platform. We use Supabase for data storage, Stripe for payments, and Vercel for hosting. We do not sell your personal data to third parties. Data is retained for as long as your account is active. You may request deletion at any time.")}
      {settingsSection === "terms" && renderDoc("Terms of Service", "By using FlipCollab you agree to our Terms & Conditions. You must be 18 or over. Brands agree to post accurate campaign information. Creators agree to deliver content as described. A 10% platform fee is deducted from creator earnings and a 5% fee is added to brand payments. All payments are processed through Stripe with escrow protection. FlipCollab is governed by the laws of England and Wales.")}
    </>
  );
}