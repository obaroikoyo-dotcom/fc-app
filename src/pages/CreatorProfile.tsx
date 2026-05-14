import { useState, useRef, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter/X", "Facebook", "Pinterest"];
const CONTENT_TYPES = ["Photos", "Reels", "UGC Videos", "Stories", "Reviews", "Unboxings", "Tutorials", "Vlogs"];
const LANGUAGES = ["English", "Spanish", "French", "Arabic", "Portuguese", "German", "Italian", "Mandarin", "Hindi", "Other"];
const AGE_RANGES = ["18-24", "25-34", "35-44", "45+"];

export default function CreatorProfile({ navigate }: Props) {
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [favourites, setFavourites] = useState<any[]>([]);
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
  const [audienceAgeRange, setAudienceAgeRange] = useState("");
  const [audienceLocation, setAudienceLocation] = useState("");
  const [rates, setRates] = useState({ post: "", story: "", reel: "", video: "", ugc: "" });
  const [collabs, setCollabs] = useState([{ brand: "", description: "" }]);
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [walletTab, setWalletTab] = useState<"balance" | "withdraw">("balance");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const picRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

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
      setAudienceAgeRange(data.audience_age_range || "");
      setAudienceLocation(data.audience_location || "");
      setRates(data.rates || { post: "", story: "", reel: "", video: "", ugc: "" });
      setCollabs(data.collabs || [{ brand: "", description: "" }]);
      setProfilePic(data.avatar_url || null);
      setAvatarUrl(data.avatar_url || null);
    }
  };

  const loadFavourites = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase
    .from("favourites")
    .select("creator_id, creator_profiles(name, niche)")
    .eq("user_id", user.id);
  if (data) setFavourites(data);
};

