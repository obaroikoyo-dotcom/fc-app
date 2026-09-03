import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { notifyAndPush } from "../lib/push";
import { withTimeout } from "../lib/withTimeout";
import { useRefetchOnVisible } from "../lib/useRefetchOnVisible";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { useHasLoadedOnce } from "../lib/useHasLoadedOnce";
import { censorProfanity } from "../lib/profanity";
import { uploadToR2 } from "../lib/r2Upload";
import { validateVideoFile } from "../lib/videoDuration";

interface Props {
  navigate: (p: Page) => void;
  campaignId: string;
  goBack: () => void;
}

interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  budget: string;
  type: "paid" | "gifted";
  script: string;
  video_required: boolean;
  platforms: string[];
  vibe: string;
  objective: string;
  niche: string;
  deadline: string;
  deliverables: string[];
  dos: string[];
  donts: string[];
  promo_code: string;
  landing_link: string;
  utm_code: string;
  asset_logos: string[];
  asset_overlays: string[];
  asset_style_videos: string[];
  asset_broll: string[];
  brand_profiles: { name: string; logo_url?: string; is_enterprise?: boolean } | null;
}

const UI = {
  input: { background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" } as React.CSSProperties,
  chip: (act: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: "20px", border: `1px solid ${act ? "#fff" : "#222"}`, background: act ? "#fff" : "transparent", color: act ? "#0a0a0a" : "#555", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" })
};

export default function ApplyCampaign({ navigate, campaignId, goBack }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const [message, setMessage] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myCreatorName, setMyCreatorName] = useState("A creator");
  const [blocked, setBlocked] = useState(false);

  const load = async () => {
    try {
      await withTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data } = await supabase.from("creator_profiles").select("name").eq("id", user.id).single();
          if (data?.name) setMyCreatorName(data.name);
        }
        const { data } = await supabase
          .from("campaigns")
          .select("*, brand_profiles(name, logo_url, is_enterprise)")
          .eq("id", campaignId)
          .eq("is_draft", false)
          .single();
        if (data) setCampaign(data);

        if (user && data) {
          const { data: blockRows } = await supabase
            .from("blocks")
            .select("id, blocker_id, blocked_id")
            .or(`and(blocker_id.eq.${data.brand_id},blocked_id.eq.${user.id}),and(blocker_id.eq.${user.id},blocked_id.eq.${data.brand_id})`);
          if (blockRows && blockRows.length > 0) setBlocked(true);
        }
      }, 10000, "ApplyCampaign.load");
    } catch (err) {
      console.error("Failed to load campaign:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [campaignId]);
  useRefetchOnVisible(load, loading);

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = await validateVideoFile(file);
    if (validationError) {
      setFormError(validationError);
      setVideoFile(null);
      return;
    }
    setFormError(null);
    setVideoFile(file);
  };

  const handleApply = async () => {
    if (!message || !campaign || !currentUserId) return;
    if (campaign.video_required && !videoFile) {
      setFormError("This campaign requires a video pitch.");
      return;
    }

    setFormError(null);
    setSubmitting(true);
    setUploadProgress(0);

    let uploadedVideoUrl: string | null = null;

    if (videoFile) {
      try {
        uploadedVideoUrl = await uploadToR2({ purpose: "pitch", file: videoFile, campaign_id: campaign.id });
        setUploadProgress(100);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to upload video.");
        setSubmitting(false);
        setUploadProgress(null);
        return;
      }
    }

    const { error: appError } = await supabase.from("applications").insert({
      campaign_id: campaign.id,
      creator_id: currentUserId,
      message: censorProfanity(message),
      platforms: selectedPlatforms,
      video_url: uploadedVideoUrl,
      status: "pending",
    });

    if (!appError) {
      await notifyAndPush({
        user_id: campaign.brand_id,
        type: "campaign_application",
        title: "New Application 📩",
        body: `${myCreatorName} applied to your campaign "${campaign.name}".`,
        data: { campaign_id: campaign.id }
      });
      navigate("explore");
    } else {
      setFormError("Submission failed. Please try again.");
    }

    setSubmitting(false);
    setUploadProgress(null);
  };

  if (loading && !hasLoadedOnce && !showSkeleton) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;
  }

  if (loading && !hasLoadedOnce) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100, paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
        <div style={{ width: "20px", height: "20px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
        <div style={{ width: "120px", height: "18px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
      </div>
      <div style={{ padding: "1.5rem 1.25rem", paddingTop: "calc(5rem + env(safe-area-inset-top, 0px))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "#1a1a1a", flexShrink: 0, animation: "shimmer 1.5s ease-in-out infinite" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ width: "140px", height: "20px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
            <div style={{ width: "100px", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "2rem" }}>
          <div style={{ flex: 1, height: "44px", borderRadius: "8px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
          <div style={{ flex: 1, height: "44px", borderRadius: "8px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ width: "100%", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
          <div style={{ width: "85%", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
          <div style={{ width: "90%", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );

  if (!campaign) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#999", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Campaign not found.</p>
    </div>
  );

  if (blocked) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <p style={{ color: "#999", fontSize: "13px", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.7 }}>You can't apply to this campaign.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100, paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
        <div onClick={goBack} style={{ cursor: "pointer", color: "#999", fontSize: "20px", lineHeight: 1 }}>←</div>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff" }}>Apply</span>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "8rem", paddingTop: "calc(5rem + env(safe-area-inset-top, 0px))" }}>

        {/* Campaign title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {campaign.brand_profiles?.logo_url && (
              <img src={campaign.brand_profiles.logo_url} style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", background: "#111", border: "1px solid #1a1a1a", flexShrink: 0 }} />
            )}
            <div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>{campaign.name}</p>
              <p style={{ fontSize: "12px", color: "#888" }}>{campaign.brand_profiles?.name || "Brand"}</p>
            </div>
          </div>
          {campaign.type === "paid" && (
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "block", fontSize: "9px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Net Take-home {campaign.brand_profiles?.is_enterprise ? "(0% cut)" : "(-10%)"}
              </span>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#34c759", fontFamily: "'Syne', sans-serif" }}>
                £{(parseInt(campaign.budget, 10) * (campaign.brand_profiles?.is_enterprise ? 1 : 0.90)).toLocaleString()}
              </span>
            </div>
          )}
        </div>

       {/* Brief */}
{(campaign.vibe || campaign.objective || campaign.niche || campaign.deadline) && (
  <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "10px" }}>
    <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Campaign brief</p>
    {campaign.objective && (
      <div>
        <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>Objective</p>
        <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>{campaign.objective}</p>
      </div>
    )}
    {campaign.vibe && (
      <div>
        <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>Vibe</p>
        <p style={{ fontSize: "13px", color: "#aaa", margin: 0, lineHeight: 1.6 }}>{campaign.vibe}</p>
      </div>
    )}
    <div style={{ display: "flex", gap: "10px" }}>
      {campaign.niche && (
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>Niche</p>
          <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>{campaign.niche}</p>
        </div>
      )}
      {campaign.deadline && (
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>Deadline</p>
          <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>{new Date(campaign.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
      )}
    </div>
  </div>
)}

{/* Deliverables */}
{campaign.deliverables?.length > 0 && (
  <div>
    <p style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Deliverables</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {campaign.deliverables.map(d => (
        <div key={d} style={{ padding: "5px 10px", borderRadius: "4px", border: "1px solid #1a1a1a", background: "#111", fontSize: "11px", color: "#bbb" }}>{d}</div>
      ))}
    </div>
  </div>
)}

{/* Dos and Don'ts */}
{(campaign.dos?.filter(d => d).length > 0 || campaign.donts?.filter(d => d).length > 0) && (
  <div style={{ display: "flex", gap: "10px" }}>
    {campaign.dos?.filter(d => d).length > 0 && (
      <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
        <p style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 0" }}>Do's</p>
        {campaign.dos.filter(d => d).map((d, i) => (
          <p key={i} style={{ fontSize: "12px", color: "#aaa", margin: "0 0 4px 0", lineHeight: 1.5 }}>— {d}</p>
        ))}
      </div>
    )}
    {campaign.donts?.filter(d => d).length > 0 && (
      <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
        <p style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 0" }}>Don'ts</p>
        {campaign.donts.filter(d => d).map((d, i) => (
          <p key={i} style={{ fontSize: "12px", color: "#aaa", margin: "0 0 4px 0", lineHeight: 1.5 }}>— {d}</p>
        ))}
      </div>
    )}
  </div>
)}

{/* CTA info */}
{(campaign.promo_code || campaign.landing_link || campaign.utm_code) && (
  <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
    <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Call to action</p>
    {campaign.promo_code && (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
        <span style={{ color: "#888" }}>Promo code</span>
        <span style={{ color: "#aaa", fontWeight: 600 }}>{campaign.promo_code}</span>
      </div>
    )}
    {campaign.landing_link && (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
        <span style={{ color: "#888" }}>Link</span>
        <a href={campaign.landing_link} target="_blank" rel="noreferrer" style={{ color: "#aaa", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>{campaign.landing_link}</a>
      </div>
    )}
    {campaign.utm_code && (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
        <span style={{ color: "#888" }}>UTM</span>
        <span style={{ color: "#999", fontSize: "11px", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.utm_code}</span>
      </div>
    )}
  </div>
)}

{/* Asset Kit */}
{(campaign.asset_logos?.length > 0 || campaign.asset_overlays?.length > 0 || campaign.asset_style_videos?.length > 0 || campaign.asset_broll?.length > 0) && (
  <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
    <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px 0" }}>Media asset kit</p>
    {[
      { label: "Logos", files: campaign.asset_logos, kind: "image" as const },
      { label: "Overlays", files: campaign.asset_overlays, kind: "image" as const },
      { label: "Ref videos", files: campaign.asset_style_videos, kind: "video" as const },
      { label: "B-roll", files: campaign.asset_broll, kind: "auto" as const },
    ].filter(g => g.files?.length > 0).map(group => (
      <div key={group.label} style={{ marginBottom: "10px" }}>
        <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0" }}>{group.label}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {group.files.map((url, i) => {
            const isVideo = group.kind === "video" || (group.kind === "auto" && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url));
            return isVideo ? (
              <video key={i} src={url} controls style={{ width: "150px", height: "150px", borderRadius: "8px", background: "#000", objectFit: "cover" }} />
            ) : (
              <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: "block", width: "80px", height: "80px", borderRadius: "8px", overflow: "hidden", border: "1px solid #1a1a1a", background: "#fff", flexShrink: 0 }}>
                <img src={url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </a>
            );
          })}
        </div>
      </div>
    ))}
  </div>
)}

{/* Script (legacy fallback) */}
{campaign.script && (
  <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
    <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Script</p>
    <p style={{ fontSize: "12px", color: "#bbb", lineHeight: 1.7, whiteSpace: "pre-line", margin: 0 }}>{campaign.script}</p>
  </div>
)}

        {/* Platforms */}
        {campaign.platforms?.length > 0 && (
          <div>
            <p style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Platforms you'll post on</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {campaign.platforms.map(p => (
                <div key={p} onClick={() => !submitting && togglePlatform(p)} style={UI.chip(selectedPlatforms.includes(p))}>{p}</div>
              ))}
            </div>
          </div>
        )}

        {/* Message */}
        <div>
          <p style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Message to brand</p>
          <textarea
            disabled={submitting}
            style={{ ...UI.input, minHeight: "120px", resize: "none", opacity: submitting ? 0.5 : 1 }}
            placeholder="Introduce yourself and why you're a good fit..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        {/* Video */}
        <div>
          <p style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
            Video Pitch {campaign.video_required ? <span style={{ color: "#ff3b30", fontWeight: 600 }}>* (Required)</span> : <span style={{ color: "#888" }}>(Optional)</span>}
          </p>
          <input type="file" disabled={submitting} accept="video/*" onChange={handleVideoFileChange}
            style={{ ...UI.input, background: "#111", border: "1px dashed #222", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1 }} />
          {videoFile && !submitting && (
            <p style={{ color: "#34c759", fontSize: "12px", marginTop: "6px" }}>✓ {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)</p>
          )}
          {uploadProgress !== null && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#aaa", marginBottom: "4px" }}>
                <span>Uploading...</span><span>{uploadProgress === 0 ? "Preparing..." : `${uploadProgress}%`}</span>
              </div>
              <div style={{ width: "100%", height: "4px", background: "#222", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${uploadProgress || 15}%`, height: "100%", background: "#fff", transition: "width 0.3s ease" }} />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {formError && (
          <div style={{ background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: "8px", padding: "12px" }}>
            <p style={{ color: "#ff3b30", fontSize: "12px", margin: 0, fontWeight: 500 }}>{formError}</p>
          </div>
        )}

        {/* Submit */}
        <div
          onClick={!submitting && message ? handleApply : undefined}
          style={{ padding: "14px", borderRadius: "8px", background: message && !submitting ? "#fff" : "#1a1a1a", color: message && !submitting ? "#0a0a0a" : "#333", border: message && !submitting ? "1px solid #fff" : "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: message && !submitting ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}>
          {submitting ? "Processing..." : "Submit Application"}
        </div>
      </div>
    </div>
  );
}