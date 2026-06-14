import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props {
  navigate: (p: Page) => void;
  profileId: string;
  goBack: () => void;
}

interface BrandData {
  name: string;
  bio: string;
  niche: string;
  location: string;
  website: string;
  instagram: string;
  tiktok: string;
  avatar_url?: string;
  logo_url?: string;
  company_name?: string;
  industry?: string;
  target_audience?: string;
  content_types?: string[];
  budget_range?: string;
}

export default function BrandPublicProfile({ navigate, profileId, goBack }: Props) {
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => { loadProfile(); }, [profileId]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (data) setBrand(data);
    setLoading(false);
  };

  const startDM = async () => {
    if (!currentUserId) return;

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${currentUserId},participant_2.eq.${profileId}),and(participant_1.eq.${profileId},participant_2.eq.${currentUserId})`)
      .single();

    if (!existing) {
      await supabase.from("conversations").insert({
        participant_1: currentUserId,
        participant_2: profileId,
      });
    }

    navigate("messages-creator");
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

  const dividerStyle: React.CSSProperties = { borderTop: "1px solid #1a1a1a", marginBottom: "2rem" };
  const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#333", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
    </div>
  );

  if (!brand) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#333", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Profile not found.</p>
    </div>
  );

  const avatar = brand.avatar_url || brand.logo_url;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <span onClick={goBack} style={{ fontSize: "18px", color: "#555", cursor: "pointer" }}>←</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{brand.name || "Brand"}</span>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", paddingBottom: "8rem", paddingTop: "5rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "16px", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#333", flexShrink: 0, overflow: "hidden" }}>
            {avatar ? <img src={avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>{brand.name || brand.company_name}</p>
            <p style={{ fontSize: "13px", color: "#555" }}>{brand.niche || brand.industry}{brand.location ? ` · ${brand.location}` : ""}</p>
          </div>
        </div>

        {/* DM Button */}
        <div
          onClick={startDM}
          style={{ padding: "12px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "2rem" }}
        >
          Message
        </div>

        {/* Bio */}
        {brand.bio && (
          <div style={sectionStyle}>
            <p style={{ fontSize: "13px", color: "#777", lineHeight: 1.7 }}>{brand.bio}</p>
          </div>
        )}

        <div style={dividerStyle} />

        {/* Details */}
        <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {brand.industry && (
            <div>
              <label style={labelStyle}>Industry</label>
              <p style={{ fontSize: "13px", color: "#ccc" }}>{brand.industry}</p>
            </div>
          )}
          {brand.target_audience && (
            <div>
              <label style={labelStyle}>Target Audience</label>
              <p style={{ fontSize: "13px", color: "#ccc" }}>{brand.target_audience}</p>
            </div>
          )}
          {brand.budget_range && (
            <div>
              <label style={labelStyle}>Typical Budget</label>
              <p style={{ fontSize: "13px", color: "#ccc" }}>{brand.budget_range}</p>
            </div>
          )}
          {brand.content_types && brand.content_types.length > 0 && (
            <div>
              <label style={labelStyle}>Content They Need</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {brand.content_types.map(c => (
                  <span key={c} style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #222", color: "#555", fontSize: "12px" }}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Links */}
        {(brand.website || brand.instagram || brand.tiktok) && (
          <div style={sectionStyle}>
            <label style={labelStyle}>Links</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {brand.website && (
                <a href={brand.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#444", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", width: "70px" }}>Website</span>
                  <span style={{ color: "#ccc", textDecoration: "underline" }}>{brand.website}</span>
                </a>
              )}
              {brand.instagram && (
                <div style={{ fontSize: "13px", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#444", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", width: "70px" }}>Instagram</span>
                  <span style={{ color: "#ccc" }}>{brand.instagram}</span>
                </div>
              )}
              {brand.tiktok && (
                <div style={{ fontSize: "13px", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#444", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", width: "70px" }}>TikTok</span>
                  <span style={{ color: "#ccc" }}>{brand.tiktok}</span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}