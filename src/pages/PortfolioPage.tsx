import { useState, useEffect } from "react";
import StarRating from "../components/StarRating";
import TikTokIcon from "../components/TikTokIcon";
import InstagramIcon from "../components/InstagramIcon";
import YouTubeIcon from "../components/YouTubeIcon";

const SOCIAL_PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const PLATFORM_ICON: Record<string, (size: number) => React.ReactNode> = {
  Instagram: (size) => <InstagramIcon size={size} />,
  TikTok: (size) => <TikTokIcon size={size} />,
  YouTube: (size) => <YouTubeIcon size={size} />,
};
const PlayGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="#fff" />
  </svg>
);

interface PortfolioData {
  name: string;
  bio: string;
  avatar_url?: string;
  niche: string;
  location: string;
  content_types?: string[];
  languages?: string[];
  audience_age_range?: string;
  audience_location?: string;
  rates?: { post: string; story: string; reel: string; video: string; ugc: string };
  collabs?: { brand: string; description: string }[];
  sections: Record<string, boolean>;
  social: { platform: string; username: string; follower_count: number | null }[];
  posts: { platform: string; post_id: string; post_url: string; thumbnail_url: string; caption: string | null }[];
  trackRecord: { completedCampaigns: number; avgTurnaroundHours: number | null; avgRating: number | null; reviewCount: number };
  reviews: { id: string; rating: number; comment: string | null; created_at: string; brand_name: string | null; brand_avatar: string | null; campaign_name: string | null }[];
}

const formatTurnaround = (hours: number | null): string | null => {
  if (hours == null) return null;
  if (hours < 1) return "Under an hour";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
};

const chipStyle: React.CSSProperties = { padding: "7px 14px", borderRadius: "20px", border: "1px solid #222", color: "#999", fontSize: "12px", fontWeight: 500 };
const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", marginBottom: "6px", display: "block" };
const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };
const dividerStyle: React.CSSProperties = { borderTop: "1px solid #1a1a1a", marginBottom: "2rem" };

