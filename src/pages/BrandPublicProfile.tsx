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
          const { data: blockRows } = await supabase
            .from("blocks")
            .select("blocker_id, blocked_id")
            .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${profileId}),and(blocker_id.eq.${profileId},blocked_id.eq.${user.id})`);
          setBlockedByMe(!!blockRows?.some(b => b.blocker_id === user.id));
          setBlockedMe(!!blockRows?.some(b => b.blocker_id === profileId));
        }

        const { data } = await supabase
          .from("brand_profiles")
          .select("*")
          .eq("id", profileId)
          .single();

        if (data) setBrand(data);
      }, 10000, "BrandPublicProfile.loadProfile");
    } catch (err) {
      console.error("Failed to load brand profile:", err);
    } finally {
      setLoading(false);
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

  useRefetchOnVisible(loadProfile, loading);

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
      <div style={{ padding: "1.5rem 1.25rem", paddingBottom: "8rem", paddingTop: "5rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
          {bar("72px", "72px", { borderRadius: "16px", flexShrink: 0 })}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {bar("140px", "20px")}
            {bar("100px", "13px")}
          </div>
        </div>

        {/* DM Button */}
        {bar("100%", "44px", { borderRadius: "8px", marginBottom: "2rem" })}

        {/* Bio */}
        <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "10px" }}>
          {bar("100%", "13px")}
          {bar("85%", "13px")}
          {bar("60%", "13px")}
        </div>

        <div style={dividerStyle} />

        {/* Details */}
        <div style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[0, 1, 2].map(i => (
            <div key={i}>
              {bar("100px", "11px", { marginBottom: "8px" })}
              {bar("160px", "13px")}
            </div>
          ))}
          <div>
            {bar("140px", "11px", { marginBottom: "8px" })}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[70, 90, 60].map((w, i) => <div key={i}>{bar(`${w}px`, "28px", { borderRadius: "20px" })}</div>)}
            </div>
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Links */}
        <div style={sectionStyle}>
          {bar("50px", "11px", { marginBottom: "10px" })}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[0, 1].map(i => (
              <div key={i} style={{ display: "flex", gap: "8px" }}>
                {bar("70px", "13px")}
                {bar("120px", "13px")}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
  }

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
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span onClick={goBack} style={{ fontSize: "18px", color: "#555", cursor: "pointer" }}>←</span>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{blockedMe ? "User unavailable" : (brand.name || "Brand")}</span>
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
              <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>Report {brand.name || "this profile"}</p>
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

{/* Empty state */}
          {!brand.industry && !brand.target_audience && !brand.budget_range && !brand.content_types?.length && !brand.website && !brand.instagram && !brand.tiktok && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem", marginTop: "1rem" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#333", marginBottom: "1rem" }}>◈</div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px", textAlign: "center" }}>No details added yet</p>
              <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.7, textAlign: "center", maxWidth: "240px" }}>This brand hasn't filled out their profile yet. Message them to find out more.</p>
            </div>
          )}

      </div>
      )}
    </div>
  );
}