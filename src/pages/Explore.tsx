import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props { navigate: (p: Page) => void; }

interface Campaign {
  id: string;
  name: string;
  description: string;
  budget: string;
  type: "paid" | "gifted";
  niche: string;
  platforms: string[];
  deadline: string;
  script: string;
  applications: number;
  brand_profiles: {
    name: string;
    niche: string;
  } | null;
}

export default function Explore({ navigate }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select(`*, brand_profiles(name, niche)`)
      .order("created_at", { ascending: false });

    if (!error && data) setCampaigns(data);
    setLoading(false);
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
      await supabase.from("campaigns").update({ applications: (selected.applications || 0) + 1 }).eq("id", selected.id);
      setApplied(prev => [...prev, selected.id]);
    }
    setSubmitting(false);
    setShowSheet(false);
  };

  const inputStyle: React.CSSProperties = {
    background: "#0a0a0a",
    border: "1px solid #222",
    borderRadius: "8px",
    padding: "11px 14px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
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
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Explore</span>
        <div onClick={() => navigate("creator-profile")} style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", color: "#fff" }}>◉</div>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto", paddingBottom: "6rem", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <p style={{ color: "#444", fontSize: "13px" }}>Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ border: "1px dashed #222", borderRadius: "16px", padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
            <div style={{ fontSize: "36px", marginBottom: "1rem" }}>◎</div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>No opportunities yet</p>
            <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.7, maxWidth: "260px", margin: "0 auto" }}>Brand campaigns will appear here. Check back soon.</p>
          </div>
        ) : (
          campaigns.map(c => (
            <div key={c.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #222", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#333", flexShrink: 0 }}>◈</div>
                  <div>
                    <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, lineHeight: 1 }}>{c.brand_profiles?.name || "Brand"}</p>
                    <p style={{ color: "#444", fontSize: "11px", marginTop: "3px" }}>{c.niche}</p>
                  </div>
                </div>
                <span style={{ fontSize: "10px", padding: "3px 9px", borderRadius: "20px", border: "1px solid #333", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {c.type}{c.budget ? ` · £${c.budget}` : ""}
                </span>
              </div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>{c.name}</p>
              <p style={{ fontSize: "12px", color: "#555", lineHeight: 1.5, marginBottom: "10px" }}>{c.description}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "#444" }}>
                  {c.deadline && <span>📅 {c.deadline}</span>}
                  <span>👥 {c.applications || 0}</span>
                </div>
                <div
                  onClick={() => !applied.includes(c.id) && openSheet(c)}
                  style={{ padding: "7px 16px", background: applied.includes(c.id) ? "#1a1a1a" : "#fff", color: applied.includes(c.id) ? "#555" : "#0a0a0a", border: applied.includes(c.id) ? "1px solid #222" : "1px solid #fff", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: applied.includes(c.id) ? "default" : "pointer", letterSpacing: "0.05em", textTransform: "uppercase", transition: "all 0.2s" }}
                >
                  {applied.includes(c.id) ? "Applied ✓" : "Apply"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ borderTop: "1px solid #111", display: "flex", padding: "1rem 0", background: "#0a0a0a", position: "fixed", bottom: 0, width: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
          <span style={{ fontSize: "20px" }}>◎</span>
          <span style={{ fontSize: "10px", color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>Explore</span>
        </div>
        <div onClick={() => navigate("messages-creator")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
          <span style={{ fontSize: "20px" }}>💬</span>
          <span style={{ fontSize: "10px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Messages</span>
        </div>
        <div onClick={() => navigate("creator-profile")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
          <span style={{ fontSize: "20px" }}>◉</span>
          <span style={{ fontSize: "10px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Profile</span>
        </div>
      </div>

      {/* Overlay */}
      {showSheet && <div onClick={() => setShowSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10 }} />}

      {/* Apply Sheet */}
      {selected && (
        <div style={{ position: "fixed", bottom: showSheet ? 0 : "-100%", left: 0, right: 0, background: "#111", borderTop: "1px solid #222", borderRadius: "20px 20px 0 0", padding: "1.5rem 1.25rem 2.5rem", zIndex: 20, transition: "bottom 0.3s ease", maxHeight: "85vh", overflowY: "auto" }}>
          <div style={{ width: "36px", height: "4px", background: "#333", borderRadius: "2px", margin: "0 auto 1.5rem" }} />
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Apply to {selected.name}</p>
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "1.5rem" }}>{selected.brand_profiles?.name || "Brand"}</p>

          {selected.script && (
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>📋 Brief / Script</p>
              <p style={{ fontSize: "12px", color: "#777", lineHeight: 1.7, whiteSpace: "pre-line" }}>{selected.script}</p>
            </div>
          )}

          {selected.platforms?.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Platforms you'll post on</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {selected.platforms.map(p => <div key={p} onClick={() => togglePlatform(p)} style={chipStyle(selectedPlatforms.includes(p))}>{p}</div>)}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Message to brand</p>
            <textarea style={{ ...inputStyle, minHeight: "100px", resize: "none" }} placeholder="Introduce yourself and why you're a good fit..." value={message} onChange={e => setMessage(e.target.value)} />
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