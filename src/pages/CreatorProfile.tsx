import { useState, useRef, useEffect, useLayoutEffect } from "react";
import LocationInput from "../components/LocationInput";
import { type Page } from "../App";
import { supabase, forceSignOut } from "../lib/supabase";
import { subscribeToPush, unsubscribeFromPush, isPushEnabled } from "../lib/push";
import { getLog, clearLog } from "../lib/debugLog";
import { startSocialConnect, getSocialConnections, disconnectSocialPlatform, getSocialPostOptions, getSocialPosts, setFeaturedPosts, MAX_FEATURED_POSTS, type SocialConnection, type SocialPlatform, type SocialPostOption, type SocialPost } from "../lib/social";

interface Props {
  navigate: (p: Page) => void;
  navigateToProfile: (id: string) => void;
  toggleTheme: () => void;
  isInverted: boolean;
}

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter/X", "Facebook", "Pinterest"];
const LABEL_TO_SOCIAL_PLATFORM: Record<string, SocialPlatform> = { Instagram: "instagram", TikTok: "tiktok" };
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
  | "terms"
  | "debug-log"
  | "reports-blocked";

export default function CreatorProfile({ navigateToProfile, toggleTheme, isInverted }: Props) {
  const [view, setView] = useState<"profile" | "settings">("profile");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("main");

  useEffect(() => {
    document.querySelector(".page-enter")?.scrollTo(0, 0);
  }, [view, settingsSection]);

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
  const profileHeaderRef = useRef<HTMLDivElement>(null);
  const [profileHeaderHeight, setProfileHeaderHeight] = useState(56);

  useLayoutEffect(() => {
    const el = profileHeaderRef.current;
    if (!el) return;
    const update = () => setProfileHeaderHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [view]);

  // Settings-specific data
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletTab, setWalletTab] = useState<"balance" | "withdraw" | "history">("balance");
  const [favourites, setFavourites] = useState<any[]>([]);
  const [campaignFavourites, setCampaignFavourites] = useState<any[]>([]);
  const [appliedCampaigns, setAppliedCampaigns] = useState<any[]>([]);
  const [appFilter, setAppFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    isPushEnabled().then(setNotificationsEnabled);
  }, []);
  const [notifError, setNotifError] = useState("");
  const [profileVisible, setProfileVisible] = useState(true);
  const [rateVisible, setRateVisible] = useState(true);
  const [shareLink, setShareLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [withdrawMethod, setWithdrawMethod] = useState("");
const [withdrawAmount, setWithdrawAmount] = useState("");
const [withdrawPaypal, setWithdrawPaypal] = useState("");
const [withdrawBankName, setWithdrawBankName] = useState("");
const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
const [withdrawSortCode, setWithdrawSortCode] = useState("");
const [withdrawing, setWithdrawing] = useState(false);
const [withdrawSuccess, setWithdrawSuccess] = useState(false);
const [withdrawError, setWithdrawError] = useState("");

  // Reports & Blocked
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blockRowId: string; name: string; avatar: string | null; role: string }[]>([]);
  const [myReports, setMyReports] = useState<{ id: string; reason: string; created_at: string; name: string }[]>([]);
  const [unblockLoading, setUnblockLoading] = useState<string | null>(null);

  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [featuredPosts, setFeaturedPostsState] = useState<SocialPost[]>([]);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [socialNotice, setSocialNotice] = useState("");
  const [pickerPlatform, setPickerPlatform] = useState<SocialPlatform | null>(null);
  const [postOptions, setPostOptions] = useState<SocialPostOption[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [savingSelection, setSavingSelection] = useState(false);

  const picRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
    loadFavourites();
    loadCampaignFavourites();
    loadWallet();
    loadWithdrawalRequests();
    loadReportsBlocked();
    loadSocialConnections();

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("social_connected");
    const socialError = params.get("social_error");
    if (connected) {
      setSocialNotice(`${connected === "instagram" ? "Instagram" : "TikTok"} connected.`);
      setSettingsSection("manage-accounts");
      setView("settings");
    } else if (socialError) {
      setSocialNotice(`Couldn't connect: ${socialError}`);
      setSettingsSection("manage-accounts");
      setView("settings");
    }
    if (connected || socialError) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    const channel = supabase
  .channel("wallet-updates")
  .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
    loadWallet();
    loadWithdrawalRequests();
  })
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
    loadWallet();
  })
  .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadReportsBlocked = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: blocks } = await supabase.from("blocks").select("id, blocked_id, created_at").eq("blocker_id", user.id).order("created_at", { ascending: false });
    const { data: reports } = await supabase.from("reports").select("id, reason, created_at, reported_user_id").eq("reporter_id", user.id).order("created_at", { ascending: false });

    const otherIds = Array.from(new Set([...(blocks || []).map(b => b.blocked_id), ...(reports || []).map(r => r.reported_user_id)]));
    if (otherIds.length === 0) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, role, creator_profiles(name, avatar_url), brand_profiles(name, avatar_url)")
      .in("id", otherIds);

    const nameFor = (id: string) => {
      const p = profiles?.find((p: any) => p.id === id) as any;
      if (!p) return { name: "Unknown user", avatar: null, role: "" };
      const info = p.role === "creator" ? p.creator_profiles : p.brand_profiles;
      return { name: info?.name || "Unknown user", avatar: info?.avatar_url || null, role: p.role };
    };

    if (blocks) {
      setBlockedUsers(blocks.map(b => ({ id: b.blocked_id, blockRowId: b.id, ...nameFor(b.blocked_id) })));
    }
    if (reports) {
      setMyReports(reports.map(r => ({ id: r.id, reason: r.reason, created_at: r.created_at, name: nameFor(r.reported_user_id).name })));
    }
  };

  const handleUnblock = async (blockRowId: string, userId: string) => {
    setUnblockLoading(blockRowId);
    const { error } = await supabase.from("blocks").delete().eq("id", blockRowId);
    if (!error) setBlockedUsers(prev => prev.filter(b => b.id !== userId));
    setUnblockLoading(null);
  };

  const loadSocialConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSocialConnections(await getSocialConnections(user.id));
    setFeaturedPostsState(await getSocialPosts(user.id));
  };

  const handleConnectSocial = async (platform: SocialPlatform) => {
    setConnectingPlatform(platform);
    try {
      await startSocialConnect(platform);
    } catch (err) {
      setSocialNotice(`Couldn't start connection: ${(err as Error).message}`);
      setConnectingPlatform(null);
    }
  };

  const handleDisconnectSocial = async (platform: SocialPlatform) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await disconnectSocialPlatform(user.id, platform);
    setSocialConnections(prev => prev.filter(c => c.platform !== platform));
    setFeaturedPostsState(prev => prev.filter(p => p.platform !== platform));
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
    setFeaturedPostsState(await getSocialPosts(user.id));
    setSavingSelection(false);
    setPickerPlatform(null);
    setSocialNotice("Featured videos updated.");
  };

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
      .select(`*, campaigns(id, name, description, type, budget, brand_id, brand_profiles(name, logo_url, is_enterprise))`)
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    if (apps) setAppliedCampaigns(apps);
  };

  const loadFavourites = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("favourites")
    .select("creator_id")
    .eq("user_id", user.id);

  if (!data) return;

  const enriched = await Promise.all(data.map(async (f) => {
    const { data: cp } = await supabase
      .from("creator_profiles")
      .select("name, niche, avatar_url")
      .eq("id", f.creator_id)
      .single();

    if (cp) return { ...f, display: cp };

    const { data: p } = await supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("id", f.creator_id)
      .single();

    return { ...f, display: p || { name: "Creator", avatar_url: null, niche: "" } };
  }));

  setFavourites(enriched);
};

  const loadCampaignFavourites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("campaign_favourites").select("campaign_id, campaigns(name, description, type, budget, brand_profiles(name, is_enterprise))").eq("user_id", user.id);
    if (data) setCampaignFavourites(data);
  };

  const loadWithdrawalRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setWithdrawalRequests(data);
  };

  const loadWallet = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase.from("transactions").select("*, campaigns(name)").eq("creator_id", user.id).order("created_at", { ascending: false });
  const { data: withdrawals } = await supabase.from("withdrawal_requests").select("amount, status").eq("creator_id", user.id);
  if (data) {
    setTransactions(data);
    const earned = data.filter(t => t.status !== "failed").reduce((sum, t) => sum + t.creator_payout, 0);
    const withdrawn = withdrawals ? withdrawals.filter(w => w.status === "completed" || w.status === "pending").reduce((sum, w) => sum + w.amount, 0) : 0;
    setWalletBalance(earned - withdrawn);
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
      const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;
      setProfilePic(bustedUrl);
      setAvatarUrl(bustedUrl);
      const { data: existing } = await supabase.from("creator_profiles").select("id").eq("id", userId).single();
      if (existing) {
        await supabase.from("creator_profiles").update({ avatar_url: bustedUrl }).eq("id", userId);
      } else {
        await supabase.from("creator_profiles").insert({ id: userId, avatar_url: bustedUrl });
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
      setWalletBalance(prev => prev - Math.round(amount * 100));
      await loadWithdrawalRequests();
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
      <div ref={profileHeaderRef} style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>My Profile</span>
        <div onClick={() => { setView("settings"); setSettingsSection("main"); }} style={{ width: "36px", height: "36px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}>
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
        </div>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", paddingTop: `${profileHeaderHeight + 24}px` }}>
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
            {selectedPlatforms.map(p => {
              const connectedPlatform = LABEL_TO_SOCIAL_PLATFORM[p];
              const connection = connectedPlatform ? socialConnections.find(c => c.platform === connectedPlatform) : undefined;
              const followers = connection?.follower_count ?? (followerCounts[p] ? Number(followerCounts[p]) : null);
              return (
              <div key={p} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{p}</p>
                  {(connection?.username || socialLinks[p]) && <p style={{ color: "#555", fontSize: "12px" }}>@{connection?.username || socialLinks[p]}</p>}
                </div>
                <div style={{ display: "flex", gap: "1rem", fontSize: "12px", color: "#555" }}>
                  {followers != null && <span>{followers.toLocaleString()} followers{connection && " ✓"}</span>}
                  {engagementRates[p] && <span>{engagementRates[p]}% engagement</span>}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Recent Posts */}
        {featuredPosts.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Recent Posts</label>
            {socialConnections.filter(c => c.username).length > 0 && (
              <p style={{ fontSize: "12px", color: "#555", marginBottom: "10px" }}>
                {socialConnections.filter(c => c.username).map((c, i) => (
                  <span key={c.platform}>{i > 0 ? "  ·  " : ""}{c.platform === "instagram" ? "Instagram" : "TikTok"} @{c.username}</span>
                ))}
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
              {featuredPosts.slice(0, 5).map(post => (
                <a key={`${post.platform}-${post.post_id}`} href={post.post_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", aspectRatio: "1", borderRadius: "8px", overflow: "hidden", border: "1px solid #1a1a1a" }}>
                  <img src={post.thumbnail_url} alt={post.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </a>
              ))}
            </div>
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

        {/* Empty state — only covers platforms/content/languages/audience/rates/collabs, not bio/niche/location */}
        {!selectedPlatforms.length && !contentTypes.length && !languages.length && !audienceAgeRanges.length && !audienceLocation && !Object.values(rates).some(v => v) && !collabs.filter(c => c.brand).length && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 2rem", marginTop: "0.5rem" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#333", marginBottom: "1rem" }}>◉</div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px", textAlign: "center" }}>No content yet</p>
            <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.7, textAlign: "center", maxWidth: "260px" }}>You haven't added any platforms, rates, or collab history yet. Fill these out from Edit Profile so brands know what you offer.</p>
          </div>
        )}
      </div>
    </div>
  );

  // ─── SETTINGS SHELL ───────────────────────────────────────────────────────
  const renderSettingsHeader = (title: string, onBack: () => void) => (
    <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", background: "#0a0a0a", position: "sticky", top: 0, zIndex: 10 }}>
      <span onClick={onBack} style={{ fontSize: "20px", color: "#fff", cursor: "pointer" }}>←</span>
      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{title}</span>
    </div>
  );

  // ─── SETTINGS MAIN MENU ───────────────────────────────────────────────────
  const renderSettingsMain = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", background: "#0a0a0a", position: "sticky", top: 0, zIndex: 10 }}>
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
        {settingsRow("Reported & Blocked", `${blockedUsers.length} blocked · ${myReports.length} reported`, () => setSettingsSection("reports-blocked"))}

        {sectionHeader("What Brands Look At")}
        {settingsRow("Audience & Rates", "Age ranges, location, rate card", () => setSettingsSection("audience-data"))}
        {settingsRow("Past Collaborations", `${collabs.filter(c => c.brand).length} added`, () => setSettingsSection("past-collabs"))}

        {sectionHeader("General")}
        {settingsRow("About FlipCollab", "Learn about us", () => window.open("https://about.flipcollab.com", "_blank"))}
        {settingsRow("Help Centre", "FAQs and support", () => setSettingsSection("help"))}
        {settingsRow("Privacy Policy", "How we use your data", () => window.open("https://privacy.flipcollab.com", "_blank"))}
{settingsRow("Terms of Service", "Platform rules", () => window.open("https://terms.flipcollab.com", "_blank"))}
        {settingsRow("Debug Log", "For troubleshooting freezes", () => setSettingsSection("debug-log"))}

        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "2rem" }}>
          <div onClick={forceSignOut} style={{ padding: "14px", borderRadius: "8px", border: "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Sign Out
          </div>
          <div onClick={async () => {
            const confirmed = window.confirm("Are you sure you want to delete your account? This cannot be undone.");
            if (!confirmed) return;
            if (userId) {
              await supabase.from("profiles").delete().eq("id", userId);
              await supabase.functions.invoke("delete-user", { body: { user_id: userId } });
            }
            await forceSignOut();
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
        <div><label style={labelStyle}>Location</label><LocationInput inputStyle={inputStyle} value={location} onChange={setLocation} /></div>
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
            {selectedPlatforms.map(p => {
              const connectedPlatform = LABEL_TO_SOCIAL_PLATFORM[p];
              const connection = connectedPlatform ? socialConnections.find(c => c.platform === connectedPlatform) : undefined;
              return (
              <div key={p} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>{p}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {connection ? (
                    <div>
                      <input style={{ ...inputStyle, color: "#777", cursor: "not-allowed" }} value={connection.username ? `@${connection.username}` : "Connected"} disabled />
                      <p style={{ fontSize: "11px", color: "#555", marginTop: "6px" }}>Verified via connected account - disconnect it in Manage Accounts to change this.</p>
                    </div>
                  ) : (
                    <input style={inputStyle} placeholder={`${p} username`} value={socialLinks[p] || ""} onChange={e => setSocialLinks(prev => ({ ...prev, [p]: e.target.value }))} />
                  )}
                  <div style={{ display: "flex", gap: "8px" }}>
                    {connection ? (
                      <input style={{ ...inputStyle, flex: 1, color: "#777", cursor: "not-allowed" }} value={connection.follower_count != null ? `${connection.follower_count.toLocaleString()} followers` : "Syncing..."} disabled />
                    ) : (
                      <input style={{ ...inputStyle, flex: 1 }} placeholder="Followers" type="number" value={followerCounts[p] || ""} onChange={e => setFollowerCounts(prev => ({ ...prev, [p]: e.target.value }))} />
                    )}
                    <input style={{ ...inputStyle, flex: 1 }} placeholder="Engagement %" type="number" value={engagementRates[p] || ""} onChange={e => setEngagementRates(prev => ({ ...prev, [p]: e.target.value }))} />
                  </div>
                </div>
              </div>
              );
            })}
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

      <div style={{ padding: "2rem 1.25rem 3rem" }}>
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
      <div style={{ position: "sticky", bottom: "96px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
        <div onClick={saveProfile} style={{ padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </div>
      </div>
    </div>
  );

  // ─── MANAGE ACCOUNTS ──────────────────────────────────────────────────────
  const renderPostPicker = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "8rem" }}>
      {renderSettingsHeader(`Choose ${pickerPlatform === "instagram" ? "Instagram" : "TikTok"} videos`, () => setPickerPlatform(null))}
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.6, marginBottom: "1rem" }}>
          Pick up to {MAX_FEATURED_POSTS} to feature on your public profile ({selectedPostIds.length}/{MAX_FEATURED_POSTS} selected).
        </p>
        {postOptions.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#555" }}>No posts found yet.</p>
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
      <div style={{ position: "fixed", bottom: "48px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #1a1a1a", zIndex: 200 }}>
        <div
          onClick={() => !savingSelection && savePostSelection()}
          style={{ padding: "13px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          {savingSelection ? "Saving..." : "Save Selection"}
        </div>
      </div>
    </div>
  );

  const renderManageAccounts = () => {
    if (pickerPlatform) return renderPostPicker();

    const connectedPlatforms = new Set(socialConnections.map(c => c.platform));
    const findConnection = (p: SocialPlatform) => socialConnections.find(c => c.platform === p);

    return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Manage Accounts", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        {socialNotice && (
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "10px", padding: "12px 14px", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "12px", color: "#ccc" }}>{socialNotice}</p>
            <span onClick={() => setSocialNotice("")} style={{ color: "#555", cursor: "pointer", fontSize: "14px" }}>✕</span>
          </div>
        )}
        <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.6, marginBottom: "1rem" }}>
          Connect Instagram or TikTok, then choose up to {MAX_FEATURED_POSTS} of your own posts to feature on your public profile.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(["instagram", "tiktok"] as SocialPlatform[]).map(platform => {
            const connection = findConnection(platform);
            const label = platform === "instagram" ? "Instagram" : "TikTok";
            return (
              <div key={platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
                <div>
                  <p style={{ fontSize: "14px", color: "#fff", fontWeight: 600 }}>{label}</p>
                  {connection && <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>{connection.username ? `@${connection.username}` : "Connected"}</p>}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {connectedPlatforms.has(platform) ? (
                    <>
                      <span onClick={() => openPostPicker(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #fff", color: "#fff", cursor: "pointer" }}>Choose videos</span>
                      <span onClick={() => handleDisconnectSocial(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", color: "#ff4444", cursor: "pointer" }}>Disconnect</span>
                    </>
                  ) : (
                    <span onClick={() => handleConnectSocial(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #fff", color: "#fff", cursor: connectingPlatform ? "default" : "pointer", opacity: connectingPlatform && connectingPlatform !== platform ? 0.4 : 1 }}>
                      {connectingPlatform === platform ? "Connecting..." : "Connect"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {["YouTube", "Twitter/X", "Facebook"].map(platform => (
            <div key={platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
              <p style={{ fontSize: "14px", color: "#555", fontWeight: 500 }}>{platform}</p>
              <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #222", color: "#333" }}>Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
  };

  // ─── PAYOUTS ──────────────────────────────────────────────────────────────
  const renderPayouts = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Payouts", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
            {(["balance", "withdraw", "history"] as const).map(t => (
  <div key={t} onClick={() => setWalletTab(t)} style={{ flex: 1, padding: "12px", textAlign: "center", cursor: "pointer", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: walletTab === t ? "#fff" : "#444", borderBottom: walletTab === t ? "1px solid #fff" : "1px solid transparent" }}>{t}</div>
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
                        <p style={{ fontSize: "12px", color: "#fff", fontWeight: 600 }}>{(t as any).campaigns?.name || "Campaign"}</p>
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
          {walletTab === "history" && (
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              {withdrawalRequests.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#444", textAlign: "center", padding: "2rem" }}>No withdrawal requests yet</p>
              ) : withdrawalRequests.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#0a0a0a", borderRadius: "8px", border: "1px solid #1a1a1a" }}>
                  <div>
                    <p style={{ fontSize: "12px", color: "#fff", fontWeight: 600, marginBottom: "4px" }}>£{(r.amount / 100).toFixed(2)}</p>
                    <p style={{ fontSize: "10px", color: "#444", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.method} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "20px", border: `1px solid ${r.status === "completed" ? "#34c759" : r.status === "rejected" ? "#ff4444" : "#555"}`, color: r.status === "completed" ? "#34c759" : r.status === "rejected" ? "#ff4444" : "#777", textTransform: "uppercase" }}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  const toggleNotifications = async () => {
    setNotifError("");
    if (notificationsEnabled) {
      if (userId) await unsubscribeFromPush(userId);
      setNotificationsEnabled(false);
      return;
    }
    if (!userId) return;
    try {
      await subscribeToPush(userId);
      setNotificationsEnabled(true);
    } catch (err: any) {
      setNotifError(err?.message || "Couldn't enable notifications.");
    }
  };

  const renderNotifications = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Notifications", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
          <div>
            <p style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>Push Notifications</p>
            <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>New messages, applications, and deals</p>
          </div>
          <div onClick={toggleNotifications} style={{ width: "44px", height: "24px", borderRadius: "12px", background: notificationsEnabled ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: "3px", left: notificationsEnabled ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: notificationsEnabled ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
          </div>
        </div>
        {notifError && <p style={{ color: "#ff4444", fontSize: "12px", marginTop: "10px" }}>{notifError}</p>}
      </div>
    </div>
  );

  // ─── VISIBILITY ───────────────────────────────────────────────────────────
  const renderVisibility = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
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
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
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
              const campIsEnterprise = camp?.brand_profiles?.is_enterprise;
              return (
                <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                    <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{camp?.name || "Campaign"}</p>
                    <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: "1px solid #333", color: "#555", textTransform: "uppercase" }}>{camp?.type}{camp?.type === "paid" && baseBudget ? ` · £${(baseBudget * (campIsEnterprise ? 1 : 0.9)).toLocaleString()}` : ""}</span>
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
                  {(f as any).display?.avatar_url ? <img src={(f as any).display.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◉"}
                </div>
                <div>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{(f as any).display?.name || "Creator"}</p>
<p style={{ color: "#444", fontSize: "11px", marginTop: "2px" }}>{(f as any).display?.niche || ""}</p>
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
            const brandIsEnterprise = brandData?.is_enterprise;
            return (
              <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{campaignData?.name || "Campaign"}</p>
                  <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: `1px solid ${a.status === "paid" ? "#34c759" : a.status === "accepted" ? "#fff" : a.status === "rejected" ? "#333" : "#555"}`, color: a.status === "paid" ? "#34c759" : a.status === "accepted" ? "#fff" : a.status === "rejected" ? "#444" : "#777", textTransform: "uppercase" }}>{a.status === "paid" ? "paid out" : a.status}</span>
                </div>
                {campaignData?.type === "paid" && baseBudget > 0 && <p style={{ fontSize: "11px", color: "#34c759", marginBottom: "4px" }}>Take-home: £{(baseBudget * (brandIsEnterprise ? 1 : 0.9)).toLocaleString()}</p>}
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
      <div style={{ position: "sticky", bottom: "96px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
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
      <div style={{ position: "sticky", bottom: "96px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
        <div onClick={saveProfile} style={{ padding: "14px", borderRadius: "8px", background: saved ? "#1a1a1a" : "#fff", color: saved ? "#fff" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </div>
      </div>
    </div>
  );

  // ─── HELP ─────────────────────────────────────────────────────────────────
  const renderHelp = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
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
          <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>hello@flipcollab.com</p>
        </div>
      </div>
    </div>
  );

  // ─── PRIVACY POLICY / TERMS ───────────────────────────────────────────────
const renderPrivacyPolicy = () => (
  <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
    {renderSettingsHeader("Privacy Policy", () => setSettingsSection("main"))}
    <div style={{ padding: "1.25rem", color: "#aaa", fontSize: "13px", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ color: "#555", fontSize: "11px" }}>Last updated: January 2026</p>
      <p>This Privacy Policy explains how FlipCollab collects, uses, and protects your personal data. We comply with UK GDPR and the Data Protection Act 2018.</p>
      {[
        { t: "1. Who We Are", b: "FlipCollab is a creator collaboration marketplace. Contact: hello@flipcollab.com" },
        { t: "2. Data We Collect", b: "Name, email, profile info, payment data via Stripe, messages, campaign content, and device/usage data." },
        { t: "3. How We Use Your Data", b: "To run your account, match brands with creators, process payments, send transactional emails, resolve disputes, and comply with legal obligations." },
        { t: "4. Legal Basis", b: "Contract performance, legitimate interests (security, fraud prevention), and legal obligation." },
        { t: "5. Third-Party Services", b: "Supabase (database/auth, EU), Stripe (payments, PCI-DSS), Vercel (hosting). We do not sell your data." },
        { t: "6. Data Retention", b: "Retained while your account is active. Deleted within 30 days of account deletion, except payment records kept 6 years under UK law." },
        { t: "7. Your Rights", b: "Access, correction, deletion, objection, portability, and the right to complain to the ICO (ico.org.uk). Email us to exercise these." },
        { t: "8. Cookies", b: "Essential cookies only. No tracking or advertising cookies." },
        { t: "9. Security", b: "HTTPS, Supabase auth, and Stripe PCI compliance. Contact us immediately if you suspect unauthorised access." },
        { t: "10. Children", b: "Not for under 18s. Accounts found to belong to minors are deleted immediately." },
        { t: "11. Changes", b: "We'll notify you of significant changes via email or in-app notice." },
        { t: "12. Contact", b: "hello@flipcollab.com" },
      ].map(({ t, b }) => (
        <div key={t}>
          <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>{t}</span>
          <span>{b}</span>
        </div>
      ))}
    </div>
  </div>
);

const renderTerms = () => (
  <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
    {renderSettingsHeader("Terms of Service", () => setSettingsSection("main"))}
    <div style={{ padding: "1.25rem", color: "#aaa", fontSize: "13px", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ color: "#555", fontSize: "11px" }}>Last updated: January 2026</p>
      <p>By using FlipCollab you agree to these Terms. You must be at least 18 years old.</p>
      {[
        { t: "1. About FlipCollab", b: "A creator collaboration marketplace connecting brands with content creators for paid and gifted campaigns." },
        { t: "2. Your Account", b: "Keep credentials secure. FlipCollab isn't liable for unauthorised access. You can delete your account anytime from settings." },
        { t: "3. Creator Responsibilities", b: "Deliver content as described within the agreed timeframe. Don't accept payment outside FlipCollab to bypass fees — this results in immediate termination." },
        { t: "4. Payments & Escrow", b: "All payments via Stripe. Funds held in escrow until content is approved. Disputes must be raised within 7 days to hello@flipcollab.com." },
        { t: "5. Payment Delays", b: "Delays may occur during maintenance or incidents. All escrow funds are guaranteed to be processed once normal operations resume." },
        { t: "6. Platform Fees", b: "FlipCollab deducts a 10% fee from creator earnings per completed collab." },
        { t: "7. Prohibited Content", b: "No illegal, hateful, explicit, discriminatory, or misleading content. Violations result in account suspension or termination." },
        { t: "8. Intellectual Property", b: "Creators retain content ownership. Completing a campaign grants the brand a non-exclusive licence for promotional use as agreed." },
        { t: "9. Privacy", b: "We collect name, email, profile info, and payment data. We use Supabase, Stripe, and Vercel. We don't sell your data." },
        { t: "10. Limitation of Liability", b: "FlipCollab isn't liable for indirect or consequential losses, including brand-creator disputes." },
        { t: "11. Governing Law", b: "Governed by the laws of England and Wales." },
        { t: "12. In-App Purchases", b: "Subscription fees are recurring and cancellable anytime. No refunds for partial periods." },
        { t: "13. App Store Compliance", b: "Claims must be directed to FlipCollab, not Apple or Google." },
        { t: "14. Contact", b: "hello@flipcollab.com" },
      ].map(({ t, b }) => (
        <div key={t}>
          <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>{t}</span>
          <span>{b}</span>
        </div>
      ))}
    </div>
  </div>
);

  // ─── DEBUG LOG ──────────────────────────────────────────────────────────
  const renderDebugLog = () => {
    const entries = getLog();
    const text = entries.join("\n");
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
        {renderSettingsHeader("Debug Log", () => setSettingsSection("main"))}
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ color: "#555", fontSize: "12px", lineHeight: 1.6 }}>
            When something freezes, come back here (Settings still works even when other pages don't), copy this, and send it over.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <div
              onClick={() => { navigator.clipboard?.writeText(text); }}
              style={{ flex: 1, padding: "11px", background: "#fff", color: "#0a0a0a", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600, textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              Copy
            </div>
            <div
              onClick={() => { clearLog(); setSettingsSection("main"); setSettingsSection("debug-log"); }}
              style={{ flex: 1, padding: "11px", border: "1px solid #222", color: "#555", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600, textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              Clear
            </div>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", color: "#888", fontSize: "11px", lineHeight: 1.6, fontFamily: "monospace" }}>
            {text || "No events logged yet."}
          </pre>
        </div>
      </div>
    );
  };

  // ─── REPORTED & BLOCKED ───────────────────────────────────────────────────
  const renderReportsBlocked = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Reported & Blocked", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Blocked Users</p>
        {blockedUsers.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "2rem" }}>You haven't blocked anyone.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "2rem" }}>
            {blockedUsers.map(b => (
              <div key={b.blockRowId} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: b.role === "creator" ? "50%" : "10px", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#333" }}>
                  {b.avatar ? <img src={b.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : b.role === "creator" ? "◉" : "◈"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{b.name}</p>
                  <p style={{ fontSize: "11px", color: "#444", textTransform: "capitalize" }}>{b.role}</p>
                </div>
                <div
                  onClick={() => unblockLoading !== b.blockRowId && handleUnblock(b.blockRowId, b.id)}
                  style={{ fontSize: "11px", color: "#ccc", cursor: "pointer", fontWeight: 500, background: "rgba(255,255,255,0.06)", padding: "6px 11px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }}
                >
                  {unblockLoading === b.blockRowId ? "..." : "Unblock"}
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Reports You've Filed</p>
        {myReports.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#444" }}>You haven't reported anyone.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {myReports.map(r => (
              <div key={r.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{r.name}</p>
                <p style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>{r.reason}</p>
                <p style={{ fontSize: "10px", color: "#444" }}>{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
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
{settingsSection === "privacy-policy" && renderPrivacyPolicy()}
{settingsSection === "terms" && renderTerms()}
      {settingsSection === "debug-log" && renderDebugLog()}
      {settingsSection === "reports-blocked" && renderReportsBlocked()}
    </>
  );
}