export default function PortfolioPage({ slug }: { slug: string }) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`https://otbcvpgtxxidgtbxgzpo.supabase.co/functions/v1/get-portfolio?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) { setNotFound(true); return; }
        setData(await res.json());
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;

  if (notFound || !data) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", fontFamily: "'DM Sans', sans-serif", padding: "2rem", textAlign: "center" }}>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "17px", fontWeight: 800, color: "#fff" }}>Portfolio not found</p>
      <p style={{ fontSize: "13px", color: "#888" }}>This link isn't active, or the creator hasn't published a portfolio yet.</p>
    </div>
  );

  const sections = data.sections || {};
  const displayPlatforms = Array.from(new Set(data.social.map(s => SOCIAL_PLATFORM_LABEL[s.platform] || s.platform)));
  const hasRates = data.rates && Object.values(data.rates).some(v => v);
  const collabs = (data.collabs || []).filter(c => c.brand);
  const hasTrackRecord = data.trackRecord.completedCampaigns > 0 || data.trackRecord.reviewCount > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      <div style={{ flex: 1, padding: "3rem 1.25rem 2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.75rem" }}>
            <div style={{ width: "76px", height: "76px", borderRadius: "50%", border: "1px solid #333", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", color: "#777", flexShrink: 0, overflow: "hidden" }}>
              {data.avatar_url ? <img src={data.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◉"}
            </div>
            <div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "21px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>{data.name}</p>
              <p style={{ fontSize: "13px", color: "#999" }}>{data.niche}{data.location ? ` · ${data.location}` : ""}</p>
            </div>
          </div>

          {/* Bio */}
          {sections.bio !== false && data.bio && (
            <div style={sectionStyle}>
              <p style={{ fontSize: "13px", color: "#bbb", lineHeight: 1.7 }}>{data.bio}</p>
            </div>
          )}

          {data.content_types && data.content_types.length > 0 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Content I Create</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {data.content_types.map(c => <div key={c} style={chipStyle}>{c}</div>)}
              </div>
            </div>
          )}

          {(sections.bio !== false && data.bio) || (data.content_types && data.content_types.length > 0) ? <div style={dividerStyle} /> : null}

          {/* Platforms */}
          {sections.platforms !== false && displayPlatforms.length > 0 && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>Platforms</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {displayPlatforms.map(p => {
                    const verified = data.social.find(s => (SOCIAL_PLATFORM_LABEL[s.platform] || s.platform) === p);
                    const platformPosts = data.posts.filter(post => (SOCIAL_PLATFORM_LABEL[post.platform] || post.platform) === p).slice(0, 5);
                    return (
                      <div key={p} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "16px", overflow: "hidden" }}>
                        <div style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {PLATFORM_ICON[p]?.(18)}
                            <p style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>{p}</p>
                          </div>
                          {verified?.username && <p style={{ color: "#999", fontSize: "12px", marginTop: "3px" }}>@{verified.username}</p>}
                          {verified?.follower_count != null && (
                            <div style={{ marginTop: "12px" }}>
                              <p style={{ fontFamily: "'Syne', sans-serif", color: "#fff", fontSize: "17px", fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{verified.follower_count.toLocaleString()}</p>
                              <p style={{ color: "#777", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "5px" }}>Followers</p>
                            </div>
                          )}
                        </div>
                        {platformPosts.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "3px", borderTop: "1px solid #1a1a1a" }}>
                            {platformPosts.map(post => (
                              <a key={`${post.platform}-${post.post_id}`} href={post.post_url} target="_blank" rel="noopener noreferrer" style={{ position: "relative", display: "block", aspectRatio: "9 / 16", overflow: "hidden", background: "#0a0a0a" }}>
                                <img src={post.thumbnail_url} alt={post.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                <div style={{ position: "absolute", top: "5px", right: "5px", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))" }}><PlayGlyph /></div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={dividerStyle} />
            </>
          )}

          {/* Audience */}
          {(data.audience_age_range || data.audience_location) && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Audience</label>
              <div style={{ display: "flex", gap: "1rem", fontSize: "13px", color: "#999" }}>
                {data.audience_age_range && <span>Age {data.audience_age_range}</span>}
                {data.audience_location && <span>{data.audience_location}</span>}
              </div>
            </div>
          )}

          {/* Rate Card */}
          {sections.rates !== false && hasRates && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Rate Card</label>
              <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.rates!.post && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#999" }}>Post</span><span style={{ color: "#fff" }}>£{data.rates!.post}</span></div>}
                {data.rates!.story && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#999" }}>Story</span><span style={{ color: "#fff" }}>£{data.rates!.story}</span></div>}
                {data.rates!.reel && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#999" }}>Reel</span><span style={{ color: "#fff" }}>£{data.rates!.reel}</span></div>}
                {data.rates!.video && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#999" }}>Video</span><span style={{ color: "#fff" }}>£{data.rates!.video}</span></div>}
                {data.rates!.ugc && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#999" }}>UGC Only</span><span style={{ color: "#fff" }}>£{data.rates!.ugc}</span></div>}
              </div>
            </div>
          )}

          {/* Past Collabs */}
          {sections.collabs !== false && collabs.length > 0 && (
            <>
              <div style={dividerStyle} />
              <div style={sectionStyle}>
                <label style={labelStyle}>Past Collabs</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {collabs.map((c, i) => (
                    <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                      <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{c.brand}</p>
                      <p style={{ color: "#999", fontSize: "12px" }}>{c.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Track Record + Reviews */}
          {sections.trackrecord !== false && hasTrackRecord && (
            <>
              <div style={dividerStyle} />
              <div style={sectionStyle}>
                <label style={labelStyle}>Track Record</label>
                <div style={{ display: "flex", gap: "10px", marginBottom: sections.reviews !== false && data.reviews.length > 0 ? "1.25rem" : 0 }}>
                  <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                    <p style={{ color: "#fff", fontSize: "18px", fontWeight: 700 }}>{data.trackRecord.completedCampaigns}</p>
                    <p style={{ color: "#999", fontSize: "11px", marginTop: "2px" }}>Completed</p>
                  </div>
                  <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                    {data.trackRecord.avgRating != null ? (
                      <>
                        <StarRating rating={data.trackRecord.avgRating} size={13} />
                        <p style={{ color: "#999", fontSize: "11px", marginTop: "6px" }}>{data.trackRecord.avgRating.toFixed(1)} ({data.trackRecord.reviewCount})</p>
                      </>
                    ) : (
                      <>
                        <p style={{ color: "#999", fontSize: "13px" }}>—</p>
                        <p style={{ color: "#999", fontSize: "11px", marginTop: "6px" }}>No ratings yet</p>
                      </>
                    )}
                  </div>
                  <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "12px" }}>
                    <p style={{ color: "#fff", fontSize: "18px", fontWeight: 700 }}>{formatTurnaround(data.trackRecord.avgTurnaroundHours) || "—"}</p>
                    <p style={{ color: "#999", fontSize: "11px", marginTop: "2px" }}>Avg. turnaround</p>
                  </div>
                </div>

                {sections.reviews !== false && data.reviews.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {data.reviews.map(r => (
                      <div key={r.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#777" }}>
                              {r.brand_avatar ? <img src={r.brand_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
                            </div>
                            <p style={{ color: "#fff", fontSize: "12px", fontWeight: 600 }}>{r.brand_name || "Brand"}</p>
                          </div>
                          <StarRating rating={r.rating} size={11} />
                        </div>
                        {r.comment && <p style={{ color: "#bbb", fontSize: "12px", lineHeight: 1.6, marginBottom: "4px" }}>{r.comment}</p>}
                        <p style={{ color: "#777", fontSize: "10px" }}>{r.campaign_name ? `${r.campaign_name} · ` : ""}{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* Watermark footer - the whole point of the page being shareable is
          that every viewer sees this, not just the creator's own network. */}
      <a href="/" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "1.5rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #111", textDecoration: "none" }}>
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", color: "#555" }}>MADE WITH FLIPCOLLAB</p>
        <p style={{ fontSize: "11px", color: "#444" }}>Get discovered for brand deals → flipcollab.com</p>
      </a>
    </div>
  );
}
