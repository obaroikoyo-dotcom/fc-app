import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { avatarSrc } from "../lib/avatar";
import { withTimeout } from "../lib/withTimeout";
import { useRefetchOnVisible } from "../lib/useRefetchOnVisible";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { useHasLoadedOnce } from "../lib/useHasLoadedOnce";
import { getBlockedUserIds } from "../lib/blocks";
import VerifiedBadge from "../components/VerifiedBadge";
import { usePersistedState } from "../lib/usePersistedState";
import { useScrollRestoration } from "../lib/useScrollRestoration";
import { NICHES_A_TO_Z } from "../lib/niches";
import { FilterToggle, FilterPanel } from "../components/FilterBar";
import CampaignShelf, { ShelfHeading, type ShelfCard } from "../components/CampaignShelf";
import CampaignTile from "../components/CampaignTile";
import { coverSrc } from "../lib/coverPhoto";
import { SHELF_TITLES, bandTag, buildShelves, daysLeft, dueNote, emptyShelves, shelfIsShown, type ShelfKey } from "../lib/campaignShelves";

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
  cover_url?: string | null;
  video_required: boolean;
  brand_profiles: {
    name: string;
    niche: string;
    avatar_url?: string;
    verified?: boolean;
    is_enterprise?: boolean;
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

// What the creator takes home: the whole budget from an Enterprise brand, 90% otherwise.
const netPayout = (c: { budget: string; brand_profiles: { is_enterprise?: boolean } | null }) => {
  const base = parseInt(c.budget, 10) || 0;
  return c.brand_profiles?.is_enterprise ? base : base * 0.9;
};

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
  const [myName, setMyName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedNiche, setSelectedNiche] = usePersistedState("fc_explore_niche", "");
  const [selectedPlatform, setSelectedPlatform] = usePersistedState("fc_explore_platform", "");
  const [sortBy, setSortBy] = usePersistedState<"newest" | "budget">("fc_explore_sortby", "newest");
  const [showFilters, setShowFilters] = useState(false);
  const [focus, setFocus] = useState<ShelfKey | null>(null); // "See all" on a shelf
  const [now, setNow] = useState(new Date());
  const scrollRef = useScrollRestoration("fc_explore_scroll", !loading);

  // The header is fixed, so the list below it is pushed down by its height. That
  // height changes when the filter menus open or close, so follow it.
  useLayoutEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const update = () => setStickyHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      if (data.name) setMyName(data.name);
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
          .eq("is_draft", false)
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

  const activeFilterCount = [selectedNiche, selectedPlatform, sortBy === "budget" ? "budget" : ""].filter(Boolean).length;

  // Shelves on top of the feed: only on Discover, with no filter on (filtering
  // means you want that list), and only once there are enough campaigns for them
  // to be more than a repeat of the list. Campaigns whose deadline has passed
  // are left out of them.
  const discoverNow = feedTab === "discover" && activeFilterCount === 0;
  const shelfLists: Record<ShelfKey, Campaign[]> = discoverNow ? buildShelves(filteredCampaigns, now, netPayout) : emptyShelves<Campaign>();
  const focusKey = discoverNow && focus && shelfLists[focus].length > 0 ? focus : null;
  const showShelves = discoverNow && !focusKey && filteredCampaigns.length >= 4;
  const feedList = focusKey ? shelfLists[focusKey] : filteredCampaigns;
  const shelfNote = (key: ShelfKey, c: Campaign) => {
    if (key === "closing") return dueNote(daysLeft(c.deadline, now) ?? 0);
    if (key === "top") return c.niche || "";
    return formatRelativeTime(c.created_at, now);
  };
  const shelfCard = (key: ShelfKey, c: Campaign): ShelfCard => ({
    id: c.id,
    brandName: c.brand_profiles?.name || "Brand",
    brandAvatar: avatarSrc(c.brand_profiles?.avatar_url, c.brand_profiles?.name),
    verified: !!c.brand_profiles?.verified,
    name: c.name,
    niche: c.niche || "",
    photo: coverSrc(c.cover_url),
    paid: c.type === "paid" && netPayout(c) > 0,
    figure: `£${netPayout(c).toLocaleString()}`,
    note: shelfNote(key, c),
    urgent: key === "closing" && (daysLeft(c.deadline, now) ?? 9) <= 2,
  });

  const getStatusStyle = (status?: string): React.CSSProperties => {
    switch (status) {
      case "approved":
      case "paid": return { color: "var(--t-fff)" };
      case "declined": return { color: "var(--t-ff3b30)" };
      default: return { color: "var(--t-ff9500)" };
    }
  };

  return (
    <div style={{ minHeight: "100%", background: "var(--c-0a0a0a)", fontFamily: "'TikTok Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@300..900&display=swap'); @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>

      {/* Sticky header group: header + tabs + filters stack with zero gap since they share one fixed box */}
      <div ref={stickyRef} style={{ position: "fixed", top: 0, left: 0, right: 0, background: "var(--c-0a0a0a)", zIndex: 100 }}>
        {/* Header */}
        <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--c-111)" }}>
          <span style={{ fontFamily: "'TikTok Sans', sans-serif", fontSize: "18px", fontWeight: 800, color: "var(--t-fff)" }}>Explore</span>
          <div onClick={() => navigate("creator-profile")} style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1px solid var(--c-333)", background: "var(--c-111)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
            {(myAvatar || myName) && <img src={avatarSrc(myAvatar, myName)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--c-111)", background: "var(--c-0d0d0d)" }}>
          <button onClick={() => setFeedTab("discover")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: feedTab === "discover" ? "2px solid var(--c-fff)" : "2px solid transparent", color: feedTab === "discover" ? "var(--t-fff)" : "var(--t-444)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'TikTok Sans', 'Helvetica Neue', sans-serif" }}>
            Discover Deals
          </button>
          <button onClick={() => setFeedTab("pitches")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: feedTab === "pitches" ? "2px solid var(--c-fff)" : "2px solid transparent", color: feedTab === "pitches" ? "var(--t-fff)" : "var(--t-444)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'TikTok Sans', 'Helvetica Neue', sans-serif" }}>
            My Pitches ({applied.length})
          </button>
        </div>

        {/* Filters: a button that opens the menus, like Search */}
        <div style={{ padding: "0.2rem 1.25rem", display: "flex", justifyContent: "flex-end" }}>
          <FilterToggle open={showFilters} count={activeFilterCount} onToggle={() => setShowFilters(v => !v)} />
        </div>
        {showFilters && (
          <div style={{ padding: "0.2rem 1.25rem 1rem" }}>
            <FilterPanel
              filters={[
                { key: "niche", value: selectedNiche, onChange: setSelectedNiche, options: NICHES_A_TO_Z, placeholder: "Niche" },
                { key: "platform", value: selectedPlatform, onChange: setSelectedPlatform, options: ["Instagram", "TikTok", "YouTube", "Twitter/X"], placeholder: "Platform" },
                {
                  key: "sort",
                  value: sortBy === "budget" ? "Highest pay" : "Newest",
                  onChange: v => setSortBy(v === "Highest pay" ? "budget" : "newest"),
                  options: ["Newest", "Highest pay"],
                  placeholder: "Sort",
                },
              ]}
            />
          </div>
        )}
      </div>

      {/* Campaign Feed */}
<div ref={scrollRef} style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))", paddingTop: stickyHeight ? `${stickyHeight + 16}px` : "10rem" }}>
      <div key={feedTab} className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {showShelves && (["closing", "top", "fresh"] as const).map(key => {
          const list = shelfLists[key];
          if (!shelfIsShown(key, list)) return null;
          return (
            <CampaignShelf
              key={key}
              title={SHELF_TITLES[key]}
              total={list.length}
              cards={list.slice(0, 8).map(c => shelfCard(key, c))}
              onOpen={id => navigateToApply && navigateToApply(id)}
              onSeeAll={() => setFocus(key)}
            />
          );
        })}
        {!hasLoadedOnce && showSkeleton ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: "var(--c-111)", border: "1px solid var(--c-1a1a1a)", borderRadius: "12px", padding: "1rem" }}>
                <div style={{ height: "84px", margin: "-1rem -1rem 12px", borderRadius: "11px 11px 0 0", background: "var(--c-1a1a1a)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--c-1a1a1a)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ width: "100px", height: "12px", borderRadius: "4px", background: "var(--c-1a1a1a)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                    <div style={{ width: "60px", height: "10px", borderRadius: "4px", background: "var(--c-1a1a1a)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  </div>
                </div>
                <div style={{ width: "70%", height: "14px", borderRadius: "4px", background: "var(--c-1a1a1a)", marginBottom: "8px" }} />
                <div style={{ width: "90%", height: "10px", borderRadius: "4px", background: "var(--c-1a1a1a)", marginBottom: "6px" }} />
                <div style={{ width: "75%", height: "10px", borderRadius: "4px", background: "var(--c-1a1a1a)", marginBottom: "16px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--c-161616)", paddingTop: "10px" }}>
                  <div style={{ width: "60px", height: "20px", borderRadius: "4px", background: "var(--c-1a1a1a)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  <div style={{ width: "70px", height: "28px", borderRadius: "6px", background: "var(--c-1a1a1a)", animation: "shimmer 1.5s ease-in-out infinite" }} />
                </div>
              </div>
            ))}
          </div>
        ) : !hasLoadedOnce && loading ? null : feedList.length === 0 ? (
          <div style={{ border: "1px dashed var(--c-222)", borderRadius: "16px", padding: "2.75rem 1.75rem", textAlign: "center", marginTop: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ marginBottom: "6px" }}>
              <circle cx="12" cy="12" r="9" stroke="var(--s-919191)" strokeWidth="1.6" />
              <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" stroke="var(--s-919191)" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <p style={{ margin: 0, fontFamily: "'TikTok Sans', sans-serif", fontSize: "18px", fontWeight: 800, color: "var(--t-fff)" }}>
              {feedTab === "pitches" ? "No pitches yet" : selectedNiche || selectedPlatform ? "Nothing matches those filters" : "No campaigns right now"}
            </p>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--t-999)", lineHeight: 1.5, maxWidth: "280px" }}>
              {feedTab === "pitches"
                ? "When you apply to a campaign, you can follow it here."
                : selectedNiche || selectedPlatform
                  ? "Try a different niche or platform."
                  : "New campaigns from brands show up here as soon as they're posted."}
            </p>
            {feedTab === "pitches" ? (
              <div onClick={() => setFeedTab("discover")} style={{ marginTop: "10px", padding: "11px 22px", borderRadius: "10px", background: "var(--c-fff)", color: "var(--t-0a0a0a)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Browse campaigns</div>
            ) : (selectedNiche || selectedPlatform) ? (
              <div onClick={() => { setSelectedNiche(""); setSelectedPlatform(""); }} style={{ marginTop: "10px", padding: "11px 22px", borderRadius: "10px", background: "var(--c-fff)", color: "var(--t-0a0a0a)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Clear filters</div>
            ) : null}
          </div>
        ) : (
          <>
          {focusKey ? (
            <ShelfHeading title={SHELF_TITLES[focusKey]} count={feedList.length} actionLabel="Show everything" onAction={() => setFocus(null)} />
          ) : showShelves ? (
            <ShelfHeading title="All campaigns" count={feedList.length} />
          ) : null}
          {feedList.map((c, i) => {
            const baseBudgetVal = parseInt(c.budget, 10) || 0;
            const brandIsEnterprise = (c.brand_profiles as any)?.is_enterprise;
            const netCreatorPayout = brandIsEnterprise ? baseBudgetVal : baseBudgetVal * 0.90;

            const paid = c.type === "paid" && !!baseBudgetVal;
            const brandName = c.brand_profiles?.name || "Brand";
            const tag = bandTag(c, now);

            return (
              <div key={c.id} className="item-enter" style={{ animationDelay: `${Math.min(i, 10) * 40}ms`, background: "var(--c-111)", border: "1px solid var(--c-1a1a1a)", borderRadius: "16px", padding: "1.1rem" }}>
                <CampaignTile niche={c.niche} height={84} bleed="1.1rem" tag={tag} photo={coverSrc(c.cover_url)} />
                <div style={{ height: "14px" }} />
                {/* Who is offering it */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "14px" }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); navigateToProfile && navigateToProfile(c.brand_id); }}
                    style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", minWidth: 0 }}
                  >
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", border: "1px solid var(--c-222)", background: "var(--c-0a0a0a)", overflow: "hidden", flexShrink: 0 }}>
                      <img src={avatarSrc(c.brand_profiles?.avatar_url, c.brand_profiles?.name)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "5px", color: "var(--t-fff)", fontSize: "14px", fontWeight: 700, lineHeight: 1.2 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brandName}</span>
                        {c.brand_profiles?.verified && <VerifiedBadge size={13} />}
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={(e) => { e.stopPropagation(); toggleBookmark(c.id); }}
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", padding: "8px", margin: "-8px", flexShrink: 0 }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={bookmarked.includes(c.id) ? "var(--s-fff)" : "none"}>
                      <path d="M5 3H19C19.5523 3 20 3.44772 20 4V21L12 17L4 21V4C4 3.44772 4.44772 3 5 3Z" stroke={bookmarked.includes(c.id) ? "var(--s-fff)" : "var(--s-919191)"} strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {/* What it is, and when */}
                <p style={{ margin: 0, fontFamily: "'TikTok Sans', sans-serif", fontSize: "19px", fontWeight: 800, lineHeight: 1.25, color: "var(--t-fff)", marginBottom: "8px" }}>{c.name}</p>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--t-999)", marginBottom: "12px" }}>
                  Posted {formatRelativeTime(c.created_at, now)}
                  {c.deadline && (
                    <>
                      <span style={{ margin: "0 7px" }}>·</span>
                      Due <span style={{ color: "var(--t-fff)", fontWeight: 600 }}>{formatDeadline(c.deadline)}</span>
                    </>
                  )}
                </p>

                {c.platforms && c.platforms.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                    {c.platforms.map((p: string) => (
                      <span key={p} style={{ fontSize: "12px", padding: "4px 10px", border: "1px solid var(--c-222)", borderRadius: "20px", color: "var(--t-bbb)", background: "var(--c-0d0d0d)" }}>{p}</span>
                    ))}
                  </div>
                )}

                {/* What you get, and the way in */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderTop: "1px solid var(--c-1a1a1a)", paddingTop: "14px" }}>
                  <div>
                    {paid ? (
                      <>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--t-999)", marginBottom: "2px" }}>You'd earn</p>
                        <p style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--t-fff)", fontFamily: "'TikTok Sans', sans-serif", lineHeight: 1.1 }}>£{netCreatorPayout.toLocaleString()}</p>
                        <p style={{ margin: 0, fontSize: "11px", color: "var(--t-999)", marginTop: "3px" }}>{brandIsEnterprise ? "No platform fee" : "After the 10% platform fee"}</p>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--t-999)", marginBottom: "2px" }}>Reward</p>
                        <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--t-fff)", fontFamily: "'TikTok Sans', sans-serif", lineHeight: 1.2 }}>Gifted product</p>
                      </>
                    )}
                  </div>

                  {c.my_application ? (
                    <div style={{ padding: "9px 14px", borderRadius: "10px", background: "var(--c-111)", border: "1px solid var(--c-262626)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, ...getStatusStyle(c.my_application.status) }}>
                      {c.my_application.status}
                    </div>
                  ) : (
                    <div
                      onClick={() => navigateToApply && navigateToApply(c.id)}
                      style={{ padding: "13px 26px", background: "var(--c-fff)", color: "var(--t-0a0a0a)", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                    >
                      Apply
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </>
        )}
      </div>
      </div>
    </div>
  );
}