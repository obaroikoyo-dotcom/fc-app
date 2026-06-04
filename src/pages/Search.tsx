import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; navigateToProfile: (id: string) => void; navigateToMessages: (p: "messages-creator" | "messages-brand", convoId: string) => void; }
interface Profile {
  id: string; role: string; email: string;
  creator_profiles?: { name: string; niche: string; location: string; available: boolean; hashtags: string[]; avatar_url?: string; followers?: number; rate?: number; } | null;
  brand_profiles?: { name: string; niche: string; location: string; avatar_url?: string; budget?: number; } | null;
}

const UI = {
  input: { background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" },
  dropdown: { background: "#111", border: "1px solid #222", borderRadius: "20px", padding: "6px 12px", color: "#fff", fontSize: "12px", outline: "none", fontFamily: "inherit", cursor: "pointer" },
  chip: (act: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: "20px", border: `1px solid ${act ? "#fff" : "#222"}`, background: act ? "#fff" : "transparent", color: act ? "#0a0a0a" : "#555", fontSize: "12px", fontWeight: 500, cursor: "pointer" })
};

export default function Search({ navigateToProfile, navigateToMessages }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "creators" | "brands">("all");
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [niche, setNiche] = useState("");
  const [budget, setBudget] = useState("");
  const [followers, setFollowers] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (data?.role) { 
          setUserRole(data.role); 
          setFilter(data.role === "brand" ? "creators" : "brands"); 
        }
      }
      const { data: profiles } = await supabase.from("profiles").select(`*, creator_profiles(*), brand_profiles(*)`);
      if (profiles) setAllProfiles(profiles);
      setLoading(false);
    })();
  }, []);

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

  const filtered = allProfiles.filter(p => {
    if (filter === "creators" && p.role !== "creator") return false;
    if (filter === "brands" && p.role !== "brand") return false;

    const cp = p.creator_profiles, bp = p.brand_profiles;
    const name = cp?.name || bp?.name || "", nch = cp?.niche || bp?.niche || "", txt = query.toLowerCase();
    
    if (query && !name.toLowerCase().includes(txt) && !nch.toLowerCase().includes(txt) && !(cp?.hashtags || []).some(h => h.toLowerCase().includes(txt))) return false;
    if (niche && nch.toLowerCase() !== niche.toLowerCase()) return false;

    if (budget) {
      const val = p.role === "creator" ? (cp?.rate || 0) : (bp?.budget || 0);
      if (budget === "0-100" && (val < 0 || val > 100)) return false;
      if (budget === "100-500" && (val <= 100 || val > 500)) return false;
      if (budget === "500+" && val <= 500) return false;
    }

    if (followers && p.role === "creator") {
      const fCount = cp?.followers || 0;
      if (followers === "0-10k" && fCount > 10000) return false;
      if (followers === "10k-50k" && (fCount <= 10000 || fCount > 50000)) return false;
      if (followers === "50k-100k" && (fCount <= 50000 || fCount > 100000)) return false;
      if (followers === "100k-1m" && (fCount <= 100000 || fCount > 1000000)) return false;
      if (followers === "1m+" && fCount <= 1000000) return false;
    }
    return true;
  }).slice(0, 10);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #111" }}>
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
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select value={niche} onChange={e => setNiche(e.target.value)} style={UI.dropdown}>
              <option value="">All Niches</option>
              {["Lifestyle", "Beauty", "Fitness", "Tech", "Fashion"].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={budget} onChange={e => setBudget(e.target.value)} style={UI.dropdown}>
              <option value="">{filter === "creators" ? "Any Rate" : "Any Budget"}</option>
              <option value="0-100">£0 - £100</option><option value="100-500">£100 - £500</option><option value="500+">£500+</option>
            </select>
            {filter !== "brands" && (
              <select value={followers} onChange={e => setFollowers(e.target.value)} style={UI.dropdown}>
                <option value="">Any Followers</option>
                {["0-10k", "10k-50k", "50k-100k", "100k-1m", "1m+"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Loading...</p> : 
         filtered.length === 0 ? <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>No results.</p> : 
         filtered.map(p => {
           const isC = p.role === "creator", cp = p.creator_profiles, bp = p.brand_profiles;
           return (
             <div key={p.id} onClick={() => navigateToProfile(p.id)} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
               <div style={{ width: "44px", height: "44px", borderRadius: isC ? "50%" : "12px", border: "1px solid #222", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                 {cp?.avatar_url || bp?.avatar_url ? <img src={cp?.avatar_url || bp?.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : isC ? "◉" : "◈"}
               </div>
               <div style={{ flex: 1, minWidth: 0 }}>
                 <p style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>{cp?.name || bp?.name || p.email}</p>
                 <p style={{ fontSize: "12px", color: "#444", marginTop: "2px" }}>{cp?.niche || bp?.niche || "General"}{isC && cp?.followers ? ` · ${cp.followers.toLocaleString()} fans` : ""}</p>
                 {(isC ? cp?.rate : bp?.budget) && <p style={{ fontSize: "11px", color: "#fff", fontWeight: 500, marginTop: "2px" }}>{isC ? "Rate" : "Budget"}: £{isC ? cp?.rate : bp?.budget}</p>}
               </div>
               <div onClick={e => { e.stopPropagation(); startDM(p.id); }} style={{ padding: "7px 14px", border: "1px solid #333", borderRadius: "6px", fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer" }}>DM</div>
             </div>
           );
         })}
      </div>
    </div>
  );
}