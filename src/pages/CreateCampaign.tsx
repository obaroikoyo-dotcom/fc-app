import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { NICHES } from "../lib/niches";
import { usePersistedState } from "../lib/usePersistedState";
import { useMemoryPersistedState, clearMemoryPersistedState } from "../lib/useMemoryPersistedState";
import { uploadToR2 } from "../lib/r2Upload";

export interface EditableCampaign {
  id: string;
  name: string;
  description?: string;
  budget: string | number;
  type: "gifted" | "paid";
  video_required: boolean;
  niche: string;
  deadline: string;
  objective?: string;
  deliverables?: string[];
  vibe?: string;
  dos?: string[];
  donts?: string[];
  promo_code?: string;
  landing_link?: string;
  utm_code?: string;
  is_draft?: boolean;
}

interface Props {
  onPosted: () => void;
  isEnterprise: boolean;
  onNavigateEnterprise?: () => void;
  editingCampaign?: EditableCampaign | null;
}

interface AssetFile {
  id: string;
  file: File;
}

const DELIVERABLES = [
  "TikTok Video", "IG Reel", "IG Story", "YouTube Short",
  "Static Post", "Podcast Mention", "Blog Post", "X / Twitter Post",
  "YouTube Video", "IG Carousel", "TikTok LIVE", "UGC Content Package",
  "Pinterest Pin", "LinkedIn Post",
];

const OBJECTIVES = [
  "Brand Awareness", "Product Launch", "Drive Conversions",
  "Community Growth", "App Installs", "Event Promotion", "Other",
];

const inp: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #1e1e1e",
  borderRadius: "6px",
  padding: "10px 12px",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
  boxSizing: "border-box",
};

const lbl: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#888",
  marginBottom: "5px",
  display: "block",
};

const card: React.CSSProperties = {
  background: "#0f0f0f",
  border: "1px solid #1a1a1a",
  borderRadius: "10px",
  padding: "1rem",
  marginBottom: "8px",
};

const sectionTitle = (label: string, sub: string) => (
  <div style={{ marginBottom: "1rem", paddingBottom: "10px", borderBottom: "1px solid #161616" }}>
    <p style={{ fontSize: "12px", fontWeight: 600, color: "#ccc", margin: 0, letterSpacing: "0.02em" }}>{label}</p>
    <p style={{ fontSize: "11px", color: "#777", margin: "2px 0 0 0" }}>{sub}</p>
  </div>
);

