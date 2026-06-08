import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

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
  brand_profiles: { name: string } | null;
}

const UI = {
  input: { background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" } as React.CSSProperties,
  chip: (act: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: "20px", border: `1px solid ${act ? "#fff" : "#222"}`, background: act ? "#fff" : "transparent", color: act ? "#0a0a0a" : "#555", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" })
};

export default function ApplyCampaign({ navigate, campaignId, goBack }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myCreatorName, setMyCreatorName] = useState("A creator");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        if (data?.name) setMyCreatorName(data.name);
      }
      const { data } = await supabase.from("campaigns").select("*, brand_profiles(name)").eq("id", campaignId).single();
      if (data) setCampaign(data);
      setLoading(false);
    };
    load();
  }, [campaignId]);

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setFormError("Video must be under 50MB.");
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
        const ext = videoFile.name.split('.').pop();
        const filePath = `pitches/${currentUserId}_${campaign.id}_${Date.now()}.${ext}`;
        const { data: uploadData, error: storageError } = await supabase.storage
          .from("campaign-pitches")
          .upload(filePath, videoFile, { cacheControl: "3600", upsert: true });
        if (storageError) throw storageError;
        if (uploadData) {
          const { data: urlData } = supabase.storage.from("campaign-pitches").getPublicUrl(filePath);
          uploadedVideoUrl = urlData.publicUrl;
        }
        setUploadProgress(100);
      } catch (err: any) {
        setFormError(err.message || "Failed to upload video.");
        setSubmitting(false);
        setUploadProgress(null);
        return;
      }
    }

    const { error: appError } = await supabase.from("applications").insert({
      campaign_id: campaign.id,
      creator_id: currentUserId,
      message,
      platforms: selectedPlatforms,
      video_url: uploadedVideoUrl,
      status: "pending",
    });

    if (!appError) {
      await supabase.from("notifications").insert({
        user_id: campaign.brand_id,
        actor_id: currentUserId,
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

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#333", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
    </div>
  );

  if (!campaign) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#555", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Campaign not found.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111" }}>
        <div onClick={goBack} style={{ cursor: "pointer", color: "#555", fontSize: "20px", lineHeight: 1 }}>←</div>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff" }}>Apply</span>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "8rem" }}>

        {/* Campaign title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>{campaign.name}</p>
            <p style={{ fontSize: "12px", color: "#444" }}>{campaign.brand_profiles?.name || "Brand"}</p>
          </div>
          {campaign.type === "paid" && (
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "block", fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net Take-home</span>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#34c759", fontFamily: "'Syne', sans-serif" }}>
                £{(parseInt(campaign.budget, 10) * 0.90).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Script */}
        {campaign.script && (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
            <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Brief / Script</p>
            <p style={{ fontSize: "12px", color: "#777", lineHeight: 1.7, whiteSpace: "pre-line" }}>{campaign.script}</p>
          </div>
        )}

        {/* Platforms */}
        {campaign.platforms?.length > 0 && (
          <div>
            <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Platforms you'll post on</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {campaign.platforms.map(p => (
                <div key={p} onClick={() => !submitting && togglePlatform(p)} style={UI.chip(selectedPlatforms.includes(p))}>{p}</div>
              ))}
            </div>
          </div>
        )}

        {/* Message */}
        <div>
          <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Message to brand</p>
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
          <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
            Video Pitch {campaign.video_required ? <span style={{ color: "#ff3b30", fontWeight: 600 }}>* (Required)</span> : <span style={{ color: "#444" }}>(Optional)</span>}
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