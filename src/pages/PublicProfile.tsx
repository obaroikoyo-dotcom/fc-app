import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props {
  navigate: (p: Page) => void;
  profileId: string;
  goBack: () => void;
  navigateToMessages: (p: "messages-creator" | "messages-brand", convoId: string) => void;
}

interface CreatorData {
  name: string;
  bio: string;
  avatar_url?: string;
  niche: string;
  location: string;
  age: string;
  gender: string;
  available: boolean;
  platforms: string[];
  social_links: Record<string, string>;
  follower_counts: Record<string, string>;
  engagement_rates: Record<string, string>;
  content_types: string[];
  languages: string[];
  audience_age_range: string;
  audience_location: string;
  rates: { post: string; story: string; reel: string; video: string; ugc: string };
  collabs: { brand: string; description: string }[];
}

export default function PublicProfile({ profileId, goBack, navigateToMessages }: Props) {
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [favourited, setFavourited] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => { loadProfile(); }, [profileId]);

 const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: fav } = await supabase
        .from("favourites")
        .select("id")
        .eq("user_id", user.id)
        .eq("creator_id", profileId)
        .single();
      setFavourited(!!fav);
    }

    // Try creator_profiles first
    const { data: creatorData } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (creatorData) {
      setCreator(creatorData);
      setLoading(false);
      return;
    }

    // Fall back to brand_profiles
    const { data: brandData } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (brandData) setCreator(brandData);
    setLoading(false);
  };

const startDM = async () => {
  if (!currentUserId) return;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(`and(participant_1.eq.${currentUserId},participant_2.eq.${profileId}),and(participant_1.eq.${profileId},participant_2.eq.${currentUserId})`)
    .single();
  let convoId: string;
  if (existing) {
    convoId = existing.id;
  } else {
    const { data: newConvo } = await supabase
      .from("conversations")
      .insert({ participant_1: currentUserId, participant_2: profileId })
      .select()
      .single();
    convoId = newConvo!.id;
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", currentUserId).single();
  navigateToMessages(profile?.role === "brand" ? "messages-brand" : "messages-creator", convoId);
};
  const toggleFavourite = async () => {
    if (!currentUserId) return;
    if (favourited) {
      await supabase.from("favourites")
        .delete()
        .eq("user_id", currentUserId)
        .eq("creator_id", profileId);
      setFavourited(false);
    } else {
      await supabase.from("favourites")
        .insert({ user_id: currentUserId, creator_id: profileId });
      setFavourited(true);
    }
  };

  const chipStyle: React.CSSProperties = {
    padding: "7px 14px",
    borderRadius: "20px",
    border: "1px solid #222",
    background: "transparent",
    color: "#555",
    fontSize: "12px",
    fontWeight: 500,
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

  const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };
  const dividerStyle: React.CSSProperties = { borderTop: "1px solid #1a1a1a", marginBottom: "2rem" };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#333", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
    </div>
  );

  if (!creator) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#333", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Profile not found.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <span onClick={goBack} style={{ fontSize: "18px", color: "#555", cursor: "pointer" }}>←</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{creator.name || "Creator"}</span>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", paddingBottom: "8rem", paddingTop: "5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
           <div style={{ width: "72px", height: "72px", borderRadius: "50%", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#333", flexShrink: 0, overflow: "hidden" }}>
  {creator.avatar_url
    ? <img src={creator.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    : "◉"}
</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{creator.name}</p>
                {creator.available && (
                  <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: "1px solid #fff", color: "#fff" }}>Open to collabs</span>
                )}
              </div>
              <p style={{ fontSize: "13px", color: "#555" }}>{creator.niche}{creator.location ? ` · ${creator.location}` : ""}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "2rem" }}>
            <div
              onClick={startDM}
              style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              Message
            </div>
            <div
              onClick={toggleFavourite}
              style={{ flex: 1, padding: "12px", borderRadius: "8px", background: favourited ? "#1a1a1a" : "transparent", color: favourited ? "#555" : "#fff", border: favourited ? "1px solid #222" : "1px solid #fff", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
            >
              {favourited ? "Favourited ✓" : "Favourite"}
            </div>
          </div>

          {/* Bio */}
          {creator.bio && (
            <div style={sectionStyle}>
              <p style={{ fontSize: "13px", color: "#777", lineHeight: 1.7 }}>{creator.bio}</p>
            </div>
          )}

          <div style={dividerStyle} />

          {/* Platforms */}
          {creator.platforms?.length > 0 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Platforms</label>
              {creator.platforms.map(p => (
                <div key={p} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "10px" }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>{p}</p>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "12px", color: "#555" }}>
                    {creator.follower_counts?.[p] && <span>{Number(creator.follower_counts[p]).toLocaleString()} followers</span>}
                    {creator.engagement_rates?.[p] && <span>{creator.engagement_rates[p]}% engagement</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Content Types */}
          {creator.content_types?.length > 0 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Content I Create</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {creator.content_types.map(c => <div key={c} style={chipStyle}>{c}</div>)}
              </div>
            </div>
          )}

          {/* Languages */}
          {creator.languages?.length > 0 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Languages</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {creator.languages.map(l => <div key={l} style={chipStyle}>{l}</div>)}
              </div>
            </div>
          )}

          <div style={dividerStyle} />

          {/* Audience */}
          {(creator.audience_age_range || creator.audience_location) && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Audience</label>
              <div style={{ display: "flex", gap: "1rem", fontSize: "13px", color: "#555" }}>
                {creator.audience_age_range && <span>Age {creator.audience_age_range}</span>}
                {creator.audience_location && <span>{creator.audience_location}</span>}
              </div>
            </div>
          )}

          {/* Rates */}
          {creator.rates && Object.values(creator.rates).some(v => v) && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Rate Card</label>
              <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                {creator.rates.post && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>Post</span><span style={{ color: "#fff" }}>£{creator.rates.post}</span></div>}
                {creator.rates.story && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>Story</span><span style={{ color: "#fff" }}>£{creator.rates.story}</span></div>}
                {creator.rates.reel && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>Reel</span><span style={{ color: "#fff" }}>£{creator.rates.reel}</span></div>}
                {creator.rates.video && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>Video</span><span style={{ color: "#fff" }}>£{creator.rates.video}</span></div>}
                {creator.rates.ugc && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#555" }}>UGC Only</span><span style={{ color: "#fff" }}>£{creator.rates.ugc}</span></div>}
              </div>
            </div>
          )}

          <div style={dividerStyle} />

          {/* Past Collabs */}
          {creator.collabs?.filter(c => c.brand).length > 0 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Past Collabs</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {creator.collabs.filter(c => c.brand).map((c, i) => (
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
    </div>
  );
}