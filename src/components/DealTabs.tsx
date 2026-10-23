import { useEffect, useRef } from "react";

// A creator and a brand can have several deals going at once, one for each campaign the
// creator applied to, all in the same chat. The chat shows one deal at a time: its price
// box, its upload and approve cards, its status, and what Pay and Screen Out act on.
// These tabs choose which. They only appear when there is more than one deal.
//
// Written in the app's dark palette like the rest of the chat; the light look is applied on top.

export interface DealTab {
  id: string;
  name: string;
  status: string;
}

// What each stage of a deal is called to the people in it.
const STAGE: Record<string, string> = {
  pending: "Applied",
  accepted: "Open",
  funded: "Funded",
  paid: "Paid",
  disputed: "In dispute",
  refunded: "Refunded",
  rejected: "Declined",
};

export default function DealTabs({ deals, activeId, onPick }: {
  deals: DealTab[];
  activeId: string | undefined;
  onPick: (id: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const activeTab = useRef<HTMLButtonElement>(null);

  // With more deals than fit across the screen the row scrolls sideways: keep the one in view on show.
  useEffect(() => {
    const strip = row.current, tab = activeTab.current;
    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: Math.max(0, tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2), behavior: "smooth" });
  }, [activeId]);

  // Two deals share the row; more than that scroll sideways.
  const sharing = deals.length === 2;

  return (
    <div
      ref={row}
      role="tablist"
      aria-label="Deals in this chat"
      data-testid="deal-tabs"
      style={{ position: "relative", display: "flex", gap: "8px", overflowX: "auto", padding: "8px 1.25rem", borderBottom: "1px solid var(--c-111)", background: "var(--c-0a0a0a)", scrollbarWidth: "none" }}
    >
      {deals.map(deal => {
        const on = deal.id === activeId;
        return (
          <button
            key={deal.id}
            ref={on ? activeTab : undefined}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(deal.id)}
            style={{
              flex: sharing ? "1 1 0" : "0 0 auto", minWidth: 0, maxWidth: sharing ? "none" : "min(200px, 60vw)", minHeight: "42px", boxSizing: "border-box",
              padding: "5px 12px", borderRadius: "8px", border: `1px solid ${on ? "var(--c-fff)" : "var(--c-222)"}`,
              background: on ? "var(--c-fff)" : "transparent", color: on ? "var(--t-0a0a0a)" : "var(--t-ddd)",
              fontFamily: "inherit", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", gap: "1px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deal.name}</span>
            <span style={{ fontSize: "11px", fontWeight: 500, color: on ? "var(--t-0a0a0a)" : "var(--t-999)" }}>{STAGE[deal.status] ?? deal.status}</span>
          </button>
        );
      })}
    </div>
  );
}
