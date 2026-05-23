import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; navigateToProfile?: (id: string) => void; }

interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  budget: string;
  type: "paid" | "gifted";
  niche: string;
  platforms: string[];
  deadline: string;
  created_at: string;
  script: string;
  applications: number;
  brand_profiles: {
    name: string;
    niche: string;
    avatar_url?: string;
  } | null;
}

const UI = {
  input: { background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "inherit" },
  dropdown: { background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 12px", color: "#fff", fontSize: "13px", flex: 1, outline: "none", fontFamily: "inherit", minWidth: "100px" },
  chip: (act: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: "20px", border: `1px solid ${act ? "#fff" : "#222"}`, background: act ? "#fff" : "transparent", color: act ? "#0a0a0a" : "#555", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" })
};

// Safely formats deadlines to "DD Mmm YYYY" globally without timezone shifting
const formatDeadline = (dateString: string) => {
  if (!dateString) return "";
  
  // Splits the YYYY-MM-DD string directly to bypass browser timezone adjustments
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = parseInt(month, 10) - 1;

  return `${parseInt(day, 10)} ${months[monthIndex]} ${year}`;
};

// Dynamic relative time formatter
const formatRelativeTime = (dateString: string, now: Date) => {
  if (!dateString) return "";
  const postedDate = new Date(dateString);
  const diffMs = now.getTime() - postedDate.getTime();
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

export default function Explore({ navigate, navigateToProfile }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [selectedNiche, setSelectedNiche] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [minBudget, setMinBudget] = useState("");
  
  // State to force re-render relative times every minute
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchCampaigns();
    fetchMyProfile();

    // Setup an interval to update the absolute relative reference anchor point every 60s
    const clockInterval = setInterval(() => {
      setNow(new Date());
    }, 60000);

    const channel = supabase
  .channel("campaigns-feed")
  .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, (payload) => {
    if (payload.eventType === "INSERT") {
      setCampaigns(prev => [payload.new as Campaign, ...prev]);
    } else if (payload.eventType === "DELETE") {
      // Instantly drop it from the creator's feed when a brand deletes it
      setCampaigns(prev => prev.filter(c => c.id !== payload.old.id));
      // Instantly pull it from their bookmarks array if it was saved
      setBookmarked(prev => prev.filter(id => id !== payload.old.id));
    }
  })
  .subscribe();

    return () => { 
      clearInterval(clockInterval);
      supabase.removeChannel(channel); 
    };
  }, []);

  const fetchMyProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data } = await supabase.from("creator_profiles").select("avatar_url").eq("id", user.id).single();
    if (data?.avatar_url) setMyAvatar(data.avatar_url);

    const { data: favs } = await supabase.from("campaign_favourites").select("campaign_id").eq("user_id", user.id);
    if (favs) setBookmarked(favs.map((f: any) => f.campaign_id));

    const { data: existingApps } = await supabase.from("applications").select("campaign_id").eq("creator_id", user.id);
    if (existingApps) setApplied(existingApps.map((a: any) => a.campaign_id));
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select(`*, brand_profiles(name, niche, avatar_url), applications(count)`)
      .order("created_at", { ascending: false });

    if (!error && data) setCampaigns(data);
    setLoading(false);
  };

  const toggleBookmark = async (campaignId: string) => {
    if (!currentUserId) return;
    if (bookmarked.includes(campaignId)) {
      await supabase.from("campaign_favourites").delete().eq("user_id", currentUserId).eq("campaign_id", campaignId);
      setBookmarked(prev => prev.filter(id => id !== campaignId));
    } else {
      await supabase.from("campaign_favourites").insert({ user_id: currentUserId, campaign_id: campaignId });
      setBookmarked(prev => [...prev, campaignId]);
    }
  };

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const openSheet = (c: Campaign) => {
    setSelected(c);
    setMessage("");
    setSelectedPlatforms([]);
    setShowSheet(true);
  };

  const handleApply = async () => {
    if (!message || !selected) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("applications").insert({
        campaign_id: selected.id,
        creator_id: user.id,
        message,
        platforms: selectedPlatforms,
        status: "pending",
      });
      
      setApplied(prev => [...prev, selected.id]);
      setCampaigns(prev => prev.map(c => c.id === selected.id ? { ...c, applications: (c.applications || 0) + 1 } : c));
    }
    setSubmitting(false);
    setShowSheet(false);
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (selectedNiche && c.niche !== selectedNiche) return false;
    if (selectedPlatform && !c.platforms?.includes(selectedPlatform)) return false;
    if (minBudget && (parseInt(c.budget, 10) || 0) < parseInt(minBudget, 10)) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; max-height: 300px; margin-bottom: 10px; }
          to { transform: translateX(60px); opacity: 0; max-height: 0; margin-bottom: 0; padding: 0; }
        }
      `}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Explore</span>
        <div onClick={() => navigate("creator-profile")} style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}>
          {myAvatar ? <img src={myAvatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "16px", color: "#fff" }}>◉</span>}
        </div>
      </div>

      {/* Filter Options Dock */}
      <div style={{ padding: "1rem 1rem 0 1rem", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <select value={selectedNiche} onChange={e => setSelectedNiche(e.target.value)} style={UI.dropdown}>
          <option value="">All Niches</option>
          {["Lifestyle", "Beauty", "Fitness", "Tech", "Fashion"].map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)} style={UI.dropdown}>
          <option value="">All Platforms</option>
          {["Instagram", "TikTok", "YouTube", "Twitter/X"].map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={minBudget} onChange={e => setMinBudget(e.target.value)} style={UI.dropdown}>
          <option value="">Any Budget</option>
          {["50", "100", "250", "500", "1000"].map(v => <option key={v} value={v}>£{v}+</option>)}
        </select>
      </div>

      {/* Campaign Feed Container */}
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
          <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Loading campaigns...</p>
        ) : filteredCampaigns.filter(c => !applied.includes(c.id)).length === 0 ? (
          <div style={{ border: "1px dashed #222", borderRadius: "16px", padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>No opportunities match</p>
            <p style={{ fontSize: "13px", color: "#444", maxWidth: "260px", margin: "0 auto" }}>Try adjusting your parameters.</p>
          </div>
        ) : (
          filteredCampaigns.filter(c => !applied.includes(c.id)).map(c => {
            const budgetVal = parseInt(c.budget, 10);
            return (
              <div key={c.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem", animation: applied.includes(c.id) ? "slideOut 0.5s ease forwards" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      onClick={(e) => { e.stopPropagation(); navigateToProfile && navigateToProfile(c.brand_id); }}
                      style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #222", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
                    >
                      {c.brand_profiles?.avatar_url ? <img src={c.brand_profiles.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
                    </div>
                    <div>
                      <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, lineHeight: 1 }}>{c.brand_profiles?.name || "Brand"}</p>
                      <p style={{ color: "#444", fontSize: "11px", marginTop: "3px" }}>{c.niche}</p>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div onClick={(e) => { e.stopPropagation(); toggleBookmark(c.id); }} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={bookmarked.includes(c.id) ? "#fff" : "none"} xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 3H19C19.5523 3 20 3.44772 20 4V21L12 17L4 21V4C4 3.44772 4.44772 3 5 3Z" stroke={bookmarked.includes(c.id) ? "#fff" : "#444"} strokeWidth="2" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "4px", background: "#1a1a1a", border: "1px solid #222", color: "#666", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                      {c.type}
                    </span>
                  </div>
                </div>

                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>{c.name}</p>
                <p style={{ fontSize: "12px", color: "#555", lineHeight: 1.5, marginBottom: "12px" }}>{c.description}</p>
                
                {/* Dynamically Updated Posted & Deadline Rows */}
                <div style={{ display: "flex", gap: "14px", fontSize: "11px", color: "#444", marginBottom: "12px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.03em", color: "#333", fontWeight: 500 }}>Posted:</span>
                    <span style={{ color: "#666" }}>{formatRelativeTime(c.created_at, now)}</span>
                  </span>
                  {c.deadline && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.03em", color: "#333", fontWeight: 500 }}>Deadline:</span>
                      <span style={{ color: "#fff", fontWeight: 500 }}>{formatDeadline(c.deadline) || c.deadline}</span>
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #161616", paddingTop: "10px" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {c.type === "paid" && budgetVal ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Budget</span>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", lineHeight: 1.1 }}>
                          £{budgetVal.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Reward</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif", lineHeight: 1.1, textTransform: "uppercase" }}>
                          Gifted
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => !applied.includes(c.id) && openSheet(c)}
                    style={{ padding: "7px 16px", background: applied.includes(c.id) ? "#1a1a1a" : "#fff", color: applied.includes(c.id) ? "#555" : "#0a0a0a", border: applied.includes(c.id) ? "1px solid #222" : "1px solid #fff", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: applied.includes(c.id) ? "default" : "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}
                  >
                    {applied.includes(c.id) ? "Applied ✓" : "Apply"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Overlay */}
      {showSheet && <div onClick={() => setShowSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10 }} />}

      {/* Apply Sheet */}
      {selected && (
        <div style={{ position: "fixed", bottom: showSheet ? 0 : "-100%", left: 0, right: 0, background: "#111", borderTop: "1px solid #222", borderRadius: "20px 20px 0 0", padding: "1.5rem 1.25rem 5rem", zIndex: 20, transition: "bottom 0.3s ease", maxHeight: "90vh", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <div style={{ width: "36px", height: "4px", background: "#333", borderRadius: "2px" }} />
            <span onClick={() => setShowSheet(false)} style={{ fontSize: "22px", color: "#444", cursor: "pointer", lineHeight: 1 }}>×</span>
          </div>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Apply to {selected.name}</p>
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "1.5rem" }}>{selected.brand_profiles?.name || "Brand"}</p>

          {selected.script && (
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Brief / Script</p>
              <p style={{ fontSize: "12px", color: "#777", lineHeight: 1.7, whiteSpace: "pre-line" }}>{selected.script}</p>
            </div>
          )}

          {selected.platforms?.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Platforms you'll post on</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {selected.platforms.map(p => <div key={p} onClick={() => togglePlatform(p)} style={UI.chip(selectedPlatforms.includes(p))}>{p}</div>)}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Message to brand</p>
            <textarea style={{ ...UI.input, minHeight: "100px", resize: "none" }} placeholder="Introduce yourself and why you're a good fit..." value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <div
            onClick={handleApply}
            style={{ padding: "14px", borderRadius: "8px", background: message ? "#fff" : "#1a1a1a", color: message ? "#0a0a0a" : "#333", border: message ? "1px solid #fff" : "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: message ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </div>
        </div>
      )}
    </div>
  );
}