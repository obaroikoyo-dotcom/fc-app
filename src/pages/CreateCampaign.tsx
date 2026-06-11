// src/pages/CreateCampaign.tsx
import React, { useState, useRef } from "react";
import { supabase } from "../lib/supabase";

interface Props {
  onPosted: () => void;
  isEnterprise: boolean;
}

interface AssetFile {
  id: string;
  file: File;
}

const DELIVERABLES = [
  { label: "TikTok Video", icon: "🎵" },
  { label: "IG Reel", icon: "📸" },
  { label: "IG Story", icon: "⭕" },
  { label: "YouTube Short", icon: "▶️" },
  { label: "Static Post", icon: "🖼️" },
  { label: "Podcast Mention", icon: "🎙️" },
  { label: "Blog Post", icon: "✍️" },
  { label: "X/Twitter Post", icon: "𝕏" },
];

const OBJECTIVES = [
  "Brand Awareness",
  "Product Launch",
  "Drive Conversions",
  "Community Growth",
  "App Installs",
  "Event Promotion",
  "Other",
];

const inputStyle: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid #1e1e1e",
  borderRadius: "8px",
  padding: "11px 14px",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "#444",
  marginBottom: "6px",
  display: "block",
};

const cardStyle: React.CSSProperties = {
  background: "#0f0f0f",
  border: "1px solid #1a1a1a",
  borderRadius: "12px",
  padding: "1.25rem",
  marginBottom: "1rem",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "1rem",
  paddingBottom: "0.75rem",
  borderBottom: "1px solid #1a1a1a",
};

const iconBubble = (bg: string, color: string): React.CSSProperties => ({
  width: "30px",
  height: "30px",
  borderRadius: "8px",
  background: bg,
  color,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
  flexShrink: 0,
});

