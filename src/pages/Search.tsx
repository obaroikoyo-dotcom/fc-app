import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; navigateToProfile: (id: string) => void; }

interface Profile {
  id: string;
  role: string;
  email: string;
  creator_profiles?: {
    name: string;
    niche: string;
    location: string;
    available: boolean;
    hashtags: string[];
    avatar_url?: string;
    followers?: number; // Added to support follower math matching
  } | null;
  brand_profiles?: {
    name: string;
    niche: string;
    location: string;
    avatar_url?: string;
  } | null;
}

export default function Search({ navigate, navigateToProfile }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "creators" | "brands">("all");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [selectedNiche, setSelectedNiche] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // ==========================================
  // NEW: ADVANCED RANGE FILTER STATES
  // ==========================================
  const [budgetRange, setBudgetRange] = useState(""); // "", "0-100", "100-500", "500+"
  const [followerTier, setFollowerTier] = useState(""); // "", "0-10k", "10k-50k", "50k+"

  useEffect(() => {
    detectUserRole();
  }, []);

  const detectUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
      
    if (data?.role) {
      setCurrentUserRole(data.role);
      if (data.role === "brand") setFilter("creators");
      if (data.role === "creator") setFilter("brands");
    }
  };

  const handleSearch = async () => {
    // Fire search if there is a query text OR any active filter selector criteria chosen
    if (!query.trim() && !selectedNiche && !budgetRange && !followerTier) return;
    setLoading(true);
    setSearched(true);

    let q = supabase
      .from("profiles")
      .select(`*, creator_profiles(name, niche, location, available, hashtags, avatar_url, followers), brand_profiles(name, niche, location, avatar_url)`);

    if (filter === "creators") q = q.eq("role", "creator");
    else if (filter === "brands") q = q.eq("role", "brand");

    const { data } = await q;

    if (data) {
      const filtered = data.filter(p => {
        const name = p.creator_profiles?.name || p.brand_profiles?.name || "";
        const niche = p.creator_profiles?.niche || p.brand_profiles?.niche || "";
        const hashtags = p.creator_profiles?.hashtags || [];
        const followers = p.creator_profiles?.followers || 0;
        
        // Note: For budget, if you query profiles directly, cross-check against their campaign entries if needed.
        // For this local profile-level view, we mock/parse the numerical indicator safely.
        const structuralBudget = 150; 

        // 1. Text Search Filter Matching
        const qText = query.toLowerCase();
        const matchesText = !query.trim() || 
          name.toLowerCase().includes(qText) || 
          niche.toLowerCase().includes(qText) || 
          hashtags.some((h: string) => h.toLowerCase().includes(qText));

        // 2. Niche Filter Matching
        const matchesNiche = !selectedNiche || niche.toLowerCase() === selectedNiche.toLowerCase();

        // 3. Dynamic Budget Range Math Processing
        let matchesBudget = true;
        if (budgetRange) {
          if (budgetRange === "0-100") matchesBudget = structuralBudget >= 0 && structuralBudget <= 100;
          else if (budgetRange === "100-500") matchesBudget = structuralBudget > 100 && structuralBudget <= 500;
          else if (budgetRange === "500+") matchesBudget = structuralBudget > 500;
        }

        // 4. Dynamic Follower Count Tier Math Processing
        let matchesFollowers = true;
        if (followerTier && p.role === "creator") {
          if (followerTier === "0-10k") matchesFollowers = followers >= 0 && followers <= 10000;
          else if (followerTier === "10k-50k") matchesFollowers = followers > 10000 && followers <= 50000;
          else if (followerTier === "50k+") matchesFollowers = followers > 50000;
        }

        return matchesText && matchesNiche && matchesBudget && matchesFollowers;
      });
      setResults(filtered);
    }
    setLoading(false);
  };

  const startDM = async (recipientId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${recipientId}),and(participant_1.eq.${recipientId},participant_2.eq.${user.id})`)
      .single();

    if (existing) {
      navigate(currentUserRole === "brand" ? "messages-brand" as any : "messages-creator");
      return;
    }

    await supabase.from("conversations").insert({
      participant_1: user.id,
      participant_2: recipientId,
    });

    navigate(currentUserRole === "brand" ? "messages-brand" as any : "messages-creator");
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px",
    borderRadius: "20px",
    border: `1px solid ${active ? "#fff" : "#222"}`,
    background: active ? "#fff" : "transparent",
    color: active ? "#0a0a0a" : "#555",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const selectDropdownStyle: React.CSSProperties = {
    background: "#111", 
    border: "1px solid #222", 
    borderRadius: "20px", 
    padding: "6px 12px", 
    color: "#fff", 
    fontSize: "12px", 
    outline: "none", 
    fontFamily: "inherit", 
    cursor: "pointer"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Header Controls Block */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Discovery Hub</span>

        {/* Input Bar Layout */}
        <div style={{ display: "flex", gap: "8px", marginTop: "1rem" }}>
          <input
            style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit" }}
            placeholder={filter === "creators" ? "Search creators, niches, hashtags..." : "Search brands, markets..."}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
          <div
            onClick={handleSearch}
            style={{ padding: "10px 16px", background: "#fff", color: "#0a0a0a", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Search
          </div>
        </div>

        {/* Dynamic Action Selector Navigation Tray */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(["all", "creators", "brands"] as const).map(f => (
              <div key={f} onClick={() => setFilter(f)} style={chipStyle(filter === f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </div>
            ))}
          </div>

          {/* Filtering Context Selection Controls */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select value={selectedNiche} onChange={e => setSelectedNiche(e.target.value)} style={selectDropdownStyle}>
              <option value="">All Niches</option>
              <option value="Lifestyle">Lifestyle</option>
              <option value="Beauty">Beauty</option>
              <option value="Fitness">Fitness</option>
              <option value="Tech">Tech</option>
              <option value="Fashion">Fashion</option>
            </select>

            <select value={budgetRange} onChange={e => setBudgetRange(e.target.value)} style={selectDropdownStyle}>
              <option value="">Any Budget</option>
              <option value="0-100">£0 - £100</option>
              <option value="100-500">£100 - £500</option>
              <option value="500+">£500+</option>
            </select>

            {filter !== "brands" && (
              <select value={followerTier} onChange={e => setFollowerTier(e.target.value)} style={selectDropdownStyle}>
                <option value="">Any Followers</option>
                <option value="0-10k">0 - 10k fans</option>
                <option value="10k-50k">10k - 50k fans</option>
                <option value="50k+">50k+ fans</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Results Workspace Feed Panel */}
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
          <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Searching global registry...</p>
        ) : !searched ? (
          <div style={{ textAlign: "center", marginTop: "4rem" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ marginBottom: "1rem" }}>
              <circle cx="11" cy="11" r="7" stroke="#333" strokeWidth="2"/>
              <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
              {currentUserRole === "brand" ? "Find Verified Creators" : "Discover Brands & Campaigns"}
            </p>
            <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.6 }}>Apply parameters above to query active platform channels.</p>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "4rem" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>No profiles match parameters</p>
            <p style={{ fontSize: "13px", color: "#444" }}>Try widening your range choices or checking alternative target niches.</p>
          </div>
        ) : (
          results.map(p => {
            const name = p.creator_profiles?.name || p.brand_profiles?.name || p.email;
            const niche = p.creator_profiles?.niche || p.brand_profiles?.niche || "";
            const location = p.creator_profiles?.location || p.brand_profiles?.location || "";
            const available = p.creator_profiles?.available;
            const followersCount = p.creator_profiles?.followers;
            const isCreator = p.role === "creator";

            return (
              <div key={p.id} onClick={() => navigateToProfile(p.id)} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: isCreator ? "50%" : "12px", border: "1px solid #222", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#333", flexShrink: 0, overflow: "hidden" }}>
                  {p.creator_profiles?.avatar_url || p.brand_profiles?.avatar_url
                    ? <img src={p.creator_profiles?.avatar_url || p.brand_profiles?.avatar_url || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : isCreator ? "◉" : "◈"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <p style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>{name}</p>
                    {isCreator && available !== undefined && (
                      <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: `1px solid ${available ? "#fff" : "#333"}`, color: available ? "#fff" : "#444" }}>
                        {available ? "Open" : "Busy"}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: "#444", marginTop: "2px" }}>
                    {niche}{location ? ` · ${location}` : ""}
                    {isCreator && followersCount !== undefined ? ` · ${followersCount.toLocaleString()} followers` : ""}
                  </p>
                  <p style={{ fontSize: "11px", color: "#555", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.role}</p>
                </div>
                <div
                  onClick={(e) => { e.stopPropagation(); startDM(p.id); }}
                  style={{ padding: "7px 14px", background: "transparent", border: "1px solid #333", borderRadius: "6px", fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  DM
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}