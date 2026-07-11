import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";
import { useRefetchOnVisible } from "../lib/useRefetchOnVisible";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { useHasLoadedOnce } from "../lib/useHasLoadedOnce";

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
  const showSkeleton = useDelayedLoading(loading);
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => { loadProfile(); }, [profileId]);

  useEffect(() => {
    setReportOpen(false);
    setReportReason("");
    setReportDetail("");
    setReportSubmitted(false);
  }, [profileId]);

 const loadProfile = async () => {
    try {
      await withTimeout(async () => {
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

          const { data: blockRows } = await supabase
            .from("blocks")
            .select("blocker_id, blocked_id")
            .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${profileId}),and(blocker_id.eq.${profileId},blocked_id.eq.${user.id})`);
          setBlockedByMe(!!blockRows?.some(b => b.blocker_id === user.id));
          setBlockedMe(!!blockRows?.some(b => b.blocker_id === profileId));
        }

        // Try creator_profiles first
        const { data: creatorData } = await supabase
          .from("creator_profiles")
          .select("*")
          .eq("id", profileId)
          .single();

        if (creatorData) {
          setCreator(creatorData);
          return;
        }

        // Fall back to brand_profiles
        const { data: brandData } = await supabase
          .from("brand_profiles")
          .select("*")
          .eq("id", profileId)
          .single();

        if (brandData) setCreator(brandData);
      }, 10000, "PublicProfile.loadProfile");
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useRefetchOnVisible(loadProfile, loading);

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

  const handleSubmitReport = async () => {
    if (!currentUserId || !reportReason) return;
    setReportSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: currentUserId,
      reported_user_id: profileId,
      reason: reportDetail ? `${reportReason}: ${reportDetail}` : reportReason,
    });
    setReportSubmitting(false);
    if (!error) {
      setReportSubmitted(true);
      setReportReason("");
      setReportDetail("");
    }
  };

  const handleBlock = async () => {
    if (!currentUserId) return;
    setBlockLoading(true);
    const { error } = await supabase.from("blocks").insert({
      blocker_id: currentUserId,
      blocked_id: profileId,
    });
    if (!error) setBlockedByMe(true);
    setBlockLoading(false);
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

  if (loading && !hasLoadedOnce && !showSkeleton) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;
  }

  if (loading && !hasLoadedOnce) {
    const pulse = "pulse 1.5s ease-in-out infinite";
    const bar = (w: string, h: string, extra: React.CSSProperties = {}) => (
      <div style={{ width: w, height: h, borderRadius: "4px", background: "#1a1a1a", animation: pulse, ...extra }} />
    );
    return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        {bar("20px", "20px")}
        {bar("120px", "18px")}
      </div>
      <div style={{ padding: "2.25rem 1.25rem 8rem", paddingTop: "6rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
            {bar("72px", "72px", { borderRadius: "50%", flexShrink: 0 })}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {bar("140px", "20px")}
              {bar("100px", "13px")}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "2rem" }}>
            {bar("100%", "44px", { flex: 1, borderRadius: "8px" })}
            {bar("100%", "44px", { flex: 1, borderRadius: "8px" })}
          </div>

          {/* Bio */}
          <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "10px" }}>
            {bar("100%", "13px")}
            {bar("85%", "13px")}
            {bar("60%", "13px")}
          </div>

          <div style={dividerStyle} />

          {/* Platforms */}
          <div style={sectionStyle}>
            {bar("90px", "11px", { marginBottom: "10px" })}
            {[0, 1].map(i => (
              <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "10px" }}>
                {bar("100px", "14px", { marginBottom: "10px" })}
                <div style={{ display: "flex", gap: "1rem" }}>
                  {bar("90px", "12px")}
                  {bar("90px", "12px")}
                </div>
              </div>
            ))}
          </div>

          {/* Content Types */}
          <div style={sectionStyle}>
            {bar("140px", "11px", { marginBottom: "10px" })}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[70, 90, 60].map((w, i) => <div key={i}>{bar(`${w}px`, "28px", { borderRadius: "20px" })}</div>)}
            </div>
          </div>

          <div style={dividerStyle} />

          {/* Audience */}
          <div style={sectionStyle}>
            {bar("70px", "11px", { marginBottom: "10px" })}
            <div style={{ display: "flex", gap: "1rem" }}>
              {bar("60px", "13px")}
              {bar("100px", "13px")}
            </div>
          </div>

          {/* Rate Card */}
          <div style={sectionStyle}>
            {bar("80px", "11px", { marginBottom: "10px" })}
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  {bar("50px", "13px")}
                  {bar("40px", "13px")}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
  }

  if (!creator) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#333", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Profile not found.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span onClick={goBack} style={{ fontSize: "18px", color: "#555", cursor: "pointer" }}>←</span>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{blockedMe ? "User unavailable" : (creator.name || "Creator")}</span>
        </div>
        {currentUserId && currentUserId !== profileId && !blockedByMe && (
          <span
            onClick={() => { setReportOpen(o => !o); setReportSubmitted(false); }}
            style={{ fontSize: "11px", color: "#666", cursor: "pointer", flexShrink: 0, padding: "4px 9px", borderRadius: "6px", border: "1px solid #222" }}
          >
            ⚑
          </span>
        )}
      </div>

      {(blockedByMe || blockedMe) ? (
        <div style={{ padding: "2rem", paddingTop: "6rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>
            {blockedByMe ? "You've blocked this profile" : "User unavailable"}
          </p>
          <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7, maxWidth: "300px" }}>
            {blockedByMe
              ? "You can't see their content or message them. Unblock from Settings → Reported & Blocked to restore this."
              : "This profile isn't available."}
          </p>
        </div>
      ) : reportOpen && (
        <div style={{ position: "fixed", top: "57px", left: 0, right: 0, padding: "1rem 1.25rem", borderBottom: "1px solid #111", background: "#0d0d0d", zIndex: 99 }}>
          {reportSubmitted ? (
            <p style={{ fontSize: "13px", color: "#34c759" }}>Report submitted. Thanks — we'll review it.</p>
          ) : (
            <>
              <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Report {creator.name || "this profile"}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                {["Inappropriate content", "Offensive language", "Spam or scam", "Other"].map(r => (
                  <span
                    key={r}
                    onClick={() => setReportReason(r)}
                    style={{ padding: "7px 12px", borderRadius: "20px", border: `1px solid ${reportReason === r ? "#fff" : "#222"}`, background: reportReason === r ? "#fff" : "transparent", color: reportReason === r ? "#0a0a0a" : "#555", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}
                  >
                    {r}
                  </span>
                ))}
              </div>
              <textarea
                value={reportDetail}
                onChange={e => setReportDetail(e.target.value)}
                placeholder="Any extra detail (optional)"
                rows={2}
                style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "10px", color: "#fff", fontSize: "13px", outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: "10px" }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <div
                  onClick={() => !reportSubmitting && reportReason && handleSubmitReport()}
                  style={{ flex: 1, padding: "11px", borderRadius: "8px", background: reportReason ? "#fff" : "#1a1a1a", color: reportReason ? "#0a0a0a" : "#555", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: reportReason ? "pointer" : "default", letterSpacing: "0.05em", textTransform: "uppercase" }}
                >
                  {reportSubmitting ? "Submitting..." : "Submit Report"}
                </div>
                <div
                  onClick={() => !blockLoading && handleBlock()}
                  style={{ flex: 1, padding: "11px", borderRadius: "8px", border: "1px solid rgba(255,77,77,0.25)", color: "#ff4d4d", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}
                >
                  {blockLoading ? "..." : "Block"}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!blockedByMe && !blockedMe && (
      <div style={{ padding: "2.25rem 1.25rem 8rem", paddingTop: "6rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
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

          {/* Empty state */}
          {!creator.platforms?.length && !creator.content_types?.length && !creator.languages?.length && !creator.audience_age_range && !creator.audience_location && !creator.rates?.post && !creator.rates?.reel && !creator.rates?.story && !creator.rates?.video && !creator.rates?.ugc && !creator.collabs?.filter(c => c.brand).length && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem", marginTop: "1rem" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#333", marginBottom: "1rem" }}>◉</div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px", textAlign: "center" }}>No content yet</p>
              <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.7, textAlign: "center", maxWidth: "240px" }}>This brand hasn't filled out their profile yet. Message them to find out more.</p>
            </div>
          )}

        </div>
      </div>
      )}
    </div>
  );
}