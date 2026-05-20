import { useState, useRef, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

const CREATOR_TIERS = [
  { label: "Nano-Tier Scale", sub: "Under 10k: High-engagement niche focus", value: "nano" },
  { label: "Micro-Tier Authority", sub: "10k - 100k: Optimized for reach & conversion", value: "micro" },
  { label: "Mid-Tier Influence", sub: "100k - 500k: Established market presence", value: "mid" },
  { label: "Macro-Tier Reach", sub: "500k - 1M: Mass awareness spikes", value: "macro" },
  { label: "Elite/Mega Impact", sub: "1M+: Cultural celebrity & global visibility", value: "mega" }
];

export default function BrandProfile({ navigate }: Props) {
  const [logo, setLogo] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [targetTier, setTargetTier] = useState(""); // State added for synchronized data alignment
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase.from("brand_profiles").select("*").eq("id", user.id).single();
    if (data) {
      // Linked to map accurately against onboarding keys
      setName(data.company_name || data.name || ""); 
      setBio(data.bio || "");
      setWebsite(data.website || "");
      setInstagram(data.instagram || "");
      setTiktok(data.tiktok || "");
      setNiche(data.industry || data.niche || ""); 
      setLocation(data.location || "");
      setTargetTier(data.budget_range || ""); // Maps to backend column slot seamlessly
      setLogo(data.logo_url || data.avatar_url || null);
      setLogoUrl(data.logo_url || data.avatar_url || null);
    }
  };

  useEffect(() => { loadProfile(); }, []);

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

      const { data: existing } = await supabase.from("brand_profiles").select("id").eq("id", userId).single();
      if (existing) {
        await supabase.from("brand_profiles").update({ logo_url: data.publicUrl, avatar_url: data.publicUrl }).eq("id", userId);
      } else {
        await supabase.from("brand_profiles").insert({ id: userId, logo_url: data.publicUrl, avatar_url: data.publicUrl });
      }
    }
  };

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);

    const profileData = {
      id: userId,
      company_name: name, // Matches keys perfectly across database reads
      name: name,
      bio, 
      website, 
      instagram, 
      tiktok, 
      industry: niche, 
      niche: niche,
      location,
      budget_range: targetTier, // Saves selection state smoothly
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
    background: "#111",
    border: "1px solid #222",
    borderRadius: "8px",
    padding: "11px 14px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#555",
    marginBottom: "6px",
    display: "block",
  };

  const selectStyle: React.CSSProperties = {
    background: "#111",
    border: "1px solid #222",
    borderRadius: "8px",
    padding: "11px 14px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
    appearance: "none",
    cursor: "pointer"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Brand Profile</span>
        <span onClick={async () => { await supabase.auth.signOut(); navigate("role-select"); }} style={{ fontSize: "12px", color: "#555", cursor: "pointer" }}>Sign out</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "1.5rem 1.25rem", overflowY: "auto", paddingBottom: "6rem" }}>

        {/* Logo Upload */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
          <div onClick={() => logoRef.current?.click()} style={{ width: "90px", height: "90px", borderRadius: "16px", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", marginBottom: "8px" }}>
            {logo ? <img src={logo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "28px", color: "#333" }}>+</span>}
          </div>
          <span style={{ fontSize: "12px", color: "#444" }}>Tap to upload logo</span>
          <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
        </div>

        <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "2rem" }} />

        {/* Brand Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          <div><label style={labelStyle}>Brand Name</label><input style={inputStyle} placeholder="Your brand name" value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label style={labelStyle}>Industry / Niche</label><input style={inputStyle} placeholder="e.g. Beauty, Fashion, Food" value={niche} onChange={e => setNiche(e.target.value)} /></div>
          <div><label style={labelStyle}>Location</label><input style={inputStyle} placeholder="e.g. London, UK" value={location} onChange={e => setLocation(e.target.value)} /></div>
          
          {/* Synchronized Creator Tier Selector Dropdown */}
          <div>
            <label style={labelStyle}>Target Creator Scaling</label>
            <div style={{ position: "relative" }}>
              <select style={selectStyle} value={targetTier} onChange={e => setTargetTier(e.target.value)}>
                <option value="" disabled style={{ color: "#333" }}>Select target scale...</option>
                {CREATOR_TIERS.map(tier => (
                  <option key={tier.value} value={tier.value} style={{ background: "#0a0a0a", color: "#fff" }}>
                    {tier.label} ({tier.sub.split(":")[0]})
                  </option>
                ))}
              </select>
              <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#555", pointerEvents: "none", fontSize: "11px" }}>▼</span>
            </div>
          </div>

          <div><label style={labelStyle}>Bio</label><textarea style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }} placeholder="Tell creators about your brand..." value={bio} onChange={e => setBio(e.target.value)} /></div>
        </div>

        <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "2rem" }} />

        {/* Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          <label style={labelStyle}>Links</label>
          <div><label style={{ ...labelStyle, fontSize: "10px" }}>Website</label><input style={inputStyle} placeholder="https://yourbrand.com" value={website} onChange={e => setWebsite(e.target.value)} /></div>
          <div><label style={{ ...labelStyle, fontSize: "10px" }}>Instagram</label><input style={inputStyle} placeholder="@yourbrand" value={instagram} onChange={e => setInstagram(e.target.value)} /></div>
          <div><label style={{ ...labelStyle, fontSize: "10px" }}>TikTok</label><input style={inputStyle} placeholder="@yourbrand" value={tiktok} onChange={e => setTiktok(e.target.value)} /></div>
        </div>

        {/* Save */}
        <div
          onClick={saveProfile}
          style={{ padding: "14px", borderRadius: "8px", background: saved ? "#1a1a1a" : "#fff", color: saved ? "#555" : "#0a0a0a", border: saved ? "1px solid #222" : "1px solid #fff", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Profile"}
        </div>

      </div>
    </div>
  );
}