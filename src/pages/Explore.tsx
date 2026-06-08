import { useState, useEffect, useRef } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { 
  navigate: (p: Page) => void; 
  navigateToProfile?: (id: string) => void; 
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
  } | null;
  my_application?: {
    status: "pending" | "approved" | "declined";
    message: string;
  };
}

const UI = {
  input: { background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" },
  chip: (act: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: "20px", border: `1px solid ${act ? "#fff" : "#222"}`, background: act ? "#fff" : "transparent", color: act ? "#0a0a0a" : "#555", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", transition: "all 0.15s" })
};

const formatDeadline = (dateString: string) => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
};

const formatRelativeTime = (dateString: string, now: Date) => {
  if (!dateString) return "";
  const postedDate = new Date(dateString);
  const diffMins = Math.floor((now.getTime() - postedDate.getTime()) / 60000);
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

export default function Explore({ navigate, navigateToProfile }: Props) {
  const [feedTab, setFeedTab] = useState<"discover" | "pitches">("discover");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myCreatorName, setMyCreatorName] = useState<string>("A creator");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [now, setNow] = useState(new Date());
  const sheetRef = useRef<HTMLDivElement>(null);

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

    const { data } = await supabase.from("profiles").select("name, avatar_url").eq("id", user.id).single();
    if (data) {
      if (data.avatar_url) setMyAvatar(data.avatar_url);
      if (data.name) setMyCreatorName(data.name);
    }

    const { data: favs } = await supabase.from("campaign_favourites").select("campaign_id").eq("user_id", user.id);
    if (favs) setBookmarked(favs.map((f: any) => f.campaign_id));

    return user.id;
  };

  const fetchCampaigns = async (userId?: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select(`*, brand_profiles(name, niche, avatar_url), applications(creator_id, status, message)`)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const activeUid = userId || currentUserId;
      const parsed: Campaign[] = data.map((c: any) => {
        const myApp = c.applications?.find((a: any) => a.creator_id === activeUid);
        return {
          ...c,
          my_application: myApp ? { status: myApp.status, message: myApp.message } : undefined
        };
      });
      setCampaigns(parsed);
      setApplied(parsed.filter(c => c.my_application).map(c => c.id));
    }
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
    setVideoFile(null);
    setUploadProgress(null);
    setFormError(null);
    setShowSheet(true);
    setTimeout(() => sheetRef.current?.scrollTo({ top: 0 }), 50);
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxLimitInBytes = 50 * 1024 * 1024;
    if (file.size > maxLimitInBytes) {
      setFormError("The selected video is too large. Please upload a compressed pitch asset under 50MB.");
      setVideoFile(null);
      return;
    }
    setFormError(null);
    setVideoFile(file);
  };

  const handleApply = async () => {
    if (!message || !selected || !currentUserId) return;

    if (selected.video_required && !videoFile) {
      setFormError("This campaign requires a video pitch. Please upload a video asset below.");
      return;
    }

    setFormError(null);
    setSubmitting(true);
    setUploadProgress(0);

    let uploadedVideoUrl: string | null = null;

    if (videoFile) {
      try {
        const fileExtension = videoFile.name.split('.').pop();
        const uniqueFileName = `${currentUserId}_${selected.id}_${Date.now()}.${fileExtension}`;
        const filePath = `pitches/${uniqueFileName}`;

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
        setFormError(err.message || "Failed to upload video pitch asset.");
        setSubmitting(false);
        setUploadProgress(null);
        return;
      }
    }

    const { error: appError } = await supabase.from("applications").insert({
      campaign_id: selected.id,
      creator_id: currentUserId,
      message,
      platforms: selectedPlatforms,
      video_url: uploadedVideoUrl,
      status: "pending",
    });

    if (!appError) {
      await supabase.from("notifications").insert({
        user_id: selected.brand_id,
        actor_id: currentUserId,
        type: "campaign_application",
        title: "New Application 📩",
        body: `${myCreatorName} applied to your campaign "${selected.name}".`,
        data: { campaign_id: selected.id }
      });

      setApplied(prev => [...prev, selected.id]);
      setCampaigns(prev => prev.map(c => c.id === selected.id ? {
        ...c,
        my_application: { status: "pending", message }
      } : c));
      setShowSheet(false);
    } else {
      setFormError("Application submission error. Please try again.");
    }

    setSubmitting(false);
    setUploadProgress(null);
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (selectedNiche && c.niche !== selectedNiche) return false;
    if (selectedPlatform && !c.platforms?.includes(selectedPlatform)) return false;
    if (feedTab === "discover" && applied.includes(c.id)) return false;
    if (feedTab === "pitches" && !applied.includes(c.id)) return false;
    return true;
  });

  const getStatusStyle = (status?: string): React.CSSProperties => {
    switch (status) {
      case "approved": return { color: "#34c759", background: "rgba(52,199,89,0.1)" };
      case "declined": return { color: "#ff3b30", background: "rgba(255,59,48,0.1)" };
      default: return { color: "#ff9500", background: "rgba(255,149,0,0.1)" };
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap'); @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>

      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
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

      {/* Campaign Feed */}
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
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
        ) : filteredCampaigns.length === 0 ? (
          <div style={{ border: "1px dashed #222", borderRadius: "16px", padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>
              {feedTab === "discover" ? "No new offers active" : "No pitches sent yet"}
            </p>
            <p style={{ fontSize: "12px", color: "#444", maxWidth: "260px", margin: "0 auto" }}>
              {feedTab === "discover" ? "Try loosening your search filters up top." : "Opportunities you apply to will show up right here."}
            </p>
          </div>
        ) : (
          filteredCampaigns.map(c => {
            const baseBudgetVal = parseInt(c.budget, 10) || 0;
            const netCreatorPayout = baseBudgetVal * 0.90;

            return (
              <div key={c.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem" }}>
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
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={bookmarked.includes(c.id) ? "#fff" : "none"}>
                        <path d="M5 3H19C19.5523 3 20 3.44772 20 4V21L12 17L4 21V4C4 3.44772 4.44772 3 5 3Z" stroke={bookmarked.includes(c.id) ? "#fff" : "#444"} strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "4px", background: "#1a1a1a", border: "1px solid #222", color: "#666", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                      {c.type}
                    </span>
                  </div>
                </div>

                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>{c.name}</p>
                <p style={{ fontSize: "12px", color: "#555", lineHeight: 1.5, marginBottom: "12px" }}>{c.description}</p>

                <div style={{ display: "flex", gap: "14px", fontSize: "11px", color: "#444", marginBottom: "12px" }}>
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

                {c.platforms && c.platforms.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                    {c.platforms.map((p: string) => (
                      <span key={p} style={{ fontSize: "10px", padding: "2px 8px", border: "1px solid #1f1f1f", borderRadius: "20px", color: "#555", background: "#0d0d0d" }}>{p}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #161616", paddingTop: "10px" }}>
                  <div>
                    {c.type === "paid" && baseBudgetVal ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Your Net Payout</span>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>£{netCreatorPayout.toLocaleString()}</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Reward</span>
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
                      onClick={() => openSheet(c)}
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

      {/* Overlay */}
      {showSheet && <div onClick={() => !submitting && setShowSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 199 }} />}

      {/* Apply Sheet */}
      {selected && (
        <div ref={sheetRef} style={{ position: "fixed", bottom: showSheet ? 0 : "-100%", left: 0, right: 0, background: "#111", borderTop: "1px solid #222", borderRadius: "20px 20px 0 0", padding: "1.5rem 1.25rem 6rem", zIndex: 200, transition: "bottom 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)", minHeight: "85vh", maxHeight: "92vh", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <div style={{ width: "36px", height: "4px", background: "#333", borderRadius: "2px" }} />
            <span onClick={() => !submitting && setShowSheet(false)} style={{ fontSize: "22px", color: "#444", cursor: submitting ? "not-allowed" : "pointer", lineHeight: 1 }}>×</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Apply to {selected.name}</p>
              <p style={{ fontSize: "12px", color: "#444" }}>{selected.brand_profiles?.name || "Brand"}</p>
            </div>
            {selected.type === "paid" && (
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: "9px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Net Take-home</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#34c759", fontFamily: "'Syne', sans-serif" }}>
                  £{(parseInt(selected.budget, 10) * 0.90).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {selected.script && (
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Brief / Script</p>
              <p style={{ fontSize: "12px", color: "#777", lineHeight: 1.7, whiteSpace: "pre-line" }}>{selected.script}</p>
            </div>
          )}

          {selected.platforms && selected.platforms.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Platforms you'll post on</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {selected.platforms.map(p => <div key={p} onClick={() => !submitting && togglePlatform(p)} style={UI.chip(selectedPlatforms.includes(p))}>{p}</div>)}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Message to brand</p>
            <textarea disabled={submitting} style={{ ...UI.input, minHeight: "100px", resize: "none", opacity: submitting ? 0.5 : 1 }} placeholder="Introduce yourself and why you're a good fit..." value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
              Video Pitch {selected.video_required ? <span style={{ color: "#ff3b30", fontWeight: 600 }}>* (Required)</span> : <span style={{ color: "#444" }}>(Optional)</span>}
            </p>
            <input
              type="file"
              disabled={submitting}
              accept="video/*"
              onChange={handleVideoFileChange}
              style={{ ...UI.input, background: "#111", border: "1px dashed #222", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1 }}
            />
            {videoFile && !submitting && (
              <p style={{ color: "#34c759", fontSize: "12px", marginTop: "6px" }}>
                ✓ Selected: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
              </p>
            )}
            {uploadProgress !== null && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#aaa", marginBottom: "4px" }}>
                  <span>Uploading pitch asset...</span>
                  <span>{uploadProgress === 0 ? "Preparing..." : `${uploadProgress}%`}</span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "#222", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${uploadProgress || 15}%`, height: "100%", background: "#fff", transition: "width 0.3s ease" }} />
                </div>
              </div>
            )}
          </div>

          {formError && (
            <div style={{ background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: "8px", padding: "12px", marginBottom: "1.5rem" }}>
              <p style={{ color: "#ff3b30", fontSize: "12px", margin: 0, fontWeight: 500 }}>{formError}</p>
            </div>
          )}

          <div
            onClick={!submitting && message ? handleApply : undefined}
            style={{ padding: "14px", borderRadius: "8px", background: message && !submitting ? "#fff" : "#1a1a1a", color: message && !submitting ? "#0a0a0a" : "#333", border: message && !submitting ? "1px solid #fff" : "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: message && !submitting ? "pointer" : "default", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
          >
            {submitting ? "Processing Application..." : "Submit Application"}
          </div>
        </div>
      )}
    </div>
  );
}