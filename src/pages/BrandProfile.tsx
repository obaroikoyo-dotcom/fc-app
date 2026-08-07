import { useState, useRef, useEffect } from "react";
import LocationInput from "../components/LocationInput";
import VerifiedBadge from "../components/VerifiedBadge";
import { type Page } from "../App";
import { supabase, forceSignOut } from "../lib/supabase";
import { subscribeToPush, unsubscribeFromPush, isPushEnabled } from "../lib/push";
import { getLog, clearLog } from "../lib/debugLog";
import { startSocialConnect, getSocialConnections, disconnectSocialPlatform, type SocialConnection, type SocialPlatform } from "../lib/social";
import TikTokIcon from "../components/TikTokIcon";
import StarRating from "../components/StarRating";
import { getBrandTrackRecord, getBrandReviews, formatResponseTime, type BrandTrackRecord, type BrandReview } from "../lib/brandStats";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { useHasLoadedOnce } from "../lib/useHasLoadedOnce";

const COMING_SOON_SOCIALS = ["Instagram", "YouTube", "Twitter/X", "Pinterest"];
const ADMIN_EMAIL = "obaroikoyo@gmail.com";

interface Props {
  navigate: (p: Page) => void;
  toggleTheme: () => void;
  isInverted: boolean;
}

const INDUSTRIES = ["Fashion & Apparel", "Beauty & Cosmetics", "Tech & SaaS", "Health & Wellness", "Food & Beverage", "Fitness", "Design & Home", "Jewellery & Accessories", "Skincare", "Haircare", "Travel & Hospitality", "Parenting & Family", "Pet Care", "Finance & Fintech", "Education & E-learning", "Gaming", "Automotive", "Sports & Outdoors", "Luxury Goods", "Sustainability & Eco", "Alcohol & Beverages", "Subscription Boxes", "Home & Garden", "Art & Creative Tools"];
const ACTIVATION_TYPES = ["UGC Video Assets", "Instagram Reels", "TikTok Placements", "Product Reviews", "Long-form Vlogs", "Dedicated Demos", "Stories", "Unboxings"];
const CREATOR_TIERS = [
  { label: "Nano-Tier Scale", sub: "Under 10k", value: "nano" },
  { label: "Micro-Tier Authority", sub: "10k - 100k", value: "micro" },
  { label: "Mid-Tier Influence", sub: "100k - 500k", value: "mid" },
  { label: "Macro-Tier Reach", sub: "500k - 1M", value: "macro" },
  { label: "Elite/Mega Impact", sub: "1M+", value: "mega" },
];

type SettingsSection =
  | "main"
  | "edit-profile"
  | "industry-selection"
  | "campaign-preferences"
  | "notifications"
  | "visibility"
  | "share-profile"
  | "favourites"
  | "help"
  | "privacy-policy"
  | "terms"
  | "debug-log"
  | "reports-blocked"
  | "manage-accounts"
  | "get-verified";

export default function BrandProfile({ navigate, toggleTheme, isInverted }: Props) {
  const [view, setView] = useState<"profile" | "settings">("profile");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("main");
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [socialNotice, setSocialNotice] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setSocialConnections(await getSocialConnections(user.id));

      const params = new URLSearchParams(window.location.search);
      const connected = params.get("social_connected");
      const socialError = params.get("social_error");
      if (connected === "instagram" || connected === "tiktok") {
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
    })();
  }, []);

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
  };

  useEffect(() => {
    document.querySelector(".page-enter")?.scrollTo(0, 0);
  }, [view, settingsSection]);

  // Profile data
  const [logo, setLogo] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [targetTier, setTargetTier] = useState("");
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [profileVisible, setProfileVisible] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    isPushEnabled().then(setNotificationsEnabled);
  }, []);
  const [notifError, setNotifError] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationRequest, setVerificationRequest] = useState<{ status: string } | null>(null);
  const [verificationNote, setVerificationNote] = useState("");
  const [submittingVerification, setSubmittingVerification] = useState(false);
