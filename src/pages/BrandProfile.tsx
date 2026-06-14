import { useState, useRef, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props {
  navigate: (p: Page) => void;
  toggleTheme: () => void;
  isInverted: boolean;
}

const INDUSTRIES = ["Fashion & Apparel", "Beauty & Cosmetics", "Tech & SaaS", "Health & Wellness", "Food & Beverage", "Fitness", "Design & Home"];
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
  | "visibility"
  | "share-profile"
  | "favourites"
  | "help"
  | "privacy-policy"
  | "terms";

export default function BrandProfile({ navigate, toggleTheme, isInverted }: Props) {
  const [view, setView] = useState<"profile" | "settings">("profile");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("main");

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
  const [shareLink, setShareLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEnterprise, setIsEnterprise] = useState(false);
const [cancelLoading, setCancelLoading] = useState(false);
const [cancelError, setCancelError] = useState("");
const [showCancelModal, setShowCancelModal] = useState(false);
const [changePlan, setChangePlan] = useState<"monthly" | "annual">("monthly");

  // Favourites
  const [favouritedCreators, setFavouritedCreators] = useState<any[]>([]);

  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
    loadFavourites();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setShareLink(`https://flipcollab.app/brand/${user.id}`);

    const { data } = await supabase.from("brand_profiles").select("*").eq("id", user.id).single();
    if (data) {
      setName(data.company_name || data.name || "");
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
    setIsEnterprise(false);
    setShowCancelModal(false);
  } catch {
    setCancelError("Something went wrong. Try again.");
  }
  setCancelLoading(false);
};

const handleChangePlan = async () => {
  if (!userId) return;
  setCancelLoading(true);
  setCancelError("");
  try {
    // Cancel current then resubscribe on new plan
    await supabase.functions.invoke("cancel-subscription", { body: { brand_id: userId } });
    const res = await supabase.functions.invoke("create-subscription", {
      body: { brand_id: userId, email: (await supabase.auth.getUser()).data.user?.email, plan: changePlan }
    });
    if (res.error || !res.data?.subscriptionId) {
      setCancelError("Failed to switch plan. Please contact support.");
      setCancelLoading(false);
      return;
    }
    await supabase.from("brand_profiles").update({ is_enterprise: true }).eq("id", userId);
    setIsEnterprise(true);
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
      .select("creator_id, profiles(name, niche, avatar_url)")
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
      setLogo(data.publicUrl);
      setLogoUrl(data.publicUrl);
      await supabase.from("brand_profiles").update({ logo_url: data.publicUrl, avatar_url: data.publicUrl }).eq("id", userId);
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

  // ─── PUBLIC PROFILE VIEW ──────────────────────────────────────────────────
  const renderProfile = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Brand Profile</span>
        <div onClick={() => { setView("settings"); setSettingsSection("main"); }} style={{ width: "36px", height: "36px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}>
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
          <div style={{ width: "18px", height: "2px", background: "#fff", borderRadius: "1px" }} />
        </div>
      </div>

      <div style={{ padding: "1.5rem 1.25rem" }}>
        {/* Logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "14px", border: "1px solid #333", background: "#111", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#333" }}>
            {logo ? <img src={logo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff" }}>{name || "Your Brand"}</p>
              {isEnterprise && (
                <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: "1px solid #fff", color: "#fff" }}>Enterprise</span>
              )}
            </div>
            <p style={{ fontSize: "13px", color: "#555" }}>{industry}{location ? ` · ${location}` : ""}</p>
          </div>
        </div>

        {bio && <p style={{ fontSize: "13px", color: "#777", lineHeight: 1.7, marginBottom: "1.5rem" }}>{bio}</p>}

        {industry && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.5rem" }}>
            {industry.split(",").map(n => n.trim()).filter(Boolean).map(n => (
              <span key={n} style={{ padding: "5px 12px", borderRadius: "20px", border: "1px solid #222", color: "#555", fontSize: "12px" }}>{n}</span>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "1.5rem" }} />

        {/* Content types */}
        {contentTypes.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Content We Need</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {contentTypes.map(c => <span key={c} style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #222", color: "#555", fontSize: "12px" }}>{c}</span>)}
            </div>
          </div>
        )}

        {/* Target audience */}
        {targetAudience && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Target Audience</label>
            <p style={{ fontSize: "13px", color: "#777" }}>{targetAudience}</p>
          </div>
        )}

        {/* Creator tier */}
        {targetTier && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Preferred Creator Tier</label>
            <p style={{ fontSize: "13px", color: "#777" }}>{CREATOR_TIERS.find(t => t.value === targetTier)?.label || targetTier}</p>
          </div>
        )}

        {/* Links */}
        {(website || instagram || tiktok) && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Links</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {website && (
                <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: "13px", color: "#ccc", textDecoration: "underline" }}>{website}</a>
              )}
              {instagram && <p style={{ fontSize: "13px", color: "#777" }}>Instagram: {instagram}</p>}
              {tiktok && <p style={{ fontSize: "13px", color: "#777" }}>TikTok: {tiktok}</p>}
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

      {/* Enterprise banner / theme toggle */}
      <div style={{ margin: "1rem 1.25rem 0", display: "flex", flexDirection: "column", gap: "10px" }}>
        {!isEnterprise && (
          <div
            onClick={() => navigate("enterprise")}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #fff", borderRadius: "10px", padding: "12px 16px", cursor: "pointer" }}
          >
            <div>
              <p style={{ color: "#0a0a0a", fontSize: "13px", fontWeight: 700 }}>Upgrade to Enterprise</p>
              <p style={{ color: "#555", fontSize: "12px", marginTop: "2px" }}>0% platform fees for you & creators</p>
            </div>
            <span style={{ fontSize: "12px", color: "#0a0a0a", fontWeight: 700 }}>→</span>
          </div>
        )}
        {isEnterprise && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px 16px" }}>
              <div>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Enterprise Plan Active</p>
                <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>0% platform fees enabled</p>
              </div>
              <span style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #fff", color: "#fff" }}>Active</span>
            </div>
            <div
              onClick={() => setShowCancelModal(true)}
              style={{ padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(255,68,68,0.3)", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", color: "#ff4444", letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              Manage Subscription
            </div>

            {showCancelModal && (
              <div onClick={() => !cancelLoading && setShowCancelModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "1.25rem" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "14px", padding: "1.5rem", width: "100%", maxWidth: "480px", marginBottom: "1rem" }}>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>Manage Your Plan</p>
                  <p style={{ fontSize: "13px", color: "#555", marginBottom: "1.5rem", lineHeight: 1.6 }}>Switch billing periods or cancel your Enterprise subscription. Changes take effect immediately.</p>

                  <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: "10px" }}>Switch Billing Period</p>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "1.25rem" }}>
                    {[{ label: "Monthly", price: "£97/mo", val: "monthly" as const }, { label: "Annual", price: "£82/mo", val: "annual" as const }].map(({ label, price, val }) => (
                      <div key={val} onClick={() => setChangePlan(val)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${changePlan === val ? "#fff" : "#222"}`, background: changePlan === val ? "#fff" : "transparent", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                        <p style={{ fontSize: "11px", fontWeight: 600, color: changePlan === val ? "#0a0a0a" : "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: changePlan === val ? "#0a0a0a" : "#fff", marginTop: "2px" }}>{price}</p>
                      </div>
                    ))}
                  </div>

                  <div onClick={!cancelLoading ? handleChangePlan : undefined} style={{ padding: "13px", borderRadius: "8px", background: cancelLoading ? "#1a1a1a" : "#fff", color: cancelLoading ? "#555" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: cancelLoading ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px", transition: "all 0.2s" }}>
                    {cancelLoading ? "Processing..." : "Confirm Plan Change"}
                  </div>

                  <div style={{ height: "1px", background: "#1a1a1a", margin: "1rem 0" }} />

                  <p style={{ fontSize: "12px", color: "#555", marginBottom: "10px", lineHeight: 1.6 }}>To fully cancel your Enterprise subscription and revert to standard fees, tap below. This cannot be undone.</p>
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
            <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>Toggle display theme</p>
          </div>
          <div onClick={toggleTheme} style={{ width: "44px", height: "24px", borderRadius: "12px", background: isInverted ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: "3px", left: isInverted ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: isInverted ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
          </div>
        </div>
      </div>

      <div style={{ padding: "0 1.25rem" }}>
        {sectionHeader("Brand Account")}
        {settingsRow("Edit Profile", "Name, bio, industry, location, links", () => setSettingsSection("edit-profile"))}
        {settingsRow("Industry & Content Needs", "Sectors and media formats you need", () => setSettingsSection("industry-selection"))}
        {settingsRow("Campaign Preferences", "Creator tier and target audience", () => setSettingsSection("campaign-preferences"))}
        {settingsRow("Visibility", "Control what creators see", () => setSettingsSection("visibility"))}
        {settingsRow("Share Profile", "Get your shareable brand link", () => setSettingsSection("share-profile"))}

        {sectionHeader("FlipCollab Activity")}
        {settingsRow("Favourited Creators", `${favouritedCreators.length} saved`, () => setSettingsSection("favourites"))}

        {sectionHeader("General")}
        {settingsRow("About FlipCollab", "Learn about us", () => window.open("https://flipcollab.app/about", "_blank"))}
        {settingsRow("Help Centre", "FAQs and support", () => setSettingsSection("help"))}
        {settingsRow("Privacy Policy", "How we use your data", () => setSettingsSection("privacy-policy"))}
        {settingsRow("Terms of Service", "Platform rules", () => setSettingsSection("terms"))}

        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "2rem" }}>
          <div
            onClick={async () => { await supabase.auth.signOut(); navigate("role-select"); }}
            style={{ padding: "14px", borderRadius: "8px", border: "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}
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
                await supabase.auth.signOut();
              }
              navigate("role-select");
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
            {logo ? <img src={logo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "24px", color: "#333" }}>+</span>}
          </div>
          <span style={{ fontSize: "12px", color: "#444" }}>Tap to change logo</span>
          <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
        </div>

        <div><label style={labelStyle}>Brand Name</label><input style={inputStyle} placeholder="Your brand name" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label style={labelStyle}>Industry / Niche</label><input style={inputStyle} placeholder="e.g. Beauty, Fashion" value={industry} onChange={e => setIndustry(e.target.value)} /></div>
        <div><label style={labelStyle}>Location</label><input style={inputStyle} placeholder="e.g. London, UK" value={location} onChange={e => setLocation(e.target.value)} /></div>
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

      <div style={{ position: "fixed", bottom: "72px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
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
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "10px" }}>Select your primary sector</p>
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
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "10px" }}>What do you want creators to produce?</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {ACTIVATION_TYPES.map(c => (
              <div key={c} onClick={() => toggleContent(c)} style={chipStyle(contentTypes.includes(c))}>{c}</div>
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

  // ─── CAMPAIGN PREFERENCES ─────────────────────────────────────────────────
  const renderCampaignPreferences = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "8rem" }}>
      {renderSettingsHeader("Campaign Preferences", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label style={labelStyle}>Target Creator Tier</label>
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "10px" }}>Helps surface the right talent for your campaigns</p>
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

      <div style={{ position: "fixed", bottom: "72px", left: 0, right: 0, padding: "1rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111" }}>
        <div onClick={saveProfile} style={{ padding: "14px", borderRadius: "8px", background: saved ? "#1a1a1a" : "#fff", color: saved ? "#fff" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </div>
      </div>
    </div>
  );

  // ─── VISIBILITY ───────────────────────────────────────────────────────────
  const renderVisibility = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {renderSettingsHeader("Visibility", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px" }}>
          <div>
            <p style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>Public Profile</p>
            <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>Creators can find and view your brand profile</p>
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
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {renderSettingsHeader("Share Profile", () => setSettingsSection("main"))}
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "13px", color: "#555", marginBottom: "1.5rem", lineHeight: 1.6 }}>Share your FlipCollab brand page with creators or on your social channels.</p>
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "#555", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shareLink}</p>
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
          <p style={{ fontSize: "12px", color: "#333", textAlign: "center", padding: "2rem", border: "1px dashed #1a1a1a", borderRadius: "10px" }}>No creators favourited yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {favouritedCreators.map((f, i) => (
              <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {(f.profiles as any)?.avatar_url
                    ? <img src={(f.profiles as any).avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : "◉"}
                </div>
                <div>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{(f.profiles as any)?.name || "Creator"}</p>
                  <p style={{ color: "#444", fontSize: "11px", marginTop: "2px" }}>{(f.profiles as any)?.niche || ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── HELP ─────────────────────────────────────────────────────────────────
  const renderHelp = () => (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
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

  // ─── PRIVACY / TERMS ──────────────────────────────────────────────────────
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
      {settingsSection === "industry-selection" && renderIndustrySelection()}
      {settingsSection === "campaign-preferences" && renderCampaignPreferences()}
      {settingsSection === "visibility" && renderVisibility()}
      {settingsSection === "share-profile" && renderShareProfile()}
      {settingsSection === "favourites" && renderFavourites()}
      {settingsSection === "help" && renderHelp()}
      {settingsSection === "privacy-policy" && renderDoc("Privacy Policy", "FlipCollab collects your brand name, email, profile information, and payment data to operate the platform. We use Supabase for data storage, Stripe for payments, and Vercel for hosting. We do not sell your data to third parties. Data is retained for as long as your account is active. You may request deletion at any time.")}
      {settingsSection === "terms" && renderDoc("Terms of Service", "By using FlipCollab you agree to our Terms & Conditions. Brands agree to post accurate campaign information and pay creators as agreed. A 5% platform fee is added to brand payments and a 10% fee is deducted from creator earnings. Enterprise brands receive 0% fees. All payments are processed through Stripe with escrow protection. FlipCollab is governed by the laws of England and Wales.")}
    </>
  );
}