useEffect(() => { loadProfile(); loadFavourites(); }, []);


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

    // Save avatar_url to database immediately
    const { data: existing } = await supabase.from("creator_profiles").select("id").eq("id", userId).single();
    if (existing) {
      await supabase.from("creator_profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
    } else {
      await supabase.from("creator_profiles").insert({ id: userId, avatar_url: data.publicUrl });
    }
  }
};

  const handleMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const urls = files.map(f => URL.createObjectURL(f));
    setMediaFiles(prev => [...prev, ...urls]);
  };

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const toggleContent = (c: string) =>
    setContentTypes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const toggleLanguage = (l: string) =>
    setLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  const updateCollab = (i: number, k: string, v: string) =>
    setCollabs(prev => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c));

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);

    const profileData = {
      id: userId,
      name, bio, niche, location,
      age: age ? parseInt(age) : null,
      gender, available,
      platforms: selectedPlatforms,
      social_links: socialLinks,
      follower_counts: followerCounts,
      engagement_rates: engagementRates,
      content_types: contentTypes,
      languages,
      audience_age_range: audienceAgeRange,
      audience_location: audienceLocation,
      rates,
      collabs,
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

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: "20px",
    border: `1px solid ${active ? "#fff" : "#222"}`,
    background: active ? "#fff" : "transparent",
    color: active ? "#0a0a0a" : "#555",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };
  const dividerStyle: React.CSSProperties = { borderTop: "1px solid #1a1a1a", marginBottom: "2rem" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "6rem" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>My Profile</span>
        <span onClick={async () => { await supabase.auth.signOut(); navigate("role-select"); }} style={{ fontSize: "12px", color: "#555", cursor: "pointer" }}>Sign out</span>
      </div>

      <div style={{ padding: "1.5rem 1.25rem" }}>

        {/* Availability Toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px 16px", marginBottom: "2rem" }}>
          <div>
            <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Open to Collabs</p>
            <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>Brands can see you're available</p>
          </div>
          <div onClick={() => setAvailable(p => !p)} style={{ width: "44px", height: "24px", borderRadius: "12px", background: available ? "#fff" : "#222", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: "3px", left: available ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: available ? "#0a0a0a" : "#555", transition: "left 0.2s" }} />
          </div>
        </div>

        {/* Profile Pic */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
          <div onClick={() => picRef.current?.click()} style={{ width: "90px", height: "90px", borderRadius: "50%", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", marginBottom: "8px" }}>
            {profilePic ? <img src={profilePic} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "28px", color: "#333" }}>+</span>}
          </div>
          <span style={{ fontSize: "12px", color: "#444" }}>Tap to upload photo</span>
          <input ref={picRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePic} />
        </div>

        <div style={dividerStyle} />

        {/* Basic Info */}
        <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div><label style={labelStyle}>Full Name</label><input style={inputStyle} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label style={labelStyle}>Niche</label><input style={inputStyle} placeholder="e.g. Lifestyle, Beauty, Fitness" value={niche} onChange={e => setNiche(e.target.value)} /></div>
          <div><label style={labelStyle}>Location</label><input style={inputStyle} placeholder="e.g. London, UK" value={location} onChange={e => setLocation(e.target.value)} /></div>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Age</label><input style={inputStyle} placeholder="e.g. 22" type="number" value={age} onChange={e => setAge(e.target.value)} /></div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Gender</label>
              <select style={{ ...inputStyle, appearance: "none" }} value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
          </div>
          <div><label style={labelStyle}>Bio</label><textarea style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }} placeholder="Tell brands about yourself..." value={bio} onChange={e => setBio(e.target.value)} /></div>
        </div>

        <div style={dividerStyle} />

        {/* Platforms */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Preferred Posting Platforms</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {PLATFORMS.map(p => <div key={p} onClick={() => togglePlatform(p)} style={chipStyle(selectedPlatforms.includes(p))}>{p}</div>)}
          </div>
        </div>

        {selectedPlatforms.length > 0 && (
          <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
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

        <div style={dividerStyle} />

        {/* Content Types */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Content I Create</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {CONTENT_TYPES.map(c => <div key={c} onClick={() => toggleContent(c)} style={chipStyle(contentTypes.includes(c))}>{c}</div>)}
          </div>
        </div>

        {/* Languages */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Languages Spoken</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {LANGUAGES.map(l => <div key={l} onClick={() => toggleLanguage(l)} style={chipStyle(languages.includes(l))}>{l}</div>)}
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Audience Demographics */}
        <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={labelStyle}>Audience Demographics</label>
          <div>
            <label style={{ ...labelStyle, fontSize: "10px" }}>Audience Age Range</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {AGE_RANGES.map(a => <div key={a} onClick={() => setAudienceAgeRange(a)} style={chipStyle(audienceAgeRange === a)}>{a}</div>)}
            </div>
          </div>
          <div><label style={{ ...labelStyle, fontSize: "10px" }}>Audience Location</label><input style={inputStyle} placeholder="e.g. Mostly UK, US" value={audienceLocation} onChange={e => setAudienceLocation(e.target.value)} /></div>
        </div>

        <div style={dividerStyle} />

        {/* Rate Card */}
        <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={labelStyle}>Rate Card (£)</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}><label style={{ ...labelStyle, fontSize: "10px" }}>Post</label><input style={inputStyle} placeholder="£" type="number" value={rates.post} onChange={e => setRates(r => ({ ...r, post: e.target.value }))} /></div>
            <div style={{ flex: 1 }}><label style={{ ...labelStyle, fontSize: "10px" }}>Story</label><input style={inputStyle} placeholder="£" type="number" value={rates.story} onChange={e => setRates(r => ({ ...r, story: e.target.value }))} /></div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}><label style={{ ...labelStyle, fontSize: "10px" }}>Reel</label><input style={inputStyle} placeholder="£" type="number" value={rates.reel} onChange={e => setRates(r => ({ ...r, reel: e.target.value }))} /></div>
            <div style={{ flex: 1 }}><label style={{ ...labelStyle, fontSize: "10px" }}>Video</label><input style={inputStyle} placeholder="£" type="number" value={rates.video} onChange={e => setRates(r => ({ ...r, video: e.target.value }))} /></div>
          </div>
          <div><label style={{ ...labelStyle, fontSize: "10px" }}>UGC Only (no posting)</label><input style={inputStyle} placeholder="£" type="number" value={rates.ugc} onChange={e => setRates(r => ({ ...r, ugc: e.target.value }))} /></div>
        </div>

        <div style={dividerStyle} />

        {/* Past Collabs */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Past Collabs</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {collabs.map((c, i) => (
              <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                <input style={inputStyle} placeholder="Brand name" value={c.brand} onChange={e => updateCollab(i, "brand", e.target.value)} />
                <input style={inputStyle} placeholder="What did you create?" value={c.description} onChange={e => updateCollab(i, "description", e.target.value)} />
              </div>
            ))}
            <span onClick={() => setCollabs(prev => [...prev, { brand: "", description: "" }])} style={{ fontSize: "12px", color: "#555", cursor: "pointer", textAlign: "center", padding: "8px", border: "1px dashed #222", borderRadius: "8px" }}>+ Add collab</span>
          </div>
        </div>

        {/* Media Upload */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Content Examples</label>
          <div onClick={() => mediaRef.current?.click()} style={{ border: "1px dashed #222", borderRadius: "10px", padding: "1.5rem", textAlign: "center", cursor: "pointer", marginBottom: "10px" }}>
            <p style={{ color: "#444", fontSize: "13px" }}>Tap to upload videos or posts</p>
          </div>
          <input ref={mediaRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleMedia} />
          {mediaFiles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {mediaFiles.map((f, i) => <img key={i} src={f} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid #222" }} />)}
            </div>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Favourites */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <label style={labelStyle}>My Favourites</label>
            <span style={{ fontSize: "10px", color: "#333", letterSpacing: "0.05em" }}>Only visible to you</span>
          </div>
          {favourites.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#333", textAlign: "center", padding: "1rem", border: "1px dashed #1a1a1a", borderRadius: "10px" }}>No favourites yet — discover creators in Search</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {favourites.map((f, i) => (
                <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #222", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#333" }}>◉</div>
                    <div>
                      <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{(f.creator_profiles as any)?.name || "Creator"}</p>
                      <p style={{ color: "#444", fontSize: "11px", marginTop: "2px" }}>{(f.creator_profiles as any)?.niche || ""}</p>
                    </div>
                  </div>
                  <div
                    onClick={() => navigate("messages-creator")}
                    style={{ padding: "6px 12px", border: "1px solid #333", borderRadius: "6px", fontSize: "11px", color: "#fff", cursor: "pointer", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
                  >
                    DM
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Wallet */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Wallet</label>
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
              {(["balance", "withdraw"] as const).map(t => (
                <div key={t} onClick={() => setWalletTab(t)} style={{ flex: 1, padding: "12px", textAlign: "center", cursor: "pointer", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: walletTab === t ? "#fff" : "#444", borderBottom: walletTab === t ? "1px solid #fff" : "1px solid transparent" }}>{t}</div>
              ))}
            </div>
            {walletTab === "balance" && (
              <div style={{ padding: "1.5rem", textAlign: "center" }}>
                <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Available Balance</p>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "36px", fontWeight: 800, color: "#fff" }}>£0.00</p>
                <p style={{ fontSize: "12px", color: "#333", marginTop: "8px" }}>Payments from completed collabs appear here</p>
              </div>
            )}
            {walletTab === "withdraw" && (
              <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Withdraw to</label>
                  <select style={{ ...inputStyle, appearance: "none" }}>
                    <option value="">Select method</option>
                    <option value="paypal">PayPal</option>
                    <option value="bank">Bank Account</option>
                  </select>
                </div>
                <input style={inputStyle} placeholder="Amount (£)" type="number" />
                <div style={{ padding: "13px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>Withdraw</div>
                <p style={{ fontSize: "11px", color: "#333", textAlign: "center" }}>Withdrawals processed within 2-3 business days</p>
              </div>
            )}
          </div>
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