const [cancelLoading, setCancelLoading] = useState(false);
const [cancelError, setCancelError] = useState("");
const [showCancelModal, setShowCancelModal] = useState(false);
const [cancelledAtPeriodEnd, setCancelledAtPeriodEnd] = useState(false);

  const [trackRecord, setTrackRecord] = useState<BrandTrackRecord | null>(null);
  const [reviews, setReviews] = useState<BrandReview[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const showProfileSkeleton = useDelayedLoading(profileLoading);
  const hasProfileLoadedOnce = useHasLoadedOnce(profileLoading);

  // Favourites
  const [favouritedCreators, setFavouritedCreators] = useState<any[]>([]);

  // Reports & Blocked
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blockRowId: string; name: string; avatar: string | null; role: string }[]>([]);
  const [myReports, setMyReports] = useState<{ id: string; reason: string; created_at: string; name: string }[]>([]);
  const [unblockLoading, setUnblockLoading] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
    loadFavourites();
    loadReportsBlocked();
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

  const loadProfile = async () => {
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setIsAdmin(user.email === ADMIN_EMAIL);
    setShareLink(`https://flipcollab.app/brand/${user.id}`);

    const { data } = await supabase.from("brand_profiles").select("*").eq("id", user.id).single();
    if (data) {
      setName(data.company_name || data.name || "");
      setIsVerified(!!data.verified);
      setBio(data.bio || "");
      setWebsite(data.website || "");
      setInstagram(data.instagram || "");
      setTiktok(data.tiktok || "");
      setIndustry(data.industry || data.niche || "");
      setLocation(data.location || "");
      setTargetAudience(data.target_audience || "");
      setTargetTier(data.budget_range || "");
      setContentTypes(data.content_types || []);
      setLogo(data.logo_url || data.avatar_url || null);
      setLogoUrl(data.logo_url || data.avatar_url || null);
      setIsEnterprise(data.is_enterprise || false);
setCancelledAtPeriodEnd(data.subscription_cancel_at_period_end || false);
    }

    const { data: reqs } = await supabase
      .from("verification_requests")
      .select("status")
      .eq("brand_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(1);
    if (reqs && reqs[0] && reqs[0].status === "pending") setVerificationRequest(reqs[0]);

    const [record, reviewRows] = await Promise.all([getBrandTrackRecord(user.id), getBrandReviews(user.id)]);
    setTrackRecord(record);
    setReviews(reviewRows);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleRequestVerification = async () => {
    if (!userId) return;
    setSubmittingVerification(true);
    const { error } = await supabase.from("verification_requests").insert({
      brand_id: userId,
      note: verificationNote.trim() || null,
    });
    setSubmittingVerification(false);
    if (!error) {
      setVerificationRequest({ status: "pending" });
      setVerificationNote("");
    }
  };

  const handleCancelSubscription = async () => {
  if (!userId) return;
  setCancelLoading(true);
  setCancelError("");
  try {
    const res = await supabase.functions.invoke("cancel-subscription", {
      body: { brand_id: userId }
    });
    if (res.error || !res.data?.success) {
      setCancelError("Failed to cancel. Please contact support.");
      setCancelLoading(false);
      return;
    }
    setCancelledAtPeriodEnd(true);
setShowCancelModal(false);
  } catch {
    setCancelError("Something went wrong. Try again.");
  }
  setCancelLoading(false);
};

const loadFavourites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("favourites")
      .select("creator_id, creator_profiles(name, niche, avatar_url)")
      .eq("user_id", user.id);
    if (data) setFavouritedCreators(data);
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const fileExt = file.name.split(".").pop();
    const filePath = `brands/${userId}.${fileExt}`;
    const { error } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;
      setLogo(bustedUrl);
      setLogoUrl(bustedUrl);
      await supabase.from("brand_profiles").update({ logo_url: bustedUrl, avatar_url: bustedUrl }).eq("id", userId);
    }
  };

  const toggleContent = (c: string) =>
    setContentTypes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    const profileData = {
      id: userId,
      company_name: name,
      name,
      bio,
      website,
      instagram,
      tiktok,
      industry,
      niche: industry,
      location,
      target_audience: targetAudience,
      budget_range: targetTier,
      content_types: contentTypes,
      logo_url: logoUrl,
      avatar_url: logoUrl,
    };
    const { data: existing } = await supabase.from("brand_profiles").select("id").eq("id", userId).single();
    if (existing) {
      await supabase.from("brand_profiles").update(profileData).eq("id", userId);
    } else {
      await supabase.from("brand_profiles").insert(profileData);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid #222", borderRadius: "8px",
    padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none",
    width: "100%", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 500, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "#999", marginBottom: "6px", display: "block",
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
        {sub && <p style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>{sub}</p>}
      </div>
      {!danger && <span style={{ color: "#777", fontSize: "16px" }}>›</span>}
    </div>
  );
  const sectionHeader = (title: string) => (
    <p style={{ fontSize: "11px", color: "#888", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, padding: "20px 0 8px" }}>{title}</p>
  );

  // ─── PUBLIC PROFILE VIEW ──────────────────────────────────────────────────
  const renderProfile = () => {
    if (profileLoading && !hasProfileLoadedOnce && !showProfileSkeleton) {
      return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;
    }

    if (profileLoading && !hasProfileLoadedOnce) {
      const pulse = "pulse 1.5s ease-in-out infinite";
      const bar = (w: string, h: string, extra: React.CSSProperties = {}) => (
        <div style={{ width: w, height: h, borderRadius: "4px", background: "#1a1a1a", animation: pulse, ...extra }} />
      );
      return (
        <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
          <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
            {bar("100px", "18px")}
            {bar("36px", "36px", { borderRadius: "8px" })}
          </div>
          <div style={{ padding: "1.5rem 1.25rem", paddingTop: "calc(6rem + env(safe-area-inset-top, 0px))" }}>
            {/* Logo + name */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
              {bar("72px", "72px", { borderRadius: "14px", flexShrink: 0 })}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {bar("140px", "20px")}
                {bar("100px", "13px")}
              </div>
            </div>

            {/* Bio */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "1.5rem" }}>
              {bar("100%", "13px")}
              {bar("85%", "13px")}
            </div>

            {/* Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.5rem" }}>
              {[70, 90, 60].map((w, i) => <div key={i}>{bar(`${w}px`, "26px", { borderRadius: "20px" })}</div>)}
            </div>

            <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "1.5rem" }} />

            {/* Content sections */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[0, 1, 2].map(i => (
                <div key={i}>
                  {bar("100px", "11px", { marginBottom: "8px" })}
                  {bar("160px", "13px")}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Brand Profile</span>
        <div onClick={() => { setView("settings"); setSettingsSection("main"); }} style={{ width: "36px", height: "36px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}>
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
        </div>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", paddingTop: "calc(6rem + env(safe-area-inset-top, 0px))" }}>
        {/* Logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "14px", border: "1px solid #333", background: "#111", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#777" }}>
            {logo ? <img src={logo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff" }}>{name || "Your Brand"}</p>
              {isVerified && <VerifiedBadge />}
              {isEnterprise && (
                <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: "1px solid #fff", color: "#fff" }}>Enterprise</span>
              )}
            </div>
            <p style={{ fontSize: "13px", color: "#999" }}>{industry}{location ? ` · ${location}` : ""}</p>
          </div>
        </div>

        {bio && <p style={{ fontSize: "13px", color: "#bbb", lineHeight: 1.7, marginBottom: "1.5rem" }}>{bio}</p>}

        {industry && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.5rem" }}>
            {industry.split(",").map(n => n.trim()).filter(Boolean).map(n => (
              <span key={n} style={{ padding: "5px 12px", borderRadius: "20px", border: "1px solid #222", color: "#999", fontSize: "12px" }}>{n}</span>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "1.5rem" }} />

        {/* Content types */}
        {contentTypes.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Content We Need</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {contentTypes.map(c => <span key={c} style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #222", color: "#999", fontSize: "12px" }}>{c}</span>)}
            </div>
          </div>
        )}

        {/* Target audience */}
        {targetAudience && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Target Audience</label>
            <p style={{ fontSize: "13px", color: "#bbb" }}>{targetAudience}</p>
          </div>
        )}

        {/* Creator tier */}
        {targetTier && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Preferred Creator Tier</label>
            <p style={{ fontSize: "13px", color: "#bbb" }}>{CREATOR_TIERS.find(t => t.value === targetTier)?.label || targetTier}</p>
          </div>
        )}

        {/* Links */}
        {(website || instagram) && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Links</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {website && (
                <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: "13px", color: "#ccc", textDecoration: "underline" }}>{website}</a>
              )}
              {instagram && <p style={{ fontSize: "13px", color: "#bbb" }}>Instagram: {instagram}</p>}
            </div>
          </div>
        )}

        {/* Social */}
        {(() => {
          const tiktokConnection = socialConnections.find(c => c.platform === "tiktok");
          if (!tiktokConnection && !tiktok) return null;
          return (
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={labelStyle}>Social</label>
              <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <TikTokIcon size={22} />
                  <div>
                    <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>TikTok</p>
                    <p style={{ color: "#999", fontSize: "12px", marginTop: "2px" }}>@{tiktokConnection?.username || tiktok}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {tiktokConnection && <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #333", color: "#34c759" }}>Verified ✓</span>}
                  {tiktokConnection?.follower_count != null && <p style={{ color: "#999", fontSize: "11px", marginTop: "6px" }}>{tiktokConnection.follower_count.toLocaleString()} followers</p>}
                </div>
              </div>
              {COMING_SOON_SOCIALS.map(platform => (
                <div key={platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "10px 14px", marginBottom: "8px" }}>
                  <p style={{ fontSize: "13px", color: "#888", fontWeight: 500 }}>{platform}</p>
                  <span style={{ fontSize: "10px", padding: "3px 9px", borderRadius: "20px", border: "1px solid #222", color: "#777" }}>Coming soon</span>
                </div>
              ))}
              {!tiktokConnection && (
                <p style={{ fontSize: "11px", color: "#888", lineHeight: 1.6 }}>
                  Connect TikTok in Manage Accounts to show a verified badge here.
                </p>
              )}
            </div>
          );
        })()}

        {/* Track Record */}
        {trackRecord && (trackRecord.completedCampaigns > 0 || trackRecord.reviewCount > 0) && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Track Record</label>
            <div style={{ display: "flex", gap: "10px", marginBottom: "1rem" }}>
              <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                <p style={{ color: "#fff", fontSize: "18px", fontWeight: 700 }}>{trackRecord.completedCampaigns}</p>
                <p style={{ color: "#999", fontSize: "11px", marginTop: "2px" }}>Completed</p>
              </div>
              <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                {trackRecord.avgRating != null ? (
                  <>
                    <StarRating rating={trackRecord.avgRating} size={13} />
                    <p style={{ color: "#999", fontSize: "11px", marginTop: "6px" }}>{trackRecord.avgRating.toFixed(1)} ({trackRecord.reviewCount})</p>
                  </>
                ) : (
                  <>
                    <p style={{ color: "#999", fontSize: "13px" }}>—</p>
                    <p style={{ color: "#999", fontSize: "11px", marginTop: "6px" }}>No ratings yet</p>
                  </>
                )}
              </div>
              <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                <p style={{ color: "#fff", fontSize: "18px", fontWeight: 700 }}>{formatResponseTime(trackRecord.avgResponseHours) || "—"}</p>
                <p style={{ color: "#999", fontSize: "11px", marginTop: "2px" }}>Avg. reply time</p>
              </div>
            </div>
            {reviews.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {reviews.map(r => (
                  <div key={r.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#777" }}>
                          {r.creator_avatar ? <img src={r.creator_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◉"}
                        </div>
                        <p style={{ color: "#fff", fontSize: "12px", fontWeight: 600 }}>{r.creator_name || "Creator"}</p>
                      </div>
                      <StarRating rating={r.rating} size={11} />
                    </div>
                    {r.comment && <p style={{ color: "#bbb", fontSize: "12px", lineHeight: 1.6, marginBottom: "4px" }}>{r.comment}</p>}
                    <p style={{ color: "#777", fontSize: "10px" }}>{r.campaign_name ? `${r.campaign_name} · ` : ""}{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state — only covers content/audience/tier/links, not bio/industry/location */}
        {!contentTypes.length && !targetAudience && !targetTier && !website && !instagram && !tiktok && !socialConnections.some(c => c.platform === "tiktok") && !(trackRecord && (trackRecord.completedCampaigns > 0 || trackRecord.reviewCount > 0)) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 2rem", marginTop: "0.5rem" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#777", marginBottom: "1rem" }}>◈</div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px", textAlign: "center" }}>No content yet</p>
            <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.7, textAlign: "center", maxWidth: "260px" }}>You haven't added asset formats, target audience, or links yet. Fill these out from Edit Profile so creators know what you're looking for.</p>
          </div>
        )}
      </div>
    </div>
    );
  };

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

      {/* Enterprise banner / theme toggle */}
      <div style={{ margin: "1rem 1.25rem 0", display: "flex", flexDirection: "column", gap: "10px" }}>
        {!isEnterprise && (
          <div
            onClick={() => navigate("enterprise")}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #fff", borderRadius: "10px", padding: "12px 16px", cursor: "pointer" }}
          >
            <div>
              <p style={{ color: "#0a0a0a", fontSize: "13px", fontWeight: 700 }}>Upgrade to Enterprise</p>
              <p style={{ color: "#999", fontSize: "12px", marginTop: "2px" }}>0% platform fees for you & creators</p>
            </div>
            <span style={{ fontSize: "12px", color: "#0a0a0a", fontWeight: 700 }}>→</span>
          </div>
        )}
        {isEnterprise && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px 16px" }}>
              <div>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Enterprise Plan Active</p>
                <p style={{ color: "#888", fontSize: "12px", marginTop: "2px" }}>0% platform fees enabled</p>
              </div>
              <span style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #fff", color: "#fff" }}>Active</span>
            </div>
           {cancelledAtPeriodEnd ? (
  <div style={{ padding: "12px 16px", borderRadius: "10px", border: "1px solid #1a1a1a", fontSize: "13px", fontWeight: 500, textAlign: "center", color: "#888", lineHeight: 1.5 }}>
    <p style={{ margin: 0, marginBottom: "2px", color: "#fff", fontWeight: 600 }}>Cancellation Scheduled</p>
    <p style={{ margin: 0, fontSize: "12px" }}>Your plan remains active until the end of your billing period.</p>
  </div>
) : (
  <div
    onClick={() => setShowCancelModal(true)}
    style={{ padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.4)", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", color: "#6366f1", letterSpacing: "0.08em", textTransform: "uppercase" }}
  >
    Manage Subscription
  </div>
)}

            {showCancelModal && (
              <div onClick={() => !cancelLoading && setShowCancelModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.25rem", paddingTop: "4rem" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "14px", padding: "1.5rem", width: "100%", maxWidth: "480px", marginBottom: "1rem" }}>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>Manage Your Plan</p>
                  <p style={{ fontSize: "13px", color: "#999", marginBottom: "1.5rem", lineHeight: 1.6 }}>Switch billing periods or cancel your Enterprise subscription. Changes take effect immediately.</p>

                  <p style={{ fontSize: "12px", color: "#999", marginBottom: "10px", lineHeight: 1.6 }}>To cancel your Enterprise subscription and revert to standard platform fees, tap below. This cannot be undone.</p>
                  <div onClick={!cancelLoading ? handleCancelSubscription : undefined} style={{ padding: "13px", borderRadius: "8px", border: "1px solid rgba(255,68,68,0.3)", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: cancelLoading ? "default" : "pointer", color: "#ff4444", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}>
                    {cancelLoading ? "Processing..." : "Cancel Subscription"}
                  </div>

                  {cancelError && <p style={{ fontSize: "12px", color: "#ff4444", marginTop: "10px", textAlign: "center" }}>{cancelError}</p>}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px 16px" }}>
          <div>
            <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Inverted Light Mode</p>
            <p style={{ color: "#888", fontSize: "12px", marginTop: "2px" }}>Toggle display theme</p>
          </div>
          <div onClick={toggleTheme} style={{ width: "44px", height: "24px", borderRadius: "12px", background: isInverted ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: "3px", left: isInverted ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: isInverted ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
          </div>
        </div>
      </div>

      <div style={{ padding: "0 1.25rem" }}>
        {sectionHeader("Brand Account")}
        {settingsRow("Edit Profile", "Name, bio, industry, location, links", () => setSettingsSection("edit-profile"))}
        {settingsRow("Manage Accounts", "Connect TikTok/Instagram to post creator content", () => setSettingsSection("manage-accounts"))}
        {settingsRow("Get Verified", isVerified ? "Verified ✓" : verificationRequest ? "Request pending review" : "Request a verified badge", () => setSettingsSection("get-verified"))}
        {settingsRow("Industry & Content Needs", "Sectors and media formats you need", () => setSettingsSection("industry-selection"))}
        {settingsRow("Campaign Preferences", "Creator tier and target audience", () => setSettingsSection("campaign-preferences"))}
        {settingsRow("Notifications", notificationsEnabled ? "Push notifications on" : "Push notifications off", () => setSettingsSection("notifications"))}
        {settingsRow("Visibility", "Control what creators see", () => setSettingsSection("visibility"))}
        {settingsRow("Share Profile", "Get your shareable brand link", () => setSettingsSection("share-profile"))}

        {sectionHeader("FlipCollab Activity")}
        {settingsRow("Favourited Creators", `${favouritedCreators.length} saved`, () => setSettingsSection("favourites"))}
        {settingsRow("Reported & Blocked", `${blockedUsers.length} blocked · ${myReports.length} reported`, () => setSettingsSection("reports-blocked"))}

        {isAdmin && sectionHeader("Admin")}
        {isAdmin && settingsRow("Admin Review", "Verification requests & reports", () => navigate("admin-review"))}

        {sectionHeader("General")}
        {settingsRow("About FlipCollab", "Learn about us", () => window.open("https://about.flipcollab.com", "_blank"))}
        {settingsRow("Help Centre", "FAQs and support", () => setSettingsSection("help"))}
        {settingsRow("Privacy Policy", "How we use your data", () => window.open("https://privacy.flipcollab.com", "_blank"))}
{settingsRow("Terms of Service", "Platform rules", () => window.open("https://terms.flipcollab.com", "_blank"))}
        {settingsRow("Debug Log", "For troubleshooting freezes", () => setSettingsSection("debug-log"))}

        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "2rem" }}>
          <div
            onClick={forceSignOut}
            style={{ padding: "14px", borderRadius: "8px", border: "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", color: "#999", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Sign Out
          </div>
          <div
            onClick={async () => {
              const confirmed = window.confirm("Delete your account? This cannot be undone.");
              if (!confirmed) return;
              if (userId) {
                await supabase.from("profiles").delete().eq("id", userId);
                await supabase.functions.invoke("delete-user", { body: { user_id: userId } });
              }
              await forceSignOut();
            }}
            style={{ padding: "14px", borderRadius: "8px", border: "1px solid rgba(255,68,68,0.3)", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", color: "#ff4444", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
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

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1rem" }}>
          <div onClick={() => logoRef.current?.click()} style={{ width: "80px", height: "80px", borderRadius: "14px", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", marginBottom: "8px" }}>
            {logo ? <img src={logo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "24px", color: "#777" }}>+</span>}
          </div>
          <span style={{ fontSize: "12px", color: "#888" }}>Tap to change logo</span>
          <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
        </div>

        <div><label style={labelStyle}>Brand Name</label><input style={inputStyle} placeholder="Your brand name" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label style={labelStyle}>Industry / Niche</label><input style={inputStyle} placeholder="e.g. Beauty, Fashion" value={industry} onChange={e => setIndustry(e.target.value)} /></div>
        <div><label style={labelStyle}>Location</label><LocationInput inputStyle={inputStyle} value={location} onChange={setLocation} /></div>
        <div><label style={labelStyle}>Bio</label><textarea style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }} placeholder="Tell creators about your brand..." value={bio} onChange={e => setBio(e.target.value)} /></div>

        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1rem" }}>
          <label style={labelStyle}>Links</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input style={inputStyle} placeholder="https://yourbrand.com" value={website} onChange={e => setWebsite(e.target.value)} />
            <input style={inputStyle} placeholder="Instagram @handle" value={instagram} onChange={e => setInstagram(e.target.value)} />
            <input style={inputStyle} placeholder="TikTok @handle" value={tiktok} onChange={e => setTiktok(e.target.value)} />
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

  // ─── INDUSTRY & CONTENT ───────────────────────────────────────────────────
  const renderIndustrySelection = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "8rem" }}>
      {renderSettingsHeader("Industry & Content Needs", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label style={labelStyle}>Industry</label>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>Select your primary sector</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {INDUSTRIES.map(ind => (
              <div key={ind} onClick={() => setIndustry(ind)} style={chipStyle(industry === ind)}>{ind}</div>
            ))}
          </div>
          <div style={{ marginTop: "12px" }}>
            <label style={labelStyle}>Or type your own</label>
            <input style={inputStyle} placeholder="e.g. Beauty, Fashion" value={industry} onChange={e => setIndustry(e.target.value)} />
          </div>
        </div>

        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1rem" }}>
          <label style={labelStyle}>Content Formats Needed</label>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>What do you want creators to produce?</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {ACTIVATION_TYPES.map(c => (
              <div key={c} onClick={() => toggleContent(c)} style={chipStyle(contentTypes.includes(c))}>{c}</div>
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

  // ─── CAMPAIGN PREFERENCES ─────────────────────────────────────────────────
  const renderCampaignPreferences = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "8rem" }}>
      {renderSettingsHeader("Campaign Preferences", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label style={labelStyle}>Target Creator Tier</label>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>Helps surface the right talent for your campaigns</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {CREATOR_TIERS.map(tier => (
              <div
                key={tier.value}
                onClick={() => setTargetTier(tier.value)}
                style={{ ...chipStyle(targetTier === tier.value), borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}
              >
                <span style={{ fontWeight: 600, fontSize: "13px", color: targetTier === tier.value ? "#0a0a0a" : "#fff" }}>{tier.label}</span>
                <span style={{ fontSize: "11px", color: targetTier === tier.value ? "#555" : "#444" }}>{tier.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Target Audience</label>
          <input style={inputStyle} placeholder="e.g. Gen Z UK, 18-24 fitness enthusiasts" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} />
        </div>
      </div>

      <div style={{ position: "sticky", bottom: "96px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
        <div onClick={saveProfile} style={{ padding: "14px", borderRadius: "8px", background: saved ? "#1a1a1a" : "#fff", color: saved ? "#fff" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </div>
      </div>
    </div>
  );

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
            <p style={{ color: "#888", fontSize: "12px", marginTop: "2px" }}>New applications, messages, and payments</p>
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
      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
          <div>
            <p style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>Public Profile</p>
            <p style={{ color: "#888", fontSize: "12px", marginTop: "2px" }}>Creators can find and view your brand profile</p>
          </div>
          <div onClick={() => setProfileVisible(p => !p)} style={{ width: "44px", height: "24px", borderRadius: "12px", background: profileVisible ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: "3px", left: profileVisible ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: profileVisible ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
          </div>
        </div>
      </div>
    </div>
  );

  // ─── SHARE PROFILE ────────────────────────────────────────────────────────
  const renderShareProfile = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Share Profile", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "13px", color: "#999", marginBottom: "1.5rem", lineHeight: 1.6 }}>Share your FlipCollab brand page with creators or on your social channels.</p>
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "#999", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shareLink}</p>
          <div
            onClick={() => { navigator.clipboard.writeText(shareLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
            style={{ padding: "7px 14px", background: linkCopied ? "#1a1a1a" : "#fff", color: linkCopied ? "#555" : "#0a0a0a", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }}
          >
            {linkCopied ? "Copied ✓" : "Copy"}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── FAVOURITES ───────────────────────────────────────────────────────────
  const renderFavourites = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Favourited Creators", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        {favouritedCreators.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#777", textAlign: "center", padding: "2rem", border: "1px dashed #1a1a1a", borderRadius: "10px" }}>No creators favourited yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {favouritedCreators.map((f, i) => (
              <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {(f.creator_profiles as any)?.avatar_url
  ? <img src={(f.creator_profiles as any).avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  : "◉"}
</div>
<div>
  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{(f.creator_profiles as any)?.name || "Creator"}</p>
  <p style={{ color: "#888", fontSize: "11px", marginTop: "2px" }}>{(f.creator_profiles as any)?.niche || ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── MANAGE ACCOUNTS ────────────────────────────────────────────────────────
  const renderManageAccounts = () => {
    const connectedPlatforms = new Set(socialConnections.map(c => c.platform));
    const findConnection = (p: SocialPlatform) => socialConnections.find(c => c.platform === p);

    return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Manage Accounts", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        {socialNotice && (
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "10px", padding: "12px 14px", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "12px", color: "#ccc" }}>{socialNotice}</p>
            <span onClick={() => setSocialNotice("")} style={{ color: "#999", cursor: "pointer", fontSize: "14px" }}>✕</span>
          </div>
        )}
        <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.6, marginBottom: "1rem" }}>
          Connect your own TikTok or Instagram so you can post creator-made content directly to your brand account once payment has released. Connecting TikTok also shows a verified TikTok badge on your public profile, so creators know it's really you.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(["instagram", "tiktok"] as SocialPlatform[]).map(platform => {
            const connection = findConnection(platform);
            const label = platform === "instagram" ? "Instagram" : "TikTok";
            return (
              <div key={platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
                <div>
                  <p style={{ fontSize: "14px", color: "#fff", fontWeight: 600 }}>{label}</p>
                  {connection && <p style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>{connection.username ? `@${connection.username}` : "Connected"}</p>}
                </div>
                {connectedPlatforms.has(platform) ? (
                  <span onClick={() => handleDisconnectSocial(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", color: "#ff4444", cursor: "pointer" }}>Disconnect</span>
                ) : (
                  <span onClick={() => handleConnectSocial(platform)} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "20px", border: "1px solid #fff", color: "#fff", cursor: connectingPlatform ? "default" : "pointer", opacity: connectingPlatform && connectingPlatform !== platform ? 0.4 : 1 }}>
                    {connectingPlatform === platform ? "Connecting..." : "Connect"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    );
  };

  const renderGetVerified = () => {
    return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Get Verified", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        {isVerified ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "16px" }}>
            <VerifiedBadge size={18} />
            <p style={{ fontSize: "13px", color: "#fff" }}>Your brand is verified.</p>
          </div>
        ) : verificationRequest ? (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "16px" }}>
            <p style={{ fontSize: "13px", color: "#fff", fontWeight: 600 }}>Request pending review</p>
            <p style={{ fontSize: "12px", color: "#999", marginTop: "6px", lineHeight: 1.6 }}>
              Our team is looking into it. You'll see the verified tick appear next to your name once it's approved.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.6, marginBottom: "1rem" }}>
              Request a manual review and our team will take a look. Enterprise brands are verified automatically.
            </p>
            <textarea
              value={verificationNote}
              onChange={e => setVerificationNote(e.target.value)}
              placeholder="Anything that helps us confirm you're a real brand (website, socials, etc.) — optional"
              rows={4}
              style={{ width: "100%", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px 14px", color: "#fff", fontSize: "13px", fontFamily: "inherit", resize: "none", marginBottom: "1rem" }}
            />
            <span
              onClick={submittingVerification ? undefined : handleRequestVerification}
              style={{ display: "block", textAlign: "center", background: "#fff", color: "#000", fontSize: "13px", fontWeight: 600, borderRadius: "10px", padding: "14px", cursor: submittingVerification ? "default" : "pointer", opacity: submittingVerification ? 0.6 : 1 }}
            >
              {submittingVerification ? "Submitting..." : "Request Verification"}
            </span>
          </>
        )}
      </div>
    </div>
    );
  };

  // ─── HELP ─────────────────────────────────────────────────────────────────
  const renderHelp = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      {renderSettingsHeader("Help Centre", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        {[
          { q: "How do I post a campaign?", a: "Go to the Post tab in the bottom nav. Fill in your campaign details, set a budget, and publish. Creators will be able to see and apply to it immediately." },
          { q: "What is the platform fee?", a: "FlipCollab adds a 5% fee on top of what you pay creators. Upgrade to Enterprise for 0% fees on both sides." },
          { q: "How do I pay creators?", a: "When you accept a creator's application, a payment is triggered via Stripe. Funds are held in escrow and released upon content delivery." },
          { q: "Can I message creators directly?", a: "Yes — use the Search tab to find creators and tap Message to start a conversation." },
          { q: "How do I delete my account?", a: "Go to Settings and scroll to the bottom. Tap Delete Account. This is permanent and cannot be undone." },
        ].map(({ q, a }, i) => (
          <div key={i} style={{ marginBottom: "1rem", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
            <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>{q}</p>
            <p style={{ color: "#999", fontSize: "12px", lineHeight: 1.6 }}>{a}</p>
          </div>
        ))}
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", textAlign: "center" }}>
          <p style={{ color: "#999", fontSize: "12px" }}>Still need help? Email us at</p>
          <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>hello@flipcollab.com</p>
        </div>
      </div>
    </div>
  );

  // ─── PRIVACY / TERMS ──────────────────────────────────────────────────────
const renderPrivacyPolicy = () => (
  <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
    {renderSettingsHeader("Privacy Policy", () => setSettingsSection("main"))}
    <div style={{ padding: "1.25rem", color: "#aaa", fontSize: "13px", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ color: "#999", fontSize: "11px" }}>Last updated: January 2026</p>
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
      <p style={{ color: "#999", fontSize: "11px" }}>Last updated: January 2026</p>
      <p>By using FlipCollab you agree to these Terms. You must be at least 18 years old.</p>
      {[
        { t: "1. About FlipCollab", b: "A creator collaboration marketplace connecting brands with content creators for paid and gifted campaigns." },
        { t: "2. Your Account", b: "Keep credentials secure. FlipCollab isn't liable for unauthorised access. You can delete your account anytime from settings." },
        { t: "3. Brand Responsibilities", b: "Post accurate campaign information. Don't pay creators outside FlipCollab to bypass fees — results in immediate termination." },
        { t: "4. Payments & Escrow", b: "All payments via Stripe. Funds held in escrow until content is approved. Disputes must be raised within 7 days to hello@flipcollab.com." },
        { t: "5. Payment Delays", b: "Delays may occur during maintenance or incidents. All escrow funds are guaranteed to be processed once normal operations resume." },
        { t: "6. Platform Fees", b: "A 5% fee is added to brand payments. Enterprise brands get 0% fees." },
        { t: "7. Prohibited Content", b: "No illegal, hateful, explicit, discriminatory, or misleading content. Violations result in account suspension or termination." },
        { t: "8. Intellectual Property", b: "Creators retain content ownership. Completing a campaign grants you a non-exclusive licence for promotional use as agreed." },
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
          <p style={{ color: "#999", fontSize: "12px", lineHeight: 1.6 }}>
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
              style={{ flex: 1, padding: "11px", border: "1px solid #222", color: "#999", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600, textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              Clear
            </div>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", color: "#ccc", fontSize: "11px", lineHeight: 1.6, fontFamily: "monospace" }}>
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
        <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Blocked Users</p>
        {blockedUsers.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "2rem" }}>You haven't blocked anyone.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "2rem" }}>
            {blockedUsers.map(b => (
              <div key={b.blockRowId} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: b.role === "creator" ? "50%" : "10px", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#777" }}>
                  {b.avatar ? <img src={b.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : b.role === "creator" ? "◉" : "◈"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{b.name}</p>
                  <p style={{ fontSize: "11px", color: "#888", textTransform: "capitalize" }}>{b.role}</p>
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

        <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Reports You've Filed</p>
        {myReports.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#888" }}>You haven't reported anyone.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {myReports.map(r => (
              <div key={r.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{r.name}</p>
                <p style={{ fontSize: "12px", color: "#ccc", marginBottom: "6px" }}>{r.reason}</p>
                <p style={{ fontSize: "10px", color: "#888" }}>{new Date(r.created_at).toLocaleDateString()}</p>
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
      {settingsSection === "industry-selection" && renderIndustrySelection()}
      {settingsSection === "campaign-preferences" && renderCampaignPreferences()}
      {settingsSection === "notifications" && renderNotifications()}
      {settingsSection === "visibility" && renderVisibility()}
      {settingsSection === "share-profile" && renderShareProfile()}
      {settingsSection === "favourites" && renderFavourites()}
      {settingsSection === "manage-accounts" && renderManageAccounts()}
      {settingsSection === "get-verified" && renderGetVerified()}
      {settingsSection === "help" && renderHelp()}
      {settingsSection === "privacy-policy" && renderPrivacyPolicy()}
{settingsSection === "terms" && renderTerms()}
      {settingsSection === "debug-log" && renderDebugLog()}
      {settingsSection === "reports-blocked" && renderReportsBlocked()}
    </>
  );
}