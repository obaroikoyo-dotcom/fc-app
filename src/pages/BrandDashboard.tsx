import React, { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props {
  navigate: (p: Page) => void;
  tab: "campaigns" | "post";
  setTab: (t: "campaigns" | "post") => void;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  budget: string;
  type: "gifted" | "paid";
  niche: string;
  platforms: string[];
  deadline: string;
  script: string;
  applications: number;
}

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitter/X", "Facebook", "Pinterest"];

export default function BrandDashboard({ navigate, tab, setTab }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", description: "", budget: "", type: "paid" as "paid" | "gifted", niche: "", deadline: "", script: "" });
  const [posted, setPosted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("campaigns").select("*, applications(count)").eq("brand_id", user.id).order("created_at", { ascending: false });
      if (data) setCampaigns(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const postCampaign = async () => {
    if (!form.name || !form.description) return;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("campaigns").insert({
        brand_id: user.id,
        ...form,
        platforms: selectedPlatforms,
        applications: 0,
      }).select().single();
      if (data) setCampaigns(prev => [data, ...prev]);
    }
    setForm({ name: "", description: "", budget: "", type: "paid", niche: "", deadline: "", script: "" });
    setSelectedPlatforms([]);
    setPosted(true);
    setPosting(false);
    setTimeout(() => { setPosted(false); setTab("campaigns"); }, 1500);
  };

  const inputStyle: React.CSSProperties = {
    background: "#111",
    border: "1px solid #222",
    borderRadius: "8px",
    padding: "11px 14px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#555",
    marginBottom: "6px",
    display: "block",
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px",
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

      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>
          {tab === "campaigns" ? "My Campaigns" : "Post Campaign"}
        </span>
        <span onClick={async () => { await supabase.auth.signOut(); navigate("role-select"); }} style={{ fontSize: "12px", color: "#555", cursor: "pointer" }}>Sign out</span>
      </div>

      <div style={{ flex: 1, padding: "1.25rem", overflowY: "auto", paddingBottom: "6rem" }}>

        {tab === "campaigns" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {loading ? (
              <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Loading...</p>
            ) : campaigns.length === 0 ? (
              <div style={{ border: "1px dashed #222", borderRadius: "16px", padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>No campaigns yet</p>
                <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.7 }}>Post your first campaign and start finding creators.</p>
                <div onClick={() => setTab("post")} style={{ marginTop: "1.5rem", padding: "12px", background: "#fff", color: "#0a0a0a", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Post a Campaign
                </div>
              </div>
            ) : (
              campaigns.map(c => (
                <div key={c.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, color: "#fff" }}>{c.name}</p>
                    <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", border: `1px solid ${c.type === "paid" ? "#fff" : "#444"}`, color: c.type === "paid" ? "#fff" : "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{c.type}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "#444", marginBottom: "12px", lineHeight: 1.5 }}>{c.description}</p>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "12px", color: "#555" }}>
                    {c.budget && <span>£{c.budget}</span>}
                    {c.niche && <span>{c.niche}</span>}
                    {c.deadline && <span>By {c.deadline}</span>}
                  </div>
                  {c.platforms?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                      {c.platforms.map(p => <span key={p} style={{ fontSize: "11px", padding: "3px 8px", border: "1px solid #222", borderRadius: "20px", color: "#444" }}>{p}</span>)}
                    </div>
                  )}
                  {c.script && (
                    <div style={{ marginTop: "12px", padding: "10px", background: "#0a0a0a", borderRadius: "8px", border: "1px solid #1a1a1a" }}>
                      <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Script</p>
                      <p style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{c.script}</p>
                    </div>
                  )}
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #1a1a1a", fontSize: "12px", color: "#444" }}>
                    {(c as any).applications?.[0]?.count || 0} application{((c as any).applications?.[0]?.count || 0) !== 1 ? "s" : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "post" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={labelStyle}>Campaign Name</label>
              <input style={inputStyle} placeholder="e.g. Summer Collection Launch" value={form.name} onChange={set("name")} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} placeholder="What do you need creators to do?" value={form.description} onChange={set("description")} />
            </div>
            <div>
              <label style={labelStyle}>Collab Type</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["paid", "gifted"] as const).map(t => (
                  <div key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={chipStyle(form.type === t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </div>
                ))}
              </div>
            </div>
            {form.type === "paid" && (
              <div>
                <label style={labelStyle}>Budget (£)</label>
                <input style={inputStyle} placeholder="e.g. 150" type="number" value={form.budget} onChange={set("budget")} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Niche / Category</label>
              <input style={inputStyle} placeholder="e.g. Beauty, Fashion, Fitness" value={form.niche} onChange={set("niche")} />
            </div>
            <div>
              <label style={labelStyle}>Platforms Needed</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PLATFORMS.map(p => <div key={p} onClick={() => togglePlatform(p)} style={chipStyle(selectedPlatforms.includes(p))}>{p}</div>)}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Deadline</label>
              <input style={inputStyle} type="date" value={form.deadline} onChange={set("deadline")} />
            </div>
            <div>
              <label style={labelStyle}>Script / Brief <span style={{ color: "#333", fontWeight: 400, fontSize: "10px", textTransform: "none", letterSpacing: 0 }}>optional</span></label>
              <textarea style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }} placeholder="Add talking points, dos and don'ts, or a full script..." value={form.script} onChange={set("script")} />
            </div>
            <div
              onClick={postCampaign}
              style={{ padding: "14px", borderRadius: "8px", background: posted ? "#1a1a1a" : "#fff", color: posted ? "#555" : "#0a0a0a", border: posted ? "1px solid #222" : "1px solid #fff", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
            >
              {posting ? "Posting..." : posted ? "Posted ✓" : "Post Campaign"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}