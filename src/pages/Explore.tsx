import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";
import { useRefetchOnVisible } from "../lib/useRefetchOnVisible";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { useHasLoadedOnce } from "../lib/useHasLoadedOnce";
import { getBlockedUserIds } from "../lib/blocks";
import VerifiedBadge from "../components/VerifiedBadge";

interface Props { 
  navigate: (p: Page) => void; 
  navigateToProfile?: (id: string) => void;
  navigateToApply?: (campaignId: string) => void;
}
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
  video_required: boolean;
  brand_profiles: {
    name: string;
    niche: string;
    avatar_url?: string;
    verified?: boolean;
  } | null;
  my_application?: {
    status: "pending" | "approved" | "declined";
    message: string;
  };
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
  const diffMins = Math.floor((now.getTime() - utcDate.getTime()) / 60000);
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
        <span style={{ color: "#888", fontSize: "10px" }}>{open ? "▲" : "▼"}</span>
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

export default function Explore({ navigate, navigateToProfile, navigateToApply }: Props) {
  const stickyRef = useRef<HTMLDivElement>(null);
  const [stickyHeight, setStickyHeight] = useState(0);
  const [feedTab, setFeedTab] = useState<"discover" | "pitches">("discover");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const [applied, setApplied] = useState<string[]>([]);
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "budget">("newest");
  const [now, setNow] = useState(new Date());

  useLayoutEffect(() => {
    if (stickyRef.current) setStickyHeight(stickyRef.current.offsetHeight);
  }, [feedTab]);

  useEffect(() => {
    fetchMyProfile().then((userId) => {
      fetchCampaigns(userId || undefined);
    });

    const clockInterval = setInterval(() => setNow(new Date()), 60000);

    const channel = supabase
      .channel("campaigns-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => {
        supabase.auth.getUser().then(({ data }) => fetchCampaigns(data.user?.id || undefined));
      })
      .subscribe();

    return () => {
      clearInterval(clockInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMyProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    setCurrentUserId(user.id);

    const { data } = await supabase.from("creator_profiles").select("name, avatar_url").eq("id", user.id).single();
    if (data) {
      if (data.avatar_url) setMyAvatar(data.avatar_url);
    }

    const { data: favs } = await supabase.from("campaign_favourites").select("campaign_id").eq("user_id", user.id);
    if (favs) setBookmarked(favs.map((f: any) => f.campaign_id));

    return user.id;
  };

  const fetchCampaigns = async (userId?: string) => {
    setLoading(true);
    try {
      await withTimeout(async () => {
        const { data, error } = await supabase
          .from("campaigns")
          .select(`*, brand_profiles(name, niche, avatar_url, is_enterprise, verified)`)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const activeUid = userId || currentUserId;
          const [blockedIds, myApps] = await Promise.all([
            activeUid ? getBlockedUserIds(activeUid) : Promise.resolve([]),
            activeUid ? supabase.from("applications").select("campaign_id, status, message").eq("creator_id", activeUid).then(r => r.data || []) : Promise.resolve([]),
          ]);
          const parsed: Campaign[] = data
            .filter((c: any) => !blockedIds.includes(c.brand_id))
            .map((c: any) => {
              const myApp = myApps.find((a: any) => a.campaign_id === c.id);
              return {
                ...c,
                my_application: myApp ? { status: myApp.status, message: myApp.message } : undefined
              };
            });
          setCampaigns(parsed);
          setApplied(parsed.filter(c => c.my_application).map(c => c.id));
        }
      }, 10000, "Explore.fetchCampaigns");
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  useRefetchOnVisible(() => fetchCampaigns(), loading);

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

  const filteredCampaigns = campaigns.filter((c) => {
    if (selectedNiche && c.niche !== selectedNiche) return false;
    if (selectedPlatform && !c.platforms?.includes(selectedPlatform)) return false;
    if (feedTab === "discover" && applied.includes(c.id)) return false;
    if (feedTab === "pitches" && !applied.includes(c.id)) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "budget") return (parseInt(b.budget, 10) || 0) - (parseInt(a.budget, 10) || 0);
    return 0; // already newest-first from the server query
  });

  const getStatusStyle = (status?: string): React.CSSProperties => {
    switch (status) {
      case "approved":
      case "paid": return { color: "#34c759", background: "rgba(52,199,89,0.1)" };
      case "declined": return { color: "#ff3b30", background: "rgba(255,59,48,0.1)" };
      default: return { color: "#ff9500", background: "rgba(255,149,0,0.1)" };
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap'); @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>

      {/* Sticky header group: header + tabs + filters stack with zero gap since they share one fixed box */}
      <div ref={stickyRef} style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        {/* Header */}
        <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Explore</span>
          <div onClick={() => navigate("creator-profile")} style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
            {myAvatar ? <img src={myAvatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "16px", color: "#fff" }}>◉</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #111", background: "#0d0d0d" }}>
          <button onClick={() => setFeedTab("discover")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: feedTab === "discover" ? "2px solid #fff" : "2px solid transparent", color: feedTab === "discover" ? "#fff" : "#444", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
            Discover Deals
          </button>
          <button onClick={() => setFeedTab("pitches")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: feedTab === "pitches" ? "2px solid #fff" : "2px solid transparent", color: feedTab === "pitches" ? "#fff" : "#444", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
            My Pitches ({applied.length})
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: "1rem 1.25rem 0", display: "flex", gap: "8px" }}>
          <CustomDropdown value={selectedNiche} onChange={setSelectedNiche} options={["Lifestyle", "Beauty", "Fitness", "Tech", "Fashion"]} placeholder="All Niches" />
          <CustomDropdown value={selectedPlatform} onChange={setSelectedPlatform} options={["Instagram", "TikTok", "YouTube", "Twitter/X"]} placeholder="All Platforms" />
        </div>
        <div style={{ padding: "0.75rem 1.25rem 1rem" }}>
          <CustomDropdown
            value={sortBy === "budget" ? "Highest Budget" : "Newest"}
            onChange={v => setSortBy(v === "Highest Budget" ? "budget" : "newest")}
            options={["Newest", "Highest Budget"]}
            placeholder="Sort"
          />
        </div>
      </div>

      {/* Campaign Feed */}
<div style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", paddingTop: stickyHeight ? `${stickyHeight + 16}px` : "11rem" }}>
      <div key={feedTab} className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {!hasLoadedOnce && showSkeleton ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ width: "100px", height: "12px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                    <div style={{ width: "60px", height: "10px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  </div>
                </div>
                <div style={{ width: "70%", height: "14px", borderRadius: "4px", background: "#1a1a1a", marginBottom: "8px" }} />
                <div style={{ width: "90%", height: "10px", borderRadius: "4px", background: "#1a1a1a", marginBottom: "6px" }} />
                <div style={{ width: "75%", height: "10px", borderRadius: "4px", background: "#1a1a1a", marginBottom: "16px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #161616", paddingTop: "10px" }}>
                  <div style={{ width: "60px", height: "20px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  <div style={{ width: "70px", height: "28px", borderRadius: "6px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                </div>
              </div>
            ))}
          </div>
        ) : !hasLoadedOnce && loading ? null : filteredCampaigns.length === 0 ? (
          <div style={{ border: "1px dashed #222", borderRadius: "16px", padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>
              {feedTab === "discover" ? "No new offers active" : "No pitches sent yet"}
            </p>
            <p style={{ fontSize: "12px", color: "#888", maxWidth: "260px", margin: "0 auto" }}>
              {feedTab === "discover" ? "Try loosening your search filters up top." : "Opportunities you apply to will show up right here."}
            </p>
          </div>
        ) : (
          filteredCampaigns.map((c, i) => {
            const baseBudgetVal = parseInt(c.budget, 10) || 0;
            const brandIsEnterprise = (c.brand_profiles as any)?.is_enterprise;
            const netCreatorPayout = brandIsEnterprise ? baseBudgetVal : baseBudgetVal * 0.90;

            return (
              <div key={c.id} className="item-enter" style={{ animationDelay: `${Math.min(i, 10) * 40}ms`, background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      onClick={(e) => { e.stopPropagation(); navigateToProfile && navigateToProfile(c.brand_id); }}
                      style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #222", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
                    >
                      {c.brand_profiles?.avatar_url ? <img src={c.brand_profiles.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
                    </div>
                    <div>
                      <p style={{ display: "flex", alignItems: "center", gap: "4px", color: "#fff", fontSize: "13px", fontWeight: 600, lineHeight: 1 }}>
                        {c.brand_profiles?.name || "Brand"}
                        {c.brand_profiles?.verified && <VerifiedBadge size={12} />}
                      </p>
                      <p style={{ color: "#888", fontSize: "11px", marginTop: "3px" }}>{c.niche}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div onClick={(e) => { e.stopPropagation(); toggleBookmark(c.id); }} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={bookmarked.includes(c.id) ? "#fff" : "none"}>
                        <path d="M5 3H19C19.5523 3 20 3.44772 20 4V21L12 17L4 21V4C4 3.44772 4.44772 3 5 3Z" stroke={bookmarked.includes(c.id) ? "#fff" : "#444"} strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "4px", background: "#1a1a1a", border: "1px solid #222", color: "#aaa", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                      {c.type}
                    </span>
                  </div>
                </div>

                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>{c.name}</p>

                <div style={{ display: "flex", gap: "14px", fontSize: "11px", color: "#888", marginBottom: "12px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.03em", color: "#777", fontWeight: 500 }}>Posted:</span>
                    <span style={{ color: "#aaa" }}>{formatRelativeTime(c.created_at, now)}</span>
                  </span>
                  {c.deadline && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.03em", color: "#777", fontWeight: 500 }}>Deadline:</span>
                      <span style={{ color: "#fff", fontWeight: 500 }}>{formatDeadline(c.deadline)}</span>
                    </span>
                  )}
                </div>

                {c.platforms && c.platforms.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                    {c.platforms.map((p: string) => (
                      <span key={p} style={{ fontSize: "10px", padding: "2px 8px", border: "1px solid #1f1f1f", borderRadius: "20px", color: "#999", background: "#0d0d0d" }}>{p}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #161616", paddingTop: "10px" }}>
                  <div>
                    {c.type === "paid" && baseBudgetVal ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "9px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Your Net Payout {brandIsEnterprise ? "(0% cut)" : "(-10%)"}</span>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>£{netCreatorPayout.toLocaleString()}</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "9px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Reward</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif", textTransform: "uppercase" }}>Gifted</span>
                      </div>
                    )}
                  </div>

                  {c.my_application ? (
                    <div style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", ...getStatusStyle(c.my_application.status) }}>
                      {c.my_application.status}
                    </div>
                  ) : (
                    <div
                      onClick={() => navigateToApply && navigateToApply(c.id)}
                      style={{ padding: "7px 16px", background: "#fff", color: "#0a0a0a", border: "1px solid #fff", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}
                    >
                      Apply
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}