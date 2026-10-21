import VerifiedBadge from "./VerifiedBadge";
import CampaignTile from "./CampaignTile";

// A row of campaigns you swipe sideways (Closing soon, Top paying, New today)
// for the top of Explore. Written in the app's dark palette like everything
// else; the light look is applied on top.

export interface ShelfCard {
  id: string;
  brandName: string;
  brandAvatar: string;
  verified: boolean;
  name: string;
  niche: string;
  paid: boolean;
  earn: number; // what the creator would take home, for paid campaigns
  note: string; // the small line on the right: a deadline, a niche, how long ago
  urgent: boolean; // the note is a deadline that is close
}

// A section title with its count and, optionally, a link on the right.
export function ShelfHeading({ title, count, actionLabel, onAction }: { title: string; count: number; actionLabel?: string; onAction?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
      <p style={{ margin: 0, fontFamily: "'TikTok Sans', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff" }}>
        {title}
        <span style={{ color: "#999", fontWeight: 500, fontSize: "13px", marginLeft: "8px" }}>{count}</span>
      </p>
      {actionLabel && (
        <span
          role="button"
          tabIndex={0}
          onClick={onAction}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAction?.(); } }}
          style={{ fontSize: "13px", fontWeight: 600, color: "#999", cursor: "pointer", padding: "4px 0", flexShrink: 0 }}
        >
          {actionLabel}
        </span>
      )}
    </div>
  );
}

export default function CampaignShelf({ title, total, cards, onOpen, onSeeAll }: {
  title: string;
  total: number;
  cards: ShelfCard[];
  onOpen: (id: string) => void;
  onSeeAll: () => void;
}) {
  return (
    <section aria-label={title} style={{ marginBottom: "0.75rem" }}>
      <style>{`.shelf-scroll { scrollbar-width: none; } .shelf-scroll::-webkit-scrollbar { display: none; }`}</style>
      <ShelfHeading title={title} count={total} actionLabel="See all" onAction={onSeeAll} />
      {/* Runs to both screen edges (the page pads 1rem each side) and snaps card by card */}
      <div
        className="shelf-scroll"
        style={{ display: "flex", gap: "10px", overflowX: "auto", overscrollBehaviorX: "contain", scrollSnapType: "x proximity", scrollPaddingLeft: "1rem", WebkitOverflowScrolling: "touch", margin: "10px -1rem 0", padding: "0 1rem 2px" }}
      >
        {cards.map(c => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(c.id)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c.id); } }}
            style={{ flex: "0 0 auto", width: "min(250px, 72%)", minHeight: "200px", scrollSnapAlign: "start", background: "#111", border: "1px solid #1a1a1a", borderRadius: "16px", padding: "1rem", display: "flex", flexDirection: "column", gap: "12px", cursor: "pointer" }}
          >
            <CampaignTile niche={c.niche} height={52} bleed="1rem" />
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "8px", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0 }}>
                <img src={c.brandAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ color: "#fff", fontSize: "13px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.brandName}</span>
              {c.verified && <span style={{ display: "flex", flexShrink: 0 }}><VerifiedBadge size={12} /></span>}
            </div>

            <p style={{ margin: 0, fontFamily: "'TikTok Sans', sans-serif", fontSize: "16px", fontWeight: 800, lineHeight: 1.25, color: "#fff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.name}</p>

            <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ minWidth: 0 }}>
                {c.paid ? (
                  <>
                    <p style={{ margin: 0, fontSize: "11px", color: "#999" }}>You'd earn</p>
                    <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#34c759", fontFamily: "'TikTok Sans', sans-serif", lineHeight: 1.1 }}>£{c.earn.toLocaleString()}</p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: "11px", color: "#999" }}>Reward</p>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff", fontFamily: "'TikTok Sans', sans-serif", lineHeight: 1.3 }}>Gifted product</p>
                  </>
                )}
              </div>
              <span style={{ fontSize: "12px", fontWeight: 600, color: c.urgent ? "#ff9500" : "#999", textAlign: "right", flexShrink: 0 }}>{c.note}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
