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
    followers?: number;
    rate?: number;
  } | null;
  brand_profiles?: {
    name: string;
    niche: string;
    location: string;
    avatar_url?: string;
    budget?: number;
  } | null;
}

export default function Search({ navigate, navigateToProfile }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "creators" | "brands">("all");
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Filter States
  const [selectedNiche, setSelectedNiche] = useState("");
  const [budgetRange, setBudgetRange] = useState(""); // "", "0-100", "100-500", "500+"
  const [followerTier, setFollowerTier] = useState(""); // Expanded below

  useEffect(() => {
    initDiscoveryHub();
  }, []);

  const initDiscoveryHub = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    let detectedRole = "creator";
    
    if (user) {
      const { data: roleData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
        
      if (roleData?.role) {
        detectedRole = roleData.role;
        setCurrentUserRole(roleData.role);
        setFilter(roleData.role === "brand" ? "creators" : "brands");
      }
    }

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(`*, creator_profiles(name, niche, location, available, hashtags, avatar_url, followers, rate), brand_profiles(name, niche, location, avatar_url, budget)`);

    if (!error && profiles) {
      setAllProfiles(profiles);
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

  // ==========================================
  // LIVE COMPUTATION AND CAP MATCHING ENGINE
  // ==========================================
  const filteredResults = allProfiles
    .filter((p) => {
      if (filter === "creators" && p.role !== "creator") return false;
      if (filter === "brands" && p.role !== "brand") return false;

      const name = p.creator_profiles?.name || p.brand_profiles?.name || "";
      const niche = p.creator_profiles?.niche || p.brand_profiles?.niche || "";
      const hashtags = p.creator_profiles?.hashtags || [];
      
      // 1. Keyword Check
      const qText = query.toLowerCase();
      const matchesText = !query.trim() || 
        name.toLowerCase().includes(qText) || 
        niche.toLowerCase().includes(qText) || 
        hashtags.some((h: string) => h.toLowerCase().includes(qText));

      // 2. Niche Check
      const matchesNiche = !selectedNiche || niche.toLowerCase() === selectedNiche.toLowerCase();

      // 3. Rate vs Budget Separation Logic
      let matchesFinance = true;
      if (budgetRange) {
        const financeVal = p.role === "creator" ? (p.creator_profiles?.rate || 0) : (p.brand_profiles?.budget || 0);
        if (budgetRange === "0-100") matchesFinance = financeVal >= 0 && financeVal <= 100;
        else if (budgetRange === "100-500") matchesFinance = financeVal > 100 && financeVal <= 500;
        else if (budgetRange === "500+") matchesFinance = financeVal > 500;
      }

      // 4. Detailed Follower Brackets
      let matchesFollowers = true;
      if (followerTier && p.role === "creator") {
        const followers = p.creator_profiles?.followers || 0;
        if (followerTier === "0-10k") matchesFollowers = followers >= 0 && followers <= 10000;
        else if (followerTier === "10k-50k") matchesFollowers = followers > 10000 && followers <= 50000;
        else if (followerTier === "50k-100k") matchesFollowers = followers > 50000 && followers <= 100000;
        else if (followerTier === "100k-1m") matchesFollowers = followers > 100000 && followers <= 1000000;
        else if (followerTier === "1m+") matchesFollowers = followers > 1000000;
      }

      return matchesText && matchesNiche && matchesFinance && matchesFollowers;
    })
    // Locks layout to the top 10 matches at all times
    .slice(0, 10);

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

      {/* Control Module Header */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Discovery Hub</span>

        {/* Input Field */}
        <div style={{ display: "flex", gap: "8px", marginTop: "1rem" }}>
          <input
            style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit" }}
            placeholder={filter === "creators" ? "Search active creators..." : "Search registered brands..."}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Filters Panel Row */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(["all", "creators", "brands"] as const).map(f => (
              <div key={f} onClick={() => setFilter(f)} style={chipStyle(filter === f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </div>
            ))}
          </div>

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
              <option value="">{filter === "creators" ? "Any Rate" : "Any Budget"}</option>
              <option value="0-100">£0 - £100</option>
              <option value="100-500">£100 - £500</option>
              <option value="500+">£500+</option>
            </select>

            {filter !== "brands" && (
              <select value={followerTier} onChange={e => setFollowerTier(e.target.value)} style={selectDropdownStyle}>
                <option value="">Any Followers</option>
                <option value="0-10k">0 - 10k</option>
                <option value="10k-50k">10k - 50k</option>
                <option value="50k-100k">50k - 100k</option>
                <option value="100k-1m">100k - 1M</option>
                <option value="1m+">1M+</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Feed Area */}
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
          <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Loading marketplace index...</p>
        ) : filteredResults.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "4rem", padding: "0 2rem" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>No results found</p>
            <p style={{ fontSize: "13px", color: "#444" }}>Try scaling back your active filter fields.</p>
          </div>
        ) : (
          filteredResults.map(p => {
            const name = p.creator_profiles?.name || p.brand_profiles?.name || p.email;
            const niche = p.creator_profiles?.niche || p.brand_profiles?.niche || "General";
            const location = p.creator_profiles?.location || p.brand_profiles?.location || "";
            const available = p.creator_profiles?.available;
            const followersCount = p.creator_profiles?.followers;
            const rateCost = p.role === "creator" ? p.creator_profiles?.rate : p.brand_profiles?.budget;
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
                      <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "20px", border: `1px solid ${available ? "#fff" : "#333"}`, color: available ? "#fff" : "#444" }}>
                        {available ? "Open" : "Busy"}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: "#444", marginTop: "2px" }}>
                    {niche}{location ? ` · ${location}` : ""}
                    {isCreator && followersCount !== undefined ? ` · ${followersCount.toLocaleString()} followers` : ""}
                  </p>
                  {rateCost !== undefined && (
                    <p style={{ fontSize: "11px", color: "#fff", fontWeight: 500, marginTop: "2px" }}>
                      {isCreator ? `Rate: £${rateCost}` : `Budget: £${rateCost}`}
                    </p>
                  )}
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