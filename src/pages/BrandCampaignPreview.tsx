import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { useHasLoadedOnce } from "../lib/useHasLoadedOnce";

interface Props {
  navigate: (p: Page) => void;
  campaignId: string;
  goBack: () => void;
}

interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  budget: string;
  type: "paid" | "gifted";
  script: string;
  video_required: boolean;
  platforms: string[];
  vibe: string;
  objective: string;
  niche: string;
  deadline: string;
  deliverables: string[];
  dos: string[];
  donts: string[];
  promo_code: string;
  landing_link: string;
  utm_code: string;
  asset_logos: string[];
  asset_overlays: string[];
  asset_style_videos: string[];
  asset_broll: string[];
  brand_profiles: { name: string; logo_url?: string; is_enterprise?: boolean } | null;
}

// Read-only mirror of ApplyCampaign.tsx's layout so a brand sees exactly
// what a creator sees when they open this campaign - same sections, same
// styling - minus the application form, which only a creator can submit.
export default function BrandCampaignPreview({ campaignId, goBack }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);
  const hasLoadedOnce = useHasLoadedOnce(loading);

  useEffect(() => {
    const load = async () => {
      try {
        await withTimeout(async () => {
          const { data } = await supabase
            .from("campaigns")
            .select("*, brand_profiles(name, logo_url, is_enterprise)")
            .eq("id", campaignId)
            .single();
          if (data) setCampaign(data);
        }, 10000, "BrandCampaignPreview.load");
      } catch (err) {
        console.error("Failed to load campaign:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [campaignId]);

  if (loading && !hasLoadedOnce && !showSkeleton) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;
  }

  if (loading && !hasLoadedOnce) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100, paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
        <div style={{ width: "20px", height: "20px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
        <div style={{ width: "120px", height: "18px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
      </div>
      <div style={{ padding: "1.5rem 1.25rem", paddingTop: "calc(5rem + env(safe-area-inset-top, 0px))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "#1a1a1a", flexShrink: 0, animation: "shimmer 1.5s ease-in-out infinite" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ width: "140px", height: "20px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
            <div style={{ width: "100px", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ width: "100%", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
          <div style={{ width: "85%", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
          <div style={{ width: "90%", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );

  if (!campaign) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#999", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Campaign not found.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100, paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div onClick={goBack} style={{ cursor: "pointer", color: "#999", fontSize: "20px", lineHeight: 1 }}>←</div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff" }}>Campaign Preview</span>
        </div>
        <span style={{ fontSize: "9px", padding: "4px 9px", borderRadius: "20px", background: "rgba(255,255,255,0.06)", border: "1px solid #262626", color: "#999", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>
          What creators see
        </span>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem", paddingTop: "calc(5rem + env(safe-area-inset-top, 0px))" }}>

        {/* Campaign title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {campaign.brand_profiles?.logo_url && (
              <img src={campaign.brand_profiles.logo_url} style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", background: "#111", border: "1px solid #1a1a1a", flexShrink: 0 }} />
            )}
            <div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>{campaign.name}</p>
              <p style={{ fontSize: "12px", color: "#888" }}>{campaign.brand_profiles?.name || "Brand"}</p>
            </div>
          </div>
          {campaign.type === "paid" && (
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "block", fontSize: "9px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Net Take-home {campaign.brand_profiles?.is_enterprise ? "(0% cut)" : "(-10%)"}
              </span>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#34c759", fontFamily: "'Syne', sans-serif" }}>
                £{(parseInt(campaign.budget, 10) * (campaign.brand_profiles?.is_enterprise ? 1 : 0.90)).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Brief */}
        {(campaign.vibe || campaign.objective || campaign.niche || campaign.deadline) && (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Campaign brief</p>
            {campaign.objective && (
              <div>
                <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>Objective</p>
                <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>{campaign.objective}</p>
              </div>
            )}
            {campaign.vibe && (
              <div>
                <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>Vibe</p>
                <p style={{ fontSize: "13px", color: "#aaa", margin: 0, lineHeight: 1.6 }}>{campaign.vibe}</p>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              {campaign.niche && (
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>Niche</p>
                  <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>{campaign.niche}</p>
                </div>
              )}
              {campaign.deadline && (
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>Deadline</p>
                  <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>{new Date(campaign.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deliverables */}
        {campaign.deliverables?.length > 0 && (
          <div>
            <p style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Deliverables</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {campaign.deliverables.map(d => (
                <div key={d} style={{ padding: "5px 10px", borderRadius: "4px", border: "1px solid #1a1a1a", background: "#111", fontSize: "11px", color: "#bbb" }}>{d}</div>
              ))}
            </div>
          </div>
        )}

        {/* Dos and Don'ts */}
        {(campaign.dos?.filter(d => d).length > 0 || campaign.donts?.filter(d => d).length > 0) && (
          <div style={{ display: "flex", gap: "10px" }}>
            {campaign.dos?.filter(d => d).length > 0 && (
              <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                <p style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 0" }}>Do's</p>
                {campaign.dos.filter(d => d).map((d, i) => (
                  <p key={i} style={{ fontSize: "12px", color: "#aaa", margin: "0 0 4px 0", lineHeight: 1.5 }}>— {d}</p>
                ))}
              </div>
            )}
            {campaign.donts?.filter(d => d).length > 0 && (
              <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                <p style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 0" }}>Don'ts</p>
                {campaign.donts.filter(d => d).map((d, i) => (
                  <p key={i} style={{ fontSize: "12px", color: "#aaa", margin: "0 0 4px 0", lineHeight: 1.5 }}>— {d}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CTA info */}
        {(campaign.promo_code || campaign.landing_link || campaign.utm_code) && (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
            <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Call to action</p>
            {campaign.promo_code && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "#888" }}>Promo code</span>
                <span style={{ color: "#aaa", fontWeight: 600 }}>{campaign.promo_code}</span>
              </div>
            )}
            {campaign.landing_link && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "#888" }}>Link</span>
                <a href={campaign.landing_link} target="_blank" rel="noreferrer" style={{ color: "#aaa", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>{campaign.landing_link}</a>
              </div>
            )}
            {campaign.utm_code && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "#888" }}>UTM</span>
                <span style={{ color: "#999", fontSize: "11px", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.utm_code}</span>
              </div>
            )}
          </div>
        )}

        {/* Asset Kit */}
        {(campaign.asset_logos?.length > 0 || campaign.asset_overlays?.length > 0 || campaign.asset_style_videos?.length > 0 || campaign.asset_broll?.length > 0) && (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
            <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px 0" }}>Media asset kit</p>
            {[
              { label: "Logos", files: campaign.asset_logos, kind: "image" as const },
              { label: "Overlays", files: campaign.asset_overlays, kind: "image" as const },
              { label: "Ref videos", files: campaign.asset_style_videos, kind: "video" as const },
              { label: "B-roll", files: campaign.asset_broll, kind: "auto" as const },
            ].filter(g => g.files?.length > 0).map(group => (
              <div key={group.label} style={{ marginBottom: "10px" }}>
                <p style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0" }}>{group.label}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {group.files.map((url, i) => {
                    const isVideo = group.kind === "video" || (group.kind === "auto" && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url));
                    return isVideo ? (
                      <video key={i} src={url} controls style={{ width: "150px", height: "150px", borderRadius: "8px", background: "#000", objectFit: "cover" }} />
                    ) : (
                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: "block", width: "80px", height: "80px", borderRadius: "8px", overflow: "hidden", border: "1px solid #1a1a1a", background: "#fff", flexShrink: 0 }}>
                        <img src={url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Script (legacy fallback) */}
        {campaign.script && (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
            <p style={{ fontSize: "10px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Script</p>
            <p style={{ fontSize: "12px", color: "#bbb", lineHeight: 1.7, whiteSpace: "pre-line", margin: 0 }}>{campaign.script}</p>
          </div>
        )}

        {/* Platforms */}
        {campaign.platforms?.length > 0 && (
          <div>
            <p style={{ fontSize: "11px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Platforms creators post on</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {campaign.platforms.map(p => (
                <div key={p} style={{ padding: "7px 14px", borderRadius: "20px", border: "1px solid #222", color: "#999", fontSize: "12px", fontWeight: 500 }}>{p}</div>
              ))}
            </div>
          </div>
        )}

        {campaign.video_required && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", background: "#111", border: "1px solid #1a1a1a" }}>
            <span style={{ color: "#ff3b30", fontSize: "13px" }}>●</span>
            <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>Creators must submit a video pitch to apply.</p>
          </div>
        )}

      </div>
    </div>
  );
}
