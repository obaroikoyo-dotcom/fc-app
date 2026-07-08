import { useState, useEffect, useLayoutEffect, useRef } from "react";
import CreateCampaign from "./CreateCampaign";
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

const formatDeadline = (dateString: string) => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
};

const formatRelativeTime = (dateString: string, now: Date) => {
  if (!dateString) return "";
  const utcDate = new Date(dateString.endsWith("Z") ? dateString : dateString + "Z");
  const diffMs = now.getTime() - utcDate.getTime();
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
  const stickyRef = useRef<HTMLDivElement>(null);
  const [stickyHeight, setStickyHeight] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [myLogo, setMyLogo] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [feedTab, setFeedTab] = useState<"yours" | "discover">("yours");
  const [selectedNiche, setSelectedNiche] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");

  useLayoutEffect(() => {
    if (stickyRef.current) setStickyHeight(stickyRef.current.offsetHeight);
  }, [tab, isEnterprise]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: bp } = await supabase.from("brand_profiles").select("is_enterprise, logo_url").eq("id", user.id).single();
        if (bp?.is_enterprise) setIsEnterprise(true);
        if (bp?.logo_url) setMyLogo(bp.logo_url);

        const { data } = await supabase
          .from("campaigns")
          .select(`*, applications(id), brand_profiles(name, logo_url)`)
          .order("created_at", { ascending: false });

        if (data) {
          const mine = data.filter(c => c.brand_id === user.id);
          const others = data.filter(c => c.brand_id !== user.id);
          setCampaigns([...mine, ...others] as unknown as Campaign[]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const clockInterval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(clockInterval);
  }, []);

  function CustomDropdown({ value, onChange, options, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder: string;
  }) {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ position: "relative", flex: 1 }}>
        <div
          onClick={() => setOpen(p => !p)}
          style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 14px", color: value ? "#fff" : "#555", fontSize: "13px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>{value || placeholder}</span>
          <span style={{ color: "#444", fontSize: "10px" }}>{open ? "▲" : "▼"}</span>
        </div>
        {open && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#111", border: "1px solid #222", borderRadius: "8px", zIndex: 100, overflow: "hidden" }}>
            <div
              onClick={() => { onChange(""); setOpen(false); }}
              style={{ padding: "10px 14px", fontSize: "13px", color: !value ? "#fff" : "#555", cursor: "pointer", borderBottom: "1px solid #1a1a1a", background: !value ? "#1a1a1a" : "transparent" }}
            >
              {placeholder}
            </div>
            {options.map(o => (
              <div
                key={o}
                onClick={() => { onChange(o); setOpen(false); }}
                style={{ padding: "10px 14px", fontSize: "13px", color: value === o ? "#fff" : "#555", cursor: "pointer", borderBottom: "1px solid #1a1a1a", background: value === o ? "#1a1a1a" : "transparent" }}
              >
                {o}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const deleteCampaign = async (id: string) => {
    if (!window.confirm("Delete this campaign? This cannot be undone.")) return;
    await supabase.from("campaigns").delete().eq("id", id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap'); @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>

      {/* Sticky header group: header + tabs + filters stack with zero gap since they share one fixed box */}
      <div ref={stickyRef} style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        {/* Header */}
        <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>
              {tab === "campaigns" ? "Campaigns" : "Post Campaign"}
            </span>
            {isEnterprise && (
              <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: "1px solid #fff", color: "#fff" }}>Enterprise</span>
            )}
          </div>
          <div onClick={() => navigate("brand-profile")} style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
            {myLogo ? <img src={myLogo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "16px", color: "#fff" }}>◉</span>}
          </div>
        </div>

        {/* Feed Tabs */}
        {tab === "campaigns" && (
          <div style={{ display: "flex", borderBottom: "1px solid #111", background: "#0d0d0d" }}>
            <button onClick={() => setFeedTab("yours")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: feedTab === "yours" ? "2px solid #fff" : "2px solid transparent", color: feedTab === "yours" ? "#fff" : "#444", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
              Your Campaigns
            </button>
            <button onClick={() => setFeedTab("discover")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: feedTab === "discover" ? "2px solid #fff" : "2px solid transparent", color: feedTab === "discover" ? "#fff" : "#444", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
              Market
            </button>
          </div>
        )}

        {/* Filters */}
        {tab === "campaigns" && (
          <div style={{ padding: "1rem 1.25rem", display: "flex", gap: "8px" }}>
            <CustomDropdown value={selectedNiche} onChange={setSelectedNiche} options={["Lifestyle", "Beauty", "Fitness", "Tech", "Fashion"]} placeholder="All Niches" />
            <CustomDropdown value={selectedPlatform} onChange={setSelectedPlatform} options={["Instagram", "TikTok", "YouTube", "Twitter/X"]} placeholder="All Platforms" />
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "1.25rem", overflowY: "auto", paddingBottom: "6rem", paddingTop: stickyHeight ? `${stickyHeight + 16}px` : "11rem" }}>

        {/* Campaigns Tab */}
        {tab === "campaigns" && (
          <div key="campaigns" className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
            ) : (() => {
              const filtered = campaigns.filter(c => {
                const isOwn = c.brand_id === currentUserId;
                if (feedTab === "yours" && !isOwn) return false;
                if (feedTab === "discover" && isOwn) return false;
                if (selectedNiche && c.niche !== selectedNiche) return false;
                if (selectedPlatform && !c.platforms?.includes(selectedPlatform)) return false;
                return true;
              });
              if (filtered.length === 0) return (
                <div style={{ border: "1px dashed #222", borderRadius: "16px", padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>
                    {feedTab === "yours" ? "No campaigns yet" : "No campaigns found"}
                  </p>
                  <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.7 }}>
                    {feedTab === "yours" ? "Post your first campaign and start finding creators." : "Try adjusting your filters."}
                  </p>
                  {feedTab === "yours" && (
                    <div onClick={() => setTab("post")} style={{ marginTop: "1.5rem", padding: "12px", background: "#fff", color: "#0a0a0a", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Post a Campaign
                    </div>
                  )}
                </div>
              );
              return <>{filtered.map(c => {
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
                        <span style={{ flexShrink: 0, fontSize: "10px", color: "#555", background: "#111", border: "1px solid #222", padding: "3px 8px", borderRadius: "4px", fontWeight: 500, letterSpacing: "0.04em" }}>
                          Video Pitch Required
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
                              {isEnterprise
                                ? <span style={{ color: "#34c759", fontWeight: 500 }}>0% platform fee (Enterprise)</span>
                                : <>Total: <span style={{ color: "#34c759", fontWeight: 500 }}>£{currentTotalCost.toLocaleString()}</span> (+5% fee)</>
                              }
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
              })}</>;
            })()}
          </div>
        )}

        {/* Post Tab */}
        {tab === "post" && (
          <div key="post" className="page-enter">
            <CreateCampaign
              isEnterprise={isEnterprise}
              onPosted={async () => {
                await fetchCampaigns();
                setTab("campaigns");
              }}
              onNavigateEnterprise={() => navigate("enterprise")}
            />
          </div>
        )}

      </div>
    </div>
  );
}