export default function CreateCampaign({ onPosted, isEnterprise, onNavigateEnterprise, editingCampaign }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Persisted (not plain useState) so a brand's in-progress new campaign
  // survives navigating away entirely - e.g. clicking "Bypass platform fees"
  // to check out Enterprise - and back, instead of the whole form silently
  // resetting on remount. Uploaded files (logos/overlays/etc.) can't be
  // serialized this way and aren't covered - that's a smaller, separate gap.
  const [name, setName] = usePersistedState("fc_create_campaign_name", "");
  const [objective, setObjective] = usePersistedState("fc_create_campaign_objective", "");
  const [objectiveOther, setObjectiveOther] = usePersistedState("fc_create_campaign_objectiveOther", "");
  const [budget, setBudget] = usePersistedState("fc_create_campaign_budget", "");
  const [campaignType, setCampaignType] = usePersistedState<"paid" | "gifted">("fc_create_campaign_type", "paid");
  const [deadline, setDeadline] = usePersistedState("fc_create_campaign_deadline", "");
  const [niche, setNiche] = usePersistedState("fc_create_campaign_niche", "");
  const [deliverables, setDeliverables] = usePersistedState<string[]>("fc_create_campaign_deliverables", []);
  const [videoRequired, setVideoRequired] = usePersistedState("fc_create_campaign_videoRequired", false);
  const [platforms] = useState<string[]>([]);
  const [vibe, setVibe] = usePersistedState("fc_create_campaign_vibe", "");
  const [dos, setDos] = usePersistedState<string[]>("fc_create_campaign_dos", [""]);
  const [donts, setDonts] = usePersistedState<string[]>("fc_create_campaign_donts", [""]);
  // Files can't go through sessionStorage (not serializable) - kept alive in
  // an in-memory module store instead, which is enough to survive a
  // React-level remount without needing to survive an actual page reload.
  const [logos, setLogos] = useMemoryPersistedState<AssetFile[]>("fc_create_campaign_logos", []);
  const [overlays, setOverlays] = useMemoryPersistedState<AssetFile[]>("fc_create_campaign_overlays", []);
  const [styleVideos, setStyleVideos] = useMemoryPersistedState<AssetFile[]>("fc_create_campaign_styleVideos", []);
  const [broll, setBroll] = useMemoryPersistedState<AssetFile[]>("fc_create_campaign_broll", []);
  const logosRef = useRef<HTMLInputElement | null>(null);
  const overlaysRef = useRef<HTMLInputElement | null>(null);
  const styleVideosRef = useRef<HTMLInputElement | null>(null);
  const brollRef = useRef<HTMLInputElement | null>(null);
  const [promoCode, setPromoCode] = usePersistedState("fc_create_campaign_promoCode", "");
  const [landingLink, setLandingLink] = usePersistedState("fc_create_campaign_landingLink", "");
  const [utmCode, setUtmCode] = usePersistedState("fc_create_campaign_utmCode", "");
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingCampaign) return;
    setName(editingCampaign.name || "");
    const knownObjective = editingCampaign.objective && OBJECTIVES.includes(editingCampaign.objective);
    setObjective(knownObjective ? editingCampaign.objective! : (editingCampaign.objective ? "Other" : ""));
    setObjectiveOther(editingCampaign.objective && !knownObjective ? editingCampaign.objective : "");
    setBudget(editingCampaign.budget ? String(editingCampaign.budget) : "");
    setCampaignType(editingCampaign.type || "paid");
    setDeadline(editingCampaign.deadline || "");
    setNiche(editingCampaign.niche || "");
    setDeliverables(editingCampaign.deliverables || []);
    setVideoRequired(!!editingCampaign.video_required);
    setVibe(editingCampaign.vibe || editingCampaign.description || "");
    setDos(editingCampaign.dos?.length ? editingCampaign.dos : [""]);
    setDonts(editingCampaign.donts?.length ? editingCampaign.donts : [""]);
    setPromoCode(editingCampaign.promo_code || "");
    setLandingLink(editingCampaign.landing_link || "");
    setUtmCode(editingCampaign.utm_code || "");
  }, [editingCampaign]);

  const numericBudget = Math.max(0, parseInt(budget, 10) || 0);
  const platformFee = isEnterprise ? 0 : numericBudget * 0.05;
  const totalCost = numericBudget + platformFee;
  const creatorPayout = isEnterprise ? numericBudget : numericBudget * 0.9;

  const toggleDeliverable = (label: string) =>
    setDeliverables(prev => prev.includes(label) ? prev.filter(d => d !== label) : [...prev, label]);

  const addDo = () => setDos(prev => [...prev, ""]);
  const updateDo = (i: number, val: string) => setDos(prev => prev.map((d, idx) => idx === i ? val : d));
  const removeDo = (i: number) => setDos(prev => prev.filter((_, idx) => idx !== i));
  const addDont = () => setDonts(prev => [...prev, ""]);
  const updateDont = (i: number, val: string) => setDonts(prev => prev.map((d, idx) => idx === i ? val : d));
  const removeDont = (i: number) => setDonts(prev => prev.filter((_, idx) => idx !== i));

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<AssetFile[]>>) => {
    const files = Array.from(e.target.files || []);
    setter(prev => [...prev, ...files.map(f => ({ id: `${Date.now()}-${Math.random()}`, file: f }))]);
    e.target.value = "";
  };

  const removeAsset = (id: string, setter: React.Dispatch<React.SetStateAction<AssetFile[]>>) =>
    setter(prev => prev.filter(a => a.id !== id));

  const uploadAssets = async (_userId: string, campaignId: string, files: AssetFile[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const asset of files) {
      try {
        const publicUrl = await uploadToR2({ purpose: "campaign-asset", file: asset.file, campaign_id: campaignId, folder });
        urls.push(publicUrl);
      } catch (err) {
        console.error(`Failed to upload ${asset.file.name}:`, err);
      }
    }
    return urls;
  };

  const scrollToTop = () => containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const postCampaign = async (asDraft = false) => {
    // Drafts are for saving incomplete progress - skip the requirements
    // that only make sense for something about to go live to creators.
    if (!asDraft) {
      if (!name.trim()) { setError("Campaign title is required."); scrollToTop(); return; }
      if (objective === "Other" && !objectiveOther.trim()) { setError("Please describe your objective."); return; }
      if (campaignType === "paid" && numericBudget <= 0) { setError("Enter a budget for paid campaigns."); return; }
    }
    setError(null);
    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You must be logged in to post a campaign."); return; }
      const finalObjective = objective === "Other" ? objectiveOther : objective;
      const fields = {
        name: name.trim() || "Untitled draft", description: vibe,
        budget: campaignType === "paid" ? numericBudget : 0,
        type: campaignType,
        niche, platforms, deadline, video_required: videoRequired,
        objective: finalObjective, deliverables, vibe,
        dos: dos.filter(d => d.trim()), donts: donts.filter(d => d.trim()),
        promo_code: promoCode, landing_link: landingLink, utm_code: utmCode,
        is_draft: asDraft,
      };
      let campaign: { id: string } | null;
      if (editingCampaign) {
        const { count } = await supabase.from("applications")
          .select("id", { count: "exact", head: true }).eq("campaign_id", editingCampaign.id);
        if (count && count > 0) {
          setError("This campaign already has applications and can no longer be edited.");
          return;
        }
        const { data, error: updateError } = await supabase.from("campaigns")
          .update(fields).eq("id", editingCampaign.id).eq("brand_id", user.id).select().single();
        if (updateError || !data) { setError("Failed to save changes. Please try again."); return; }
        campaign = data;
      } else {
        const { data, error: insertError } = await supabase.from("campaigns")
          .insert({ brand_id: user.id, ...fields, script: "" }).select().single();
        if (insertError || !data) { setError("Failed to post campaign. Please try again."); return; }
        campaign = data;
      }
      if (!campaign) { setError("Something went wrong. Please try again."); return; }
      const [logoUrls, overlayUrls, styleVideoUrls, brollUrls] = await Promise.all([
        uploadAssets(user.id, campaign.id, logos, "logos"),
        uploadAssets(user.id, campaign.id, overlays, "overlays"),
        uploadAssets(user.id, campaign.id, styleVideos, "style-videos"),
        uploadAssets(user.id, campaign.id, broll, "broll"),
      ]);
      const assetUpdates: Record<string, string[]> = {};
      if (logoUrls.length) assetUpdates.asset_logos = logoUrls;
      if (overlayUrls.length) assetUpdates.asset_overlays = overlayUrls;
      if (styleVideoUrls.length) assetUpdates.asset_style_videos = styleVideoUrls;
      if (brollUrls.length) assetUpdates.asset_broll = brollUrls;
      if (Object.keys(assetUpdates).length > 0) {
        await supabase.from("campaigns").update(assetUpdates).eq("id", campaign.id).eq("brand_id", user.id);
      }
      // Successfully saved to the real campaign row - the stored draft has
      // served its purpose, safe to drop immediately.
      ["name", "objective", "objectiveOther", "budget", "type", "deadline", "niche", "deliverables", "videoRequired", "vibe", "dos", "donts", "promoCode", "landingLink", "utmCode"]
        .forEach(k => sessionStorage.removeItem(`fc_create_campaign_${k}`));
      ["logos", "overlays", "styleVideos", "broll"].forEach(k => clearMemoryPersistedState(`fc_create_campaign_${k}`));

      setPosted(true);
      setTimeout(() => {
        setPosted(false);
        // This component stays mounted (just hidden) across tab switches
        // rather than unmounting, so clearing storage above isn't enough -
        // the in-memory state itself has to be reset too, or the next
        // "Post a Campaign" would keep showing this one's stale values
        // instead of a blank form. Deferred to here (rather than right
        // after saving) so the fields don't visibly blank out underneath
        // the "Posted ✓" confirmation before the tab switches away.
        setName("");
        setObjective("");
        setObjectiveOther("");
        setBudget("");
        setCampaignType("paid");
        setDeadline("");
        setNiche("");
        setDeliverables([]);
        setVideoRequired(false);
        setVibe("");
        setDos([""]);
        setDonts([""]);
        setPromoCode("");
        setLandingLink("");
        setUtmCode("");
        setLogos([]);
        setOverlays([]);
        setStyleVideos([]);
        setBroll([]);
        onPosted();
      }, 1500);
    } catch (e) {
      console.error(e);
      setError("Something went wrong. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const typeChip = (t: "paid" | "gifted") => (
    <div
      key={t}
      onClick={() => setCampaignType(t)}
      style={{
        flex: 1, textAlign: "center", padding: "9px 0", borderRadius: "6px", cursor: "pointer",
        fontSize: "12px", fontWeight: 500, transition: "all 0.15s",
        background: campaignType === t ? "#fff" : "transparent",
        color: campaignType === t ? "#0a0a0a" : "#444",
        border: `1px solid ${campaignType === t ? "#fff" : "#1e1e1e"}`,
      }}
    >
      {t.charAt(0).toUpperCase() + t.slice(1)}
    </div>
  );

  const deliverableChip = (label: string) => {
    const active = deliverables.includes(label);
    return (
      <div
        key={label}
        onClick={() => toggleDeliverable(label)}
        style={{
          padding: "6px 11px", borderRadius: "4px", cursor: "pointer",
          fontSize: "11px", fontWeight: 500, transition: "all 0.15s",
          border: `1px solid ${active ? "#333" : "#1a1a1a"}`,
          background: active ? "#1a1a1a" : "transparent",
          color: active ? "#fff" : "#444",
        }}
      >
        {label}
      </div>
    );
  };

  const arrayField = (
    items: string[], placeholder: string,
    onUpdate: (i: number, v: string) => void,
    onRemove: (i: number) => void,
    onAdd: () => void, addLabel: string
  ) => (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input style={inp} type="text" placeholder={placeholder} value={item} onChange={e => onUpdate(i, e.target.value)} />
            {items.length > 1 && (
              <span onClick={() => onRemove(i)} style={{ color: "#777", cursor: "pointer", fontSize: "16px", lineHeight: 1, flexShrink: 0, padding: "0 4px", transition: "color 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ff4d4d")}
                onMouseLeave={e => (e.currentTarget.style.color = "#2a2a2a")}
              >×</span>
            )}
          </div>
        ))}
      </div>
      <div
        onClick={onAdd}
        style={{ marginTop: "6px", border: "1px dashed #1a1a1a", borderRadius: "6px", padding: "7px", color: "#777", fontSize: "11px", textAlign: "center", cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.05em" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#666"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a1a1a"; e.currentTarget.style.color = "#2a2a2a"; }}
      >
        + {addLabel}
      </div>
    </div>
  );

  const dropZone = (
    label: string, sub: string,
    files: AssetFile[],
    ref: React.RefObject<HTMLInputElement | null>,
    setter: React.Dispatch<React.SetStateAction<AssetFile[]>>,
    accept: string
  ) => (
    <div style={{ flex: "1 1 calc(50% - 6px)", minWidth: 0 }}>
      <div
        onClick={() => ref.current?.click()}
        style={{ border: "1px dashed #1a1a1a", borderRadius: "6px", padding: "14px 10px", textAlign: "center", cursor: "pointer", transition: "border-color 0.15s", background: "#0a0a0a" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#333")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#1a1a1a")}
      >
        <input type="file" ref={ref} accept={accept} multiple style={{ display: "none" }} onChange={e => handleFiles(e, setter)} />
        <p style={{ fontSize: "12px", color: "#999", margin: "0 0 2px 0", fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: "10px", color: "#777", margin: 0, letterSpacing: "0.04em" }}>{sub}</p>
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
          {files.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", border: "1px solid #161616", borderRadius: "4px", padding: "4px 8px" }}>
              <span style={{ fontSize: "10px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "85%" }}>{f.file.name}</span>
              <span onClick={() => removeAsset(f.id, setter)} style={{ fontSize: "13px", color: "#777", cursor: "pointer", flexShrink: 0, marginLeft: "6px" }}>×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column" }}>

      {/* Section 1 — Mechanics */}
      <div style={card}>
        {sectionTitle("Campaign mechanics", "Core details and deliverables")}

        <div style={{ marginBottom: "12px" }}>
          <label style={lbl}>Campaign title</label>
          <input style={inp} placeholder="e.g. Summer drop launch — June 2026" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
          <div>
            <label style={lbl}>Objective</label>
            <select style={{ ...inp, cursor: "pointer" }} value={objective} onChange={e => setObjective(e.target.value)}>
              <option value="" disabled>Select</option>
              {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Collab type</label>
            <div style={{ display: "flex", gap: "6px" }}>
              {typeChip("paid")}
              {typeChip("gifted")}
            </div>
          </div>
        </div>

        {objective === "Other" && (
          <div style={{ marginBottom: "12px" }}>
            <label style={lbl}>Describe objective</label>
            <input style={inp} placeholder="Briefly describe your campaign goal..." value={objectiveOther} onChange={e => setObjectiveOther(e.target.value)} />
          </div>
        )}

        {campaignType === "paid" && (
          <div style={{ marginBottom: "12px" }}>
            <label style={lbl}>Base budget (£)</label>
            <input style={inp} type="number" placeholder="500" value={budget} onChange={e => setBudget(e.target.value)} />
            {numericBudget > 0 && (
              <div style={{ background: "#0a0a0a", border: "1px solid #161616", borderRadius: "6px", padding: "10px 12px", marginTop: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#888", marginBottom: "4px" }}>
                  <span>Base budget</span><span>£{numericBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#888", marginBottom: "4px" }}>
                  <span>Platform fee {isEnterprise ? "(0%)" : "(+5%)"}</span>
                  <span style={{ color: isEnterprise ? "#34c759" : "#444" }}>£{platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <hr style={{ border: "0", borderTop: "1px solid #161616", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                  <span>Total</span><span style={{ color: "#34c759" }}>£{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#777", marginTop: "4px" }}>
                  <span>Creator payout {isEnterprise ? "(0% cut)" : "(-10%)"}</span>
                  <span>£{creatorPayout.toLocaleString()}</span>
                </div>
                {!isEnterprise && (
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #161616", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: "#777" }}>Bypass platform fees by upgrading to{" "}</span>
                    <span
                      onClick={() => onNavigateEnterprise?.()}
                      style={{ fontSize: "11px", color: "#aaa", fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em", borderBottom: "1px solid #2a2a2a", paddingBottom: "1px", transition: "color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#666")}
                    >
                      FlipCollab Enterprise
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
          <div>
            <label style={lbl}>Niche / category</label>
            <select style={{ ...inp, cursor: "pointer" }} value={niche} onChange={e => setNiche(e.target.value)}>
              <option value="" disabled>Select</option>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Deadline</label>
            <input style={inp} type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={lbl}>Deliverables</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
            {DELIVERABLES.map(d => deliverableChip(d))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "6px", border: "1px solid #161616", background: "#0a0a0a" }}>
          <input type="checkbox" id="videoReq" checked={videoRequired} onChange={e => setVideoRequired(e.target.checked)}
            style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "#fff", margin: 0, flexShrink: 0 }} />
          <div>
            <label htmlFor="videoReq" style={{ color: "#aaa", fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "block" }}>Require video pitch</label>
            <p style={{ fontSize: "11px", color: "#777", margin: 0 }}>Creators must upload a video to apply.</p>
          </div>
        </div>
      </div>

      {/* Section 2 — Creative Brief */}
      <div style={card}>
        {sectionTitle("Creative brief", "Direction, dos and don'ts for creators")}

        <div style={{ marginBottom: "12px" }}>
          <label style={lbl}>Core vibe / objective</label>
          <textarea style={{ ...inp, minHeight: "80px", resize: "vertical" }}
            placeholder="Tone, mood, and feel you want creators to capture..."
            value={vibe} onChange={e => setVibe(e.target.value)} />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={lbl}>The do's</label>
          {arrayField(dos, "e.g. Mention the 30-day guarantee", updateDo, removeDo, addDo, "Add talking point")}
        </div>

        <div>
          <label style={lbl}>The don'ts</label>
          {arrayField(donts, "e.g. Do not compare to competitors", updateDont, removeDont, addDont, "Add restriction")}
        </div>
      </div>

      {/* Section 3 — Media Assets */}
      <div style={card}>
        {sectionTitle("Media asset kit", "Assets creators can use in their content")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {dropZone("Logos", "PNG only", logos, logosRef, setLogos, ".png")}
          {dropZone("Overlay graphics", "PNG / SVG", overlays, overlaysRef, setOverlays, ".png,.svg")}
          {dropZone("Reference videos", "MP4 / MOV", styleVideos, styleVideosRef, setStyleVideos, "video/*")}
          {dropZone("Product B-roll", "Video or image", broll, brollRef, setBroll, "video/*,image/*")}
        </div>
      </div>

      {/* Section 4 — CTA */}
      <div style={card}>
        {sectionTitle("Call to action", "Links, codes, and trackable assets")}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {([
            { label: "Promo / discount code", placeholder: "FLIP20", value: promoCode, setter: setPromoCode, type: "text" },
            { label: "Landing link", placeholder: "https://yourbrand.com/collab", value: landingLink, setter: setLandingLink, type: "url" },
            { label: "UTM / tracking code", placeholder: "utm_source=flipcollab&utm_medium=creator", value: utmCode, setter: setUtmCode, type: "text" },
          ] as const).map(field => (
            <div key={field.label}>
              <label style={lbl}>{field.label}</label>
              <input style={inp} type={field.type} placeholder={field.placeholder} value={field.value}
                onChange={e => field.setter(e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.15)", borderRadius: "6px", padding: "10px 12px", marginBottom: "8px" }}>
          <p style={{ color: "#ff4d4d", fontSize: "12px", margin: 0 }}>{error}</p>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
        <div
          onClick={!posting ? () => postCampaign(true) : undefined}
          style={{
            flex: 1, padding: "13px", borderRadius: "6px",
            background: "transparent",
            color: posting ? "#444" : "#999",
            border: "1px solid #1e1e1e",
            fontSize: "12px", fontWeight: 600, textAlign: "center",
            cursor: posting ? "default" : "pointer",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}
        >
          Save as Draft
        </div>
        <div
          onClick={!posting ? () => postCampaign(false) : undefined}
          style={{
            flex: 2, padding: "13px", borderRadius: "6px",
            background: posted ? "#0f0f0f" : posting ? "#0f0f0f" : "#fff",
            color: posted ? "#34c759" : posting ? "#444" : "#0a0a0a",
            border: posted ? "1px solid #1a1a1a" : posting ? "1px solid #1e1e1e" : "1px solid #fff",
            fontSize: "12px", fontWeight: 600, textAlign: "center",
            cursor: posting ? "default" : "pointer",
            letterSpacing: "0.1em", textTransform: "uppercase",
            transition: "all 0.2s",
          }}
        >
          {editingCampaign
            ? (posting ? "Saving..." : posted ? "Saved ✓" : "Save Changes")
            : (posting ? "Posting..." : posted ? "Posted ✓" : "Post Campaign")}
        </div>
      </div>

    </div>
  );
}
