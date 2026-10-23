import { useEffect, useRef, useState, type ReactNode } from "react";
import VerifiedBadge from "./VerifiedBadge";
import CampaignTile, { PHOTO_RATIO } from "./CampaignTile";

// A row of campaigns you swipe sideways (Closing soon, Top paying, New today)
// for the top of Explore. Written in the app's dark palette like everything
// else; the light look is applied on top. A phone swipes it; with a mouse there
// is nothing to swipe (the scroll bar is hidden and the wheel only goes up and
// down), so a pair of arrows next to "See all" scroll it a screenful at a time.
// They only appear where there is a mouse, and each greys out at its end.

export interface ShelfCard {
  id: string;
  brandName: string;
  brandAvatar: string;
  verified: boolean;
  name: string;
  niche: string;
  photo?: string; // the campaign's cover photo, when it has one
  paid: boolean;
  figure: string; // the money, already formatted ("£189"), for paid campaigns
  figureLabel?: string; // what the money is; "You'd earn" unless the page says otherwise
  note: string; // the small line on the right: a deadline, a niche, how long ago
  urgent: boolean; // the note is a deadline that is close
}

// A section title with its count and, optionally, a link on the right.
export function ShelfHeading({ title, count, actionLabel, onAction, trailing }: { title: string; count: number; actionLabel?: string; onAction?: () => void; trailing?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
      <p style={{ margin: 0, fontFamily: "'TikTok Sans', sans-serif", fontSize: "16px", fontWeight: 800, color: "var(--t-fff)" }}>
        {title}
        <span style={{ color: "var(--t-999)", fontWeight: 500, fontSize: "13px", marginLeft: "8px" }}>{count}</span>
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        {trailing}
        {actionLabel && (
          <span
            role="button"
            tabIndex={0}
            onClick={onAction}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAction?.(); } }}
            style={{ fontSize: "13px", fontWeight: 600, color: "var(--t-999)", cursor: "pointer", padding: "4px 0", flexShrink: 0 }}
          >
            {actionLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CampaignShelf({ title, total, cards, onOpen, onSeeAll, gutter = "1rem" }: {
  title: string;
  total: number;
  cards: ShelfCard[];
  onOpen: (id: string) => void;
  onSeeAll: () => void;
  gutter?: string; // the page's side padding, so the row can run to the screen edges
}) {
  // One card with a photo makes the whole row picture-shaped, so the cards line up.
  const rowHasPhoto = cards.some(c => !!c.photo);
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Which arrows can still go somewhere. Measured when the row is first laid out,
  // when it is resized, and as it scrolls (all callbacks, never during a render).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      setAtStart(el.scrollLeft <= 1);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); el.removeEventListener("scroll", measure); };
  }, [cards.length]);

  const scrollRow = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * Math.max(200, el.clientWidth * 0.8), behavior: calm ? "auto" : "smooth" });
  };

  const arrows = (
    <div className="shelf-arrows" style={{ gap: "6px" }}>
      <button type="button" className="shelf-arrow" aria-label={`Scroll ${title} left`} disabled={atStart} onClick={() => scrollRow(-1)}><Chevron direction="left" /></button>
      <button type="button" className="shelf-arrow" aria-label={`Scroll ${title} right`} disabled={atEnd} onClick={() => scrollRow(1)}><Chevron direction="right" /></button>
    </div>
  );

  return (
    <section aria-label={title} style={{ marginBottom: "0.75rem" }}>
      <style>{`
        .shelf-scroll { scrollbar-width: none; }
        .shelf-scroll::-webkit-scrollbar { display: none; }
        .shelf-arrows { display: none; }
        @media (hover: hover) and (pointer: fine) { .shelf-arrows { display: flex; } }
        .shelf-arrow { width: 28px; height: 28px; padding: 0; border-radius: 50%; border: 1px solid var(--c-2a2a2a); background: transparent; color: var(--c-fff); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .shelf-arrow:hover:not(:disabled) { background: var(--c-1a1a1a); border-color: var(--c-3a3a3a); }
        .shelf-arrow:disabled { opacity: 0.3; cursor: default; }
      `}</style>
      <ShelfHeading title={title} count={total} actionLabel="See all" onAction={onSeeAll} trailing={arrows} />
      {/* Runs to both screen edges (the page pads `gutter` each side) and snaps card by card */}
      <div
        ref={scroller}
        className="shelf-scroll"
        style={{ display: "flex", gap: "10px", overflowX: "auto", overscrollBehaviorX: "contain", scrollSnapType: "x proximity", scrollPaddingLeft: gutter, WebkitOverflowScrolling: "touch", margin: `10px calc(-1 * ${gutter}) 0`, padding: `0 ${gutter} 2px` }}
      >
        {cards.map(c => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(c.id)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c.id); } }}
            style={{ flex: "0 0 auto", width: "min(250px, 72%)", minHeight: "200px", scrollSnapAlign: "start", background: "var(--c-111)", border: "1px solid var(--c-1a1a1a)", borderRadius: "16px", padding: "1rem", display: "flex", flexDirection: "column", gap: "12px", cursor: "pointer" }}
          >
            <CampaignTile niche={c.niche} height={52} bleed="1rem" photo={c.photo} ratio={rowHasPhoto ? PHOTO_RATIO : undefined} />
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "8px", border: "1px solid var(--c-222)", background: "var(--c-0a0a0a)", overflow: "hidden", flexShrink: 0 }}>
                <img src={c.brandAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ color: "var(--t-fff)", fontSize: "13px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.brandName}</span>
              {c.verified && <span style={{ display: "flex", flexShrink: 0 }}><VerifiedBadge size={12} /></span>}
            </div>

            <p style={{ margin: 0, fontFamily: "'TikTok Sans', sans-serif", fontSize: "16px", fontWeight: 800, lineHeight: 1.25, color: "var(--t-fff)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.name}</p>

            <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ minWidth: 0 }}>
                {c.paid ? (
                  <>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--t-999)" }}>{c.figureLabel ?? "You'd earn"}</p>
                    <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--t-fff)", fontFamily: "'TikTok Sans', sans-serif", lineHeight: 1.1 }}>{c.figure}</p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--t-999)" }}>Reward</p>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "var(--t-fff)", fontFamily: "'TikTok Sans', sans-serif", lineHeight: 1.3 }}>Gifted product</p>
                  </>
                )}
              </div>
              <span style={{ fontSize: "12px", fontWeight: 600, color: c.urgent ? "#ff9500" : "var(--t-999)", textAlign: "right", flexShrink: 0 }}>{c.note}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
