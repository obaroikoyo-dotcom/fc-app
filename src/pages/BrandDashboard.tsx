import React, { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props {
  navigate: (p: Page) => void;
  tab: "campaigns" | "post";
  setTab: (t: "campaigns" | "post") => void;
  navigateToProfile?: (id: string) => void;
}

interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  budget: string;
  type: "gifted" | "paid";
  video_required: boolean;
  niche: string;
  platforms: string[];
  deadline: string;
  created_at: string;
  script: string;
  applications: { id: string }[];
}

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter/X", "Facebook", "Pinterest"];

const formatDeadline = (dateString: string) => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
};

const formatRelativeTime = (dateString: string, now: Date) => {
  if (!dateString) return "";
  const diffMs = now.getTime() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "under 1 minute ago";
  if (diffMins === 1) return "1 minute ago";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
};

export default function BrandDashboard({ navigate, tab, setTab, navigateToProfile }: Props) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", description: "", budget: "", type: "paid" as "paid" | "gifted", niche: "", deadline: "", script: "" });
  const [videoRequired, setVideoRequired] = useState<boolean>(false);
  const [posted, setPosted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [now, setNow] = useState(new Date());

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: bp } = await supabase.from("brand_profiles").select("is_enterprise").eq("id", user.id).single();
      if (bp?.is_enterprise) setIsEnterprise(true);

      const { data } = await supabase
        .from("campaigns")
        .select(`*, applications(id)`)
        .order("created_at", { ascending: false });

      if (data) {
        const mine = data.filter(c => c.brand_id === user.id);
        const others = data.filter(c => c.brand_id !== user.id);
        setCampaigns([...mine, ...others] as unknown as Campaign[]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
    const clockInterval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(clockInterval);
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const postCampaign = async () => {
    if (!form.name || !form.description) return;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("campaigns").insert({
        brand_id: user.id,
        ...form,
        platforms: selectedPlatforms,
        video_required: videoRequired,
      });
      if (!error) await fetchCampaigns();
    }
    setForm({ name: "", description: "", budget: "", type: "paid", niche: "", deadline: "", script: "" });
    setSelectedPlatforms([]);
    setVideoRequired(false);
    setPosted(true);
    setPosting(false);
    setTimeout(() => { setPosted(false); setTab("campaigns"); }, 1500);
  };

  const deleteCampaign = async (id: string) => {
    if (!window.confirm("Delete this campaign? This cannot be undone.")) return;
    await supabase.from("campaigns").delete().eq("id", id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid #222", borderRadius: "8px",
    padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none",
    width: "100%", fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 500, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "#555", marginBottom: "6px", display: "block",
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: "20px",
    border: `1px solid ${active ? "#fff" : "#222"}`,
    background: active ? "#fff" : "transparent",
    color: active ? "#0a0a0a" : "#555",
    fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
  });

  const numericBudget = parseInt(form.budget, 10) || 0;
  const brandPlatformFee = isEnterprise ? 0 : numericBudget * 0.05;
  const totalBrandEscrowAuthorization = numericBudget + brandPlatformFee;
  const creatorCardPayoutPreview = isEnterprise ? numericBudget : numericBudget * 0.90;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap'); @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>

      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>
          {tab === "campaigns" ? "My Campaigns" : "Post Campaign"}
        </span>
        <span onClick={async () => { await supabase.auth.signOut(); navigate("role-select"); }} style={{ fontSize: "12px", color: "#555", cursor: "pointer" }}>Sign out</span>
      </div>

      <div style={{ flex: 1, padding: "1.25rem", overflowY: "auto", paddingBottom: "6rem" }}>

        {/* Campaigns Tab */}
        {tab === "campaigns" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                        <div style={{ width: "80px", height: "11px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                      </div>
                      <div style={{ width: "50px", height: "22px", borderRadius: "6px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                    </div>
                    <div style={{ width: "60%", height: "16px", borderRadius: "4px", background: "#1a1a1a", marginBottom: "8px" }} />
                    <div style={{ width: "90%", height: "11px", borderRadius: "4px", background: "#1a1a1a", marginBottom: "6px" }} />
                    <div style={{ width: "70%", height: "11px", borderRadius: "4px", background: "#1a1a1a", marginBottom: "16px" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #161616", paddingTop: "12px" }}>
                      <div style={{ width: "80px", height: "32px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                      <div style={{ width: "60px", height: "14px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div style={{ border: "1px dashed #222", borderRadius: "16px", padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>No campaigns yet</p>
                <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.7 }}>Post your first campaign and start finding creators.</p>
                <div onClick={() => setTab("post")} style={{ marginTop: "1.5rem", padding: "12px", background: "#fff", color: "#0a0a0a", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Post a Campaign
                </div>
              </div>
            ) : (
              campaigns.map(c => {
                const isOwn = c.brand_id === currentUserId;
                const brandLogo = (c as any).brand_profiles?.logo_url;
                const brandName = (c as any).brand_profiles?.name;
                const budgetVal = parseInt(c.budget, 10);
                const currentTotalCost = budgetVal + budgetVal * 0.05;
                const appCount = c.applications?.length || 0;

                return (
                  <div key={c.id} style={{ background: "#111", border: `1px solid ${isOwn ? "#222" : "#1a1a1a"}`, borderRadius: "12px", padding: "1.25rem" }}>

                    {/* Header Row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <div
                        onClick={() => isOwn ? navigate("brand-profile") : navigateToProfile && navigateToProfile(c.brand_id)}
                        style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                      >
                        <div style={{ width: "28px", height: "28px", borderRadius: "8px", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#333", flexShrink: 0 }}>
                          {brandLogo ? <img src={brandLogo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
                        </div>
                        <span style={{ fontSize: "12px", color: "#555" }}>{brandName || "Brand"}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {isOwn ? (
                          <span
                            onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }}
                            style={{ fontSize: "11px", color: "#ff4d4d", cursor: "pointer", fontWeight: 500, background: "rgba(255, 77, 77, 0.08)", padding: "4px 9px", borderRadius: "6px", border: "1px solid rgba(255, 77, 77, 0.15)" }}
                          >
                            Delete
                          </span>
                        ) : (
                          <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "4px", background: "#1a1a1a", border: "1px solid #222", color: "#666", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                            {c.type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 6px 0" }}>{c.name}</p>
                        <p style={{ fontSize: "13px", color: "#444", marginBottom: "12px", lineHeight: 1.5 }}>{c.description}</p>
                      </div>
                      {c.video_required && (
                        <span style={{ flexShrink: 0, fontSize: "10px", color: "#ff3b30", background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.15)", padding: "3px 8px", borderRadius: "4px", fontWeight: 500 }}>
                          🔒 Video Pitch Required
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "12px", color: "#555", marginBottom: "12px" }}>
                      {c.niche && <span style={{ borderRight: "1px solid #222", paddingRight: "14px" }}>{c.niche}</span>}
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.03em", color: "#333", fontWeight: 500 }}>Posted:</span>
                        <span style={{ color: "#666" }}>{formatRelativeTime(c.created_at, now)}</span>
                      </span>
                      {c.deadline && (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.03em", color: "#333", fontWeight: 500 }}>Deadline:</span>
                          <span style={{ color: "#fff", fontWeight: 500 }}>{formatDeadline(c.deadline)}</span>
                        </span>
                      )}
                    </div>

                    {c.platforms?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px", marginBottom: "12px" }}>
                        {c.platforms.map((p: string) => <span key={p} style={{ fontSize: "11px", padding: "3px 8px", border: "1px solid #222", borderRadius: "20px", color: "#444" }}>{p}</span>)}
                      </div>
                    )}

                    {isOwn && c.script && (
                      <div style={{ marginTop: "12px", marginBottom: "12px", padding: "10px", background: "#0a0a0a", borderRadius: "8px", border: "1px solid #1a1a1a" }}>
                        <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Script</p>
                        <p style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{c.script}</p>
                      </div>
                    )}

                    {/* Bottom Row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #161616", paddingTop: "12px", marginTop: "12px" }}>
                      {c.type === "paid" && budgetVal ? (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Base Budget</span>
                          <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", lineHeight: 1.1 }}>
                            £{budgetVal.toLocaleString()}
                          </span>
                          {isOwn && (
                            <span style={{ fontSize: "10px", color: "#666", marginTop: "4px", lineHeight: 1.3 }}>
                              Total: <span style={{ color: "#34c759", fontWeight: 500 }}>£{currentTotalCost.toLocaleString()}</span> (+5% fee)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Reward</span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif", lineHeight: 1.1, textTransform: "uppercase" }}>Gifted</span>
                        </div>
                      )}

                      <div style={{ fontSize: "11px", color: "#666", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                        {appCount} application{appCount !== 1 ? "s" : ""}
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Post Tab */}
        {tab === "post" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={labelStyle}>Campaign Name</label>
              <input style={inputStyle} placeholder="e.g. Summer Collection Launch" value={form.name} onChange={set("name")} />
            </div>
            <div>
              <label style={labelStyle}>Description / Deliverables Required</label>
              <textarea style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} placeholder="List the specific assets or content you need creators to make..." value={form.description} onChange={set("description")} />
            </div>
            <div>
              <label style={labelStyle}>Collab Type</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["paid", "gifted"] as const).map(t => (
                  <div key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={chipStyle(form.type === t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </div>
                ))}
              </div>
            </div>

            {form.type === "paid" && (
              <div>
                <label style={labelStyle}>Base Budget (£)</label>
                <input style={inputStyle} placeholder="e.g. 100" type="number" value={form.budget} onChange={set("budget")} />
                {numericBudget > 0 && (
                  <div style={{ background: "#111", border: "1px solid #1a1a1a", padding: "14px", borderRadius: "10px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#555", fontSize: "13px" }}>
                      <span>Base Budget:</span>
                      <span style={{ color: "#aaa" }}>£{numericBudget.toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#555", fontSize: "13px" }}>
                      <span>Platform Fee {isEnterprise ? "(Enterprise — 0%)" : "(+5%)"}:</span>
                      <span style={{ color: isEnterprise ? "#34c759" : "#aaa" }}>£{brandPlatformFee.toLocaleString()}</span>
                    </div>
                    <hr style={{ border: "0", borderTop: "1px solid #222", margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: "14px", color: "#fff" }}>
                      <span>Total Cost:</span>
                      <span style={{ color: "#34c759" }}>£{totalBrandEscrowAuthorization.toLocaleString()}</span>
                    </div>
                    <hr style={{ border: "0", borderTop: "1px dashed #1a1a1a", margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#444" }}>
                      <span>Creator Payout {isEnterprise ? "(Enterprise — 0% Cut)" : "(-10% Cut)"}:</span>
                      <span style={{ color: isEnterprise ? "#34c759" : "#888", fontWeight: 500 }}>£{creatorCardPayoutPreview.toLocaleString()}</span>
                    </div>
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #1a1a1a" }}>
                      <p style={{ fontSize: "12px", color: "#444", margin: "0 0 4px 0" }}>
                        Bypass platform fees by upgrading to{" "}
                        <span onClick={() => navigate("enterprise")} style={{ color: "#fff", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>FlipCollab Enterprise</span>.*
                      </p>
                      <p style={{ fontSize: "10px", color: "#333", margin: 0 }}>*Subject to subscription terms.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={labelStyle}>Niche / Category</label>
              <input style={inputStyle} placeholder="e.g. Beauty, Fashion, Fitness" value={form.niche} onChange={set("niche")} />
            </div>
            <div>
              <label style={labelStyle}>Platforms Needed</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PLATFORMS.map(p => <div key={p} onClick={() => togglePlatform(p)} style={chipStyle(selectedPlatforms.includes(p))}>{p}</div>)}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Deadline</label>
              <input style={inputStyle} type="date" value={form.deadline} onChange={set("deadline")} />
            </div>
            <div>
              <label style={labelStyle}>Script / Brief <span style={{ color: "#333", fontWeight: 400, fontSize: "10px", textTransform: "none", letterSpacing: 0 }}>optional</span></label>
              <textarea style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }} placeholder="Add talking points, dos and don'ts, or a full script..." value={form.script} onChange={set("script")} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0.5rem 0 1rem 0", background: "#111", padding: "14px 16px", borderRadius: "8px", border: "1px solid #222" }}>
              <input
                type="checkbox"
                id="videoRequired"
                checked={videoRequired}
                onChange={(e) => setVideoRequired(e.target.checked)}
                style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#fff", margin: 0 }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <label htmlFor="videoRequired" style={{ color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Require Video Pitch
                </label>
                <p style={{ color: "#444", fontSize: "11px", margin: 0 }}>
                  Creators must upload a video to apply for this brief.
                </p>
              </div>
            </div>

            <div
              onClick={postCampaign}
              style={{ padding: "14px", borderRadius: "8px", background: posted ? "#1a1a1a" : "#fff", color: posted ? "#555" : "#0a0a0a", border: posted ? "1px solid #222" : "1px solid #fff", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
            >
              {posting ? "Posting..." : posted ? "Posted ✓" : "Post Campaign"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}