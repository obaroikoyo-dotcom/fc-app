import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";
import { useRefetchOnVisible } from "../lib/useRefetchOnVisible";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { useHasLoadedOnce } from "../lib/useHasLoadedOnce";
import { getBlockedUserIds } from "../lib/blocks";
import VerifiedBadge from "../components/VerifiedBadge";
import { usePersistedState } from "../lib/usePersistedState";
import { useScrollRestoration } from "../lib/useScrollRestoration";

interface Props { navigate: (p: Page) => void; navigateToProfile: (id: string) => void; navigateToMessages: (p: "messages-creator" | "messages-brand", convoId: string) => void; }
interface Profile {
  id: string; role: string;
  creator_profiles?: { name: string; niche: string; location: string; available: boolean; hashtags: string[]; avatar_url?: string; follower_counts?: Record<string, string>; rates?: { post?: string; story?: string; reel?: string; video?: string; ugc?: string }; } | null;
  brand_profiles?: { name: string; niche: string; location: string; avatar_url?: string; verified?: boolean; } | null;
}

// follower_counts is a per-platform map ("Instagram" -> "12000"), not a
// single number - this is the actual highest count across platforms.
function maxFollowers(cp: Profile["creator_profiles"]): number {
  const counts = Object.values(cp?.follower_counts || {}).map(v => Number(v) || 0);
  return counts.length ? Math.max(...counts) : 0;
}

function startingRate(cp: Profile["creator_profiles"]): number | null {
  const rates = [cp?.rates?.post, cp?.rates?.story, cp?.rates?.reel, cp?.rates?.video, cp?.rates?.ugc]
    .map(v => (v ? Number(v) : null))
    .filter((v): v is number => v != null && !isNaN(v));
  return rates.length ? Math.min(...rates) : null;
}