export default function CreateCampaign({ onPosted, isEnterprise }: Props) {
  // Section 1 — Mechanics
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [objectiveOther, setObjectiveOther] = useState("");
  const [budget, setBudget] = useState("");
  const [campaignType, setCampaignType] = useState<"paid" | "gifted">("paid");
  const [deadline, setDeadline] = useState("");
  const [niche, setNiche] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [videoRequired, setVideoRequired] = useState(false);
  const [platforms] = useState<string[]>([]);

  // Section 2 — Creative Brief
  const [vibe, setVibe] = useState("");
  const [dos, setDos] = useState<string[]>([""]);
  const [donts, setDonts] = useState<string[]>([""]);

  // Section 3 — Assets
  const [logos, setLogos] = useState<AssetFile[]>([]);
  const [overlays, setOverlays] = useState<AssetFile[]>([]);
  const [styleVideos, setStyleVideos] = useState<AssetFile[]>([]);
  const [broll, setBroll] = useState<AssetFile[]>([]);

  const logosRef = useRef<HTMLInputElement | null>(null);
const overlaysRef = useRef<HTMLInputElement | null>(null);
const styleVideosRef = useRef<HTMLInputElement | null>(null);
const brollRef = useRef<HTMLInputElement | null>(null);

  // Section 4 — CTA
  const [promoCode, setPromoCode] = useState("");
  const [landingLink, setLandingLink] = useState("");
  const [utmCode, setUtmCode] = useState("");

  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericBudget = parseInt(budget, 10) || 0;
  const platformFee = isEnterprise ? 0 : numericBudget * 0.05;
  const totalCost = numericBudget + platformFee;
  const creatorPayout = isEnterprise ? numericBudget : numericBudget * 0.9;

  const toggleDeliverable = (label: string) =>
    setDeliverables(prev =>
      prev.includes(label) ? prev.filter(d => d !== label) : [...prev, label]
    );

  const addDo = () => setDos(prev => [...prev, ""]);
  const updateDo = (i: number, val: string) => setDos(prev => prev.map((d, idx) => idx === i ? val : d));
  const removeDo = (i: number) => setDos(prev => prev.filter((_, idx) => idx !== i));

  const addDont = () => setDonts(prev => [...prev, ""]);
  const updateDont = (i: number, val: string) => setDonts(prev => prev.map((d, idx) => idx === i ? val : d));
  const removeDont = (i: number) => setDonts(prev => prev.filter((_, idx) => idx !== i));

  const handleFiles = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<AssetFile[]>>
  ) => {
    const files = Array.from(e.target.files || []);
    setter(prev => [
      ...prev,
      ...files.map(f => ({ id: `${Date.now()}-${Math.random()}`, file: f })),
    ]);
    e.target.value = "";
  };

  const removeAsset = (id: string, setter: React.Dispatch<React.SetStateAction<AssetFile[]>>) =>
    setter(prev => prev.filter(a => a.id !== id));

  const uploadAssets = async (
    userId: string,
    campaignId: string,
    files: AssetFile[],
    folder: string
  ): Promise<string[]> => {
    const urls: string[] = [];
    for (const asset of files) {
      const ext = asset.file.name.split(".").pop();
      const path = `campaign-assets/${userId}/${campaignId}/${folder}/${Date.now()}-${Math.random()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("campaign-assets")
        .upload(path, asset.file, { upsert: true });
      if (!uploadError) {
        const { data } = supabase.storage.from("campaign-assets").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const postCampaign = async () => {
    if (!name.trim()) { setError("Campaign title is required."); return; }
    setError(null);
    setPosting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }

    // Insert campaign first to get ID
    const finalObjective = objective === "Other" ? objectiveOther : objective;
    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        brand_id: user.id,
        name,
        description: vibe, // keeps backward compat with existing description col
        budget,
        type: campaignType,
        niche,
        platforms,
        deadline,
        video_required: videoRequired,
        // New structured fields
        objective: finalObjective,
        deliverables,
        vibe,
        dos: dos.filter(d => d.trim()),
        donts: donts.filter(d => d.trim()),
        promo_code: promoCode,
        landing_link: landingLink,
        utm_code: utmCode,
        script: "", // legacy field, left blank — brief is now in vibe/dos/donts
      })
      .select()
      .single();

    if (insertError || !campaign) {
      setError("Failed to post campaign. Please try again.");
      setPosting(false);
      return;
    }

    // Upload assets in parallel
    const [logoUrls, overlayUrls, styleVideoUrls, brollUrls] = await Promise.all([
      uploadAssets(user.id, campaign.id, logos, "logos"),
      uploadAssets(user.id, campaign.id, overlays, "overlays"),
      uploadAssets(user.id, campaign.id, styleVideos, "style-videos"),
      uploadAssets(user.id, campaign.id, broll, "broll"),
    ]);

    // Update with asset URLs
    if (logoUrls.length || overlayUrls.length || styleVideoUrls.length || brollUrls.length) {
      await supabase.from("campaigns").update({
        asset_logos: logoUrls,
        asset_overlays: overlayUrls,
        asset_style_videos: styleVideoUrls,
        asset_broll: brollUrls,
      }).eq("id", campaign.id);
    }

    setPosted(true);
    setPosting(false);
    setTimeout(() => {
      setPosted(false);
      onPosted();
    }, 1500);
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 12px",
    borderRadius: "20px",
    border: `1px solid ${active ? "#5b5fc7" : "#1e1e1e"}`,
    background: active ? "rgba(91,95,199,0.15)" : "transparent",
    color: active ? "#818cf8" : "#555",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  });

  const dropZone = (
  label: string,
  sub: string,
  icon: string,
  files: AssetFile[],
  ref: React.RefObject<HTMLInputElement | null>,
    setter: React.Dispatch<React.SetStateAction<AssetFile[]>>,
    accept: string
  ) => (
    <div style={{ flex: 1, minWidth: "calc(50% - 6px)" }}>
      <div
        onClick={() => ref.current?.click()}
        style={{
          border: "1px dashed #1e1e1e",
          borderRadius: "10px",
          padding: "1.25rem 1rem",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.15s",
          background: "#0a0a0a",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#5b5fc7")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e1e1e")}
      >
        <input
          type="file"
          ref={ref}
          accept={accept}
          multiple
          style={{ display: "none" }}
          onChange={e => handleFiles(e, setter)}
        />
        <div style={{ fontSize: "22px", marginBottom: "6px" }}>{icon}</div>
        <p style={{ fontSize: "12px", color: "#555", marginBottom: "2px" }}>{label}</p>
        <p style={{ fontSize: "10px", color: "#333" }}>{sub}</p>
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {files.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "6px", padding: "5px 10px" }}>
              <span style={{ fontSize: "11px", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "85%" }}>{f.file.name}</span>
              <span onClick={() => removeAsset(f.id, setter)} style={{ fontSize: "14px", color: "#333", cursor: "pointer", flexShrink: 0, marginLeft: "6px" }}>×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const arrayField = (
    items: string[],
    placeholder: string,
    onUpdate: (i: number, v: string) => void,
    onRemove: (i: number) => void,
    onAdd: () => void,
    addLabel: string
  ) => (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder={placeholder}
              value={item}
              onChange={e => onUpdate(i, e.target.value)}
            />
            {items.length > 1 && (
              <span
                onClick={() => onRemove(i)}
                style={{ color: "#333", cursor: "pointer", fontSize: "18px", lineHeight: 1, flexShrink: 0, padding: "0 4px" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ff4d4d")}
                onMouseLeave={e => (e.currentTarget.style.color = "#333")}
              >×</span>
            )}
          </div>
        ))}
      </div>
      <div
        onClick={onAdd}
        style={{ marginTop: "8px", border: "1px dashed #1a1a1a", borderRadius: "8px", padding: "8px", color: "#333", fontSize: "12px", textAlign: "center", cursor: "pointer", transition: "all 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#5b5fc7"; e.currentTarget.style.color = "#818cf8"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a1a1a"; e.currentTarget.style.color = "#333"; }}
      >
        + {addLabel}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

      {/* ── SECTION 1: Campaign Mechanics ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={iconBubble("rgba(79,70,229,0.15)", "#818cf8")}>📢</div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Campaign mechanics</p>
            <p style={{ fontSize: "11px", color: "#444", margin: 0 }}>Core details and deliverables</p>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Campaign title</label>
          <input style={inputStyle} placeholder="e.g. Summer drop launch — June 2026" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Campaign objective</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={objective}
              onChange={e => setObjective(e.target.value)}
            >
              <option value="" disabled>Select objective</option>
              {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Collab type</label>
            <div style={{ display: "flex", gap: "6px", marginTop: "1px" }}>
              {(["paid", "gifted"] as const).map(t => (
                <div key={t} onClick={() => setCampaignType(t)} style={{ ...chipStyle(campaignType === t), padding: "10px 14px", borderRadius: "8px", flex: 1, justifyContent: "center" }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {objective === "Other" && (
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Describe objective</label>
            <input style={inputStyle} placeholder="Briefly describe your campaign goal..." value={objectiveOther} onChange={e => setObjectiveOther(e.target.value)} />
          </div>
        )}

        {campaignType === "paid" && (
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Base budget (£)</label>
            <input style={inputStyle} type="number" placeholder="e.g. 500" value={budget} onChange={e => setBudget(e.target.value)} />
            {numericBudget > 0 && (
              <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "12px 14px", marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#555", marginBottom: "5px" }}>
                  <span>Base budget</span><span style={{ color: "#888" }}>£{numericBudget.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#555", marginBottom: "5px" }}>
                  <span>Platform fee {isEnterprise ? "(Enterprise — 0%)" : "(+5%)"}</span>
                  <span style={{ color: isEnterprise ? "#34c759" : "#888" }}>£{platformFee.toLocaleString()}</span>
                </div>
                <hr style={{ border: "0", borderTop: "1px solid #1e1e1e", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                  <span>Total cost</span><span style={{ color: "#34c759" }}>£{totalCost.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#444", marginTop: "5px" }}>
                  <span>Creator payout {isEnterprise ? "(0% cut)" : "(-10%)"}</span>
                  <span>£{creatorPayout.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Niche / category</label>
            <input style={inputStyle} placeholder="e.g. Beauty, Fitness" value={niche} onChange={e => setNiche(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Deadline</label>
            <input style={inputStyle} type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Required deliverables</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
            {DELIVERABLES.map(d => (
              <div key={d.label} onClick={() => toggleDeliverable(d.label)} style={chipStyle(deliverables.includes(d.label))}>
                <span>{d.icon}</span>{d.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#0a0a0a", padding: "12px 14px", borderRadius: "8px", border: "1px solid #1a1a1a" }}>
          <input
            type="checkbox"
            id="videoReq"
            checked={videoRequired}
            onChange={e => setVideoRequired(e.target.checked)}
            style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#818cf8", margin: 0 }}
          />
          <div>
            <label htmlFor="videoReq" style={{ color: "#ccc", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>Require video pitch</label>
            <p style={{ fontSize: "11px", color: "#444", margin: 0 }}>Creators must upload a video to apply.</p>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Creative Brief ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={iconBubble("rgba(124,58,237,0.15)", "#a78bfa")}>💡</div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Creative brief</p>
            <p style={{ fontSize: "11px", color: "#444", margin: 0 }}>Direction, dos and don'ts for creators</p>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Core vibe / objective</label>
          <textarea
            style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
            placeholder="Describe the tone, mood, and feel you want creators to capture..."
            value={vibe}
            onChange={e => setVibe(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Key talking points — the do's</label>
          {arrayField(dos, "e.g. Mention the 30-day guarantee", updateDo, removeDo, addDo, "Add talking point")}
        </div>

        <div>
          <label style={labelStyle}>Campaign restrictions — the don'ts</label>
          {arrayField(donts, "e.g. Do not compare to competitors", updateDont, removeDont, addDont, "Add restriction")}
        </div>
      </div>

      {/* ── SECTION 3: Media Asset Kit ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={iconBubble("rgba(14,165,233,0.12)", "#60a5fa")}>📁</div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Media asset kit</p>
            <p style={{ fontSize: "11px", color: "#444", margin: 0 }}>Assets creators can use in their content</p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {dropZone("Transparent logos", "PNG only", "🏷️", logos, logosRef, setLogos, ".png")}
          {dropZone("Overlay graphics", "PNG / SVG", "🎨", overlays, overlaysRef, setOverlays, ".png,.svg")}
          {dropZone("Reference videos", "MP4 / MOV", "🎬", styleVideos, styleVideosRef, setStyleVideos, "video/*")}
          {dropZone("Product B-roll", "Video or image", "📦", broll, brollRef, setBroll, "video/*,image/*")}
        </div>
      </div>

      {/* ── SECTION 4: CTA ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={iconBubble("rgba(16,185,129,0.12)", "#34d399")}>🎯</div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Call to action</p>
            <p style={{ fontSize: "11px", color: "#444", margin: 0 }}>Links, codes, and trackable assets</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            { label: "Promo / discount code", placeholder: "e.g. FLIP20, SUMMER10", value: promoCode, setter: setPromoCode, icon: "🏷️" },
            { label: "Custom landing link", placeholder: "https://yourbrand.com/collab", value: landingLink, setter: setLandingLink, icon: "🔗" },
            { label: "UTM / tracking code", placeholder: "utm_source=flipcollab&utm_medium=creator", value: utmCode, setter: setUtmCode, icon: "📊" },
          ].map(field => (
            <div key={field.label} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "10px 12px" }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>{field.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ ...labelStyle, marginBottom: "4px" }}>{field.label}</p>
                <input
                  style={{ ...inputStyle, background: "#0f0f0f", padding: "7px 10px", fontSize: "12px" }}
                  type={field.label.includes("link") ? "url" : "text"}
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={e => field.setter(e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: "8px", padding: "12px 14px", marginBottom: "1rem" }}>
          <p style={{ color: "#ff4d4d", fontSize: "12px", margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Submit */}
      <div
        onClick={!posting ? postCampaign : undefined}
        style={{
          padding: "14px",
          borderRadius: "8px",
          background: posted ? "#0f0f0f" : posting ? "#0f0f0f" : "#fff",
          color: posted ? "#34c759" : posting ? "#555" : "#0a0a0a",
          border: posted ? "1px solid #1a1a1a" : posting ? "1px solid #1e1e1e" : "1px solid #fff",
          fontSize: "13px",
          fontWeight: 600,
          textAlign: "center",
          cursor: posting ? "default" : "pointer",
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          transition: "all 0.2s",
          marginBottom: "1rem",
        }}
      >
        {posting ? "Posting..." : posted ? "Posted ✓" : "Post Campaign"}
      </div>
    </div>
  );
}