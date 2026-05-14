import { useState } from "react";
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

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    let q = supabase
      .from("profiles")
      .select(`*, creator_profiles(name, niche, location, available, hashtags, avatar_url), brand_profiles(name, niche, location, avatar_url)`);

    if (filter === "creators") q = q.eq("role", "creator");
    else if (filter === "brands") q = q.eq("role", "brand");

    const { data } = await q;

    if (data) {
      const filtered = data.filter(p => {
        const name = p.creator_profiles?.name || p.brand_profiles?.name || "";
        const niche = p.creator_profiles?.niche || p.brand_profiles?.niche || "";
        const hashtags = p.creator_profiles?.hashtags || [];
        const q = query.toLowerCase();
        return name.toLowerCase().includes(q) || niche.toLowerCase().includes(q) || hashtags.some((h: string) => h.toLowerCase().includes(q));
      });
      setResults(filtered);
    }
    setLoading(false);
  };

  const startDM = async (recipientId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${recipientId}),and(participant_1.eq.${recipientId},participant_2.eq.${user.id})`)
      .single();

    if (existing) {
      navigate("messages-creator");
      return;
    }

    await supabase.from("conversations").insert({
      participant_1: user.id,
      participant_2: recipientId,
    });

    navigate("messages-creator");
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

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Search</span>

        {/* Search Input */}
        <div style={{ display: "flex", gap: "8px", marginTop: "1rem" }}>
          <input
            style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit" }}
            placeholder="Search creators, brands, niches..."
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

        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          {(["all", "creators", "brands"] as const).map(f => (
            <div key={f} onClick={() => setFilter(f)} style={chipStyle(filter === f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
          <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Searching...</p>
        ) : !searched ? (
          <div style={{ textAlign: "center", marginTop: "4rem" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ marginBottom: "1rem" }}>
  <circle cx="11" cy="11" r="7" stroke="#333" strokeWidth="2"/>
  <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
</svg>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>Find people</p>
            <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.6 }}>Search by name, niche, or hashtag</p>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "4rem" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>No results</p>
            <p style={{ fontSize: "13px", color: "#444" }}>Try a different search term.</p>
          </div>
        ) : (
          results.map(p => {
            const name = p.creator_profiles?.name || p.brand_profiles?.name || p.email;
            const niche = p.creator_profiles?.niche || p.brand_profiles?.niche || "";
            const location = p.creator_profiles?.location || p.brand_profiles?.location || "";
            const available = p.creator_profiles?.available;
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
                        {available ? "Open" : "Unavailable"}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: "#444", marginTop: "2px" }}>{niche}{location ? ` · ${location}` : ""}</p>
                  <p style={{ fontSize: "11px", color: "#555", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.role}</p>
                </div>
                <div
                  onClick={() => startDM(p.id)}
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