const UI = {
  input: { background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" },
  chip: (act: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: "20px", border: `1px solid ${act ? "#fff" : "#222"}`, background: act ? "#fff" : "transparent", color: act ? "#0a0a0a" : "#555", fontSize: "12px", fontWeight: 500, cursor: "pointer" })
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

export default function Search({ navigateToProfile, navigateToMessages }: Props) {
  const [query, setQuery] = usePersistedState("fc_search_query", "");
  const [filter, setFilter] = usePersistedState<"all" | "creators" | "brands">("fc_search_filter", "all");
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [niche, setNiche] = usePersistedState("fc_search_niche", "");
  const [followers, setFollowers] = usePersistedState("fc_search_followers", "");
  const [sortBy, setSortBy] = usePersistedState("fc_search_sortby", "");
  const [visibleCount, setVisibleCount] = useState(10);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(210);
  const scrollRef = useScrollRestoration("fc_search_scroll", !loading);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      await withTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
          if (data?.role) {
            setUserRole(data.role);
          }
        }
        const { data: profiles } = await supabase.from("profiles").select(`id, role, creator_profiles(name, niche, location, available, hashtags, avatar_url, follower_counts, rates), brand_profiles(name, niche, location, avatar_url, verified)`);
        if (profiles) {
          const blockedIds = user ? await getBlockedUserIds(user.id) : [];
          // supabase-js can't tell this is a one-to-one relation without
          // generated DB types, so it infers creator_profiles/brand_profiles
          // as arrays - at runtime (and everywhere this is read below,
          // e.g. p.creator_profiles?.name) it's actually a single object.
          setAllProfiles((profiles as unknown as Profile[]).filter(p => !blockedIds.includes(p.id)));
        }
      }, 10000, "Search.loadProfiles");
    } catch (err) {
      console.error("Failed to load profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfiles(); }, []);
  useRefetchOnVisible(loadProfiles, loading);

  const startDM = async (recId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase.from("conversations").select("id").or(`and(participant_1.eq.${user.id},participant_2.eq.${recId}),and(participant_1.eq.${recId},participant_2.eq.${user.id})`).single();
    let convoId: string;
    if (existing) {
      convoId = existing.id;
    } else {
      const { data: newConvo } = await supabase.from("conversations").insert({ participant_1: user.id, participant_2: recId }).select().single();
      convoId = newConvo!.id;
    }
    navigateToMessages(userRole === "brand" ? "messages-brand" : "messages-creator", convoId);
  };

  const filteredAll = allProfiles.filter(p => {
    if (filter === "creators" && p.role !== "creator") return false;
    if (filter === "brands" && p.role !== "brand") return false;

    const cp = p.creator_profiles, bp = p.brand_profiles;
    const name = cp?.name || bp?.name || "", nch = cp?.niche || bp?.niche || "", txt = query.toLowerCase();

    if (query && !name.toLowerCase().includes(txt) && !nch.toLowerCase().includes(txt) && !(cp?.hashtags || []).some(h => h.toLowerCase().includes(txt))) return false;
    if (niche && nch.toLowerCase() !== niche.toLowerCase()) return false;

    if (followers && p.role === "creator") {
      const fCount = maxFollowers(cp);
      if (followers === "0-10k" && fCount > 10000) return false;
      if (followers === "10k-50k" && (fCount <= 10000 || fCount > 50000)) return false;
      if (followers === "50k-100k" && (fCount <= 50000 || fCount > 100000)) return false;
      if (followers === "100k-1m" && (fCount <= 100000 || fCount > 1000000)) return false;
      if (followers === "1m+" && fCount <= 1000000) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === "followers") return maxFollowers(b.creator_profiles) - maxFollowers(a.creator_profiles);
    if (sortBy === "name") return (a.creator_profiles?.name || a.brand_profiles?.name || "").localeCompare(b.creator_profiles?.name || b.brand_profiles?.name || "");
    return 0;
  });
  // Slicing a batch at a time instead of rendering the whole filtered set
  // keeps the DOM light regardless of how large the underlying table gets -
  // everything past visibleCount is already computed, just not rendered yet,
  // so "Load More" reveals instantly with no fetch/recompute.
  const filtered = filteredAll.slice(0, visibleCount);
  useEffect(() => { setVisibleCount(10); }, [query, filter, niche, followers, sortBy]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap'); @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>

      <div ref={headerRef} style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Discovery Hub</span>
        <div style={{ marginTop: "1rem" }}>
          <input style={UI.input} placeholder={filter === "creators" ? "Search creators..." : "Search brands..."} value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(["all", "creators", "brands"] as const).map(f => (
              <div key={f} onClick={() => setFilter(f)} style={UI.chip(filter === f)}>{f.toUpperCase()}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <CustomDropdown value={niche} onChange={setNiche} options={["Lifestyle", "Beauty", "Fitness", "Tech", "Fashion"]} placeholder="All Niches" />
            {filter !== "brands" && (
              <CustomDropdown value={followers} onChange={setFollowers} options={["0-10k", "10k-50k", "50k-100k", "100k-1m", "1m+"]} placeholder="Any Followers" />
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <CustomDropdown
              value={sortBy === "followers" ? "Most Followers" : sortBy === "name" ? "Name A-Z" : ""}
              onChange={v => setSortBy(v === "Most Followers" ? "followers" : v === "Name A-Z" ? "name" : "")}
              options={filter !== "brands" ? ["Most Followers", "Name A-Z"] : ["Name A-Z"]}
              placeholder="Sort"
            />
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", paddingTop: `${headerHeight + 16}px`, display: "flex", flexDirection: "column", gap: "10px" }}>
        {!hasLoadedOnce && showSkeleton ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#1a1a1a", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ width: "120px", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  <div style={{ width: "80px", height: "11px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
                </div>
                <div style={{ width: "48px", height: "30px", borderRadius: "6px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
              </div>
            ))}
          </div>
        ) : !hasLoadedOnce && loading ? null : filtered.length === 0 ? (
          <p style={{ color: "#888", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>No results.</p>
        ) : (
          filtered.map((p, i) => {
            const isC = p.role === "creator", cp = p.creator_profiles, bp = p.brand_profiles;
            return (
              <div key={p.id} onClick={() => navigateToProfile(p.id)} className="item-enter" style={{ animationDelay: `${Math.min(i, 10) * 40}ms`, background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: isC ? "50%" : "12px", border: "1px solid #222", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {cp?.avatar_url || bp?.avatar_url ? <img src={cp?.avatar_url || bp?.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : isC ? "◉" : "◈"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ display: "flex", alignItems: "center", gap: "5px", color: "#fff", fontSize: "14px", fontWeight: 600 }}>
                    {cp?.name || bp?.name || "FlipCollab User"}
                    {!isC && bp?.verified && <VerifiedBadge size={13} />}
                  </p>
                  <p style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>{cp?.niche || bp?.niche || "General"}{isC && maxFollowers(cp) > 0 ? ` · ${maxFollowers(cp).toLocaleString()} fans` : ""}</p>
                  {isC && startingRate(cp) != null && <p style={{ fontSize: "11px", color: "#fff", fontWeight: 500, marginTop: "2px" }}>From £{startingRate(cp)}</p>}
                </div>
                <div onClick={e => { e.stopPropagation(); startDM(p.id); }} style={{ padding: "7px 14px", border: "1px solid #333", borderRadius: "6px", fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer" }}>DM</div>
              </div>
            );
          })
        )}
        {filtered.length > 0 && filteredAll.length > filtered.length && (
          <div onClick={() => setVisibleCount(c => c + 10)} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #222", textAlign: "center", fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer", marginTop: "4px" }}>
            Load More ({filteredAll.length - filtered.length} more)
          </div>
        )}
      </div>
    </div>
  );
}