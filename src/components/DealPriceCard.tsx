import { useState, type CSSProperties } from "react";
import { COMBINED_PLATFORM_FEE_PERCENT, budgetForCreatorNet, creatorNetPence, dealBreakdown, formatPence, formatPounds } from "../lib/fees";
import { MAX_DEAL_PRICE, MIN_DEAL_PRICE, answerDealPrice, currentDealPrice, proposeDealPrice, pushPriceNotice, type PriceOffer } from "../lib/priceOffers";
import type { PriceNoticeKind } from "../lib/priceNotices";

// The price of one deal, shown in the chat, with a way for either person to offer a
// different one. The price is what the creator gets: the same figure for both people.
// The brand is also told what that costs them in all; the creator is only told it comes
// after the platform fee, never the fee itself or what the brand pays (that is in the terms).
// The other person accepts or declines; only then does the price change, and only for this
// deal (Explore and the Market tab keep showing the campaign's own budget).
//
// The database keeps a deal's price as a budget in whole pounds, so a price typed here is
// turned into the smallest budget that gives the creator at least that much, and the line
// under the box says exactly what that works out to before anything is sent. Written in the
// app's dark palette like the rest of the chat; the light look is applied on top.

const button: CSSProperties = {
  borderRadius: "6px", padding: "8px 14px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "inherit", border: "1px solid var(--c-2a2a2a)",
  background: "transparent", color: "var(--t-ddd)",
};
const primary: CSSProperties = { ...button, background: "var(--c-fff)", color: "var(--t-0a0a0a)", border: "1px solid var(--c-fff)" };

export default function DealPriceCard({ applicationId, role, currentUserId, otherName, baseBudget, offers, brandIsEnterprise, onChanged, notify }: {
  applicationId: string;
  role: "brand" | "creator";
  currentUserId: string;
  otherName: string;
  baseBudget: number; // the campaign's own budget, in whole pounds
  offers: PriceOffer[] | undefined;
  brandIsEnterprise: boolean;
  onChanged: () => void; // reload the offers after something was sent or answered
  // Who to send the phone push message to, and what it says (the entry in the notifications list is written by the database).
  notify: { otherUserId: string; myName: string; campaignName: string; conversationId: string };
}) {
  const { price, agreed, open } = currentDealPrice(offers, baseBudget); // budgets, in whole pounds
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the creator gets at a budget, as shown on the card ("£90", "£100.80").
  const shown = (budget: number) => formatPounds(creatorNetPence(budget, brandIsEnterprise));

  // What a price means for the person looking at it.
  const meaning = (budget: number): string => {
    if (role === "creator") return brandIsEnterprise ? "No platform fee" : "After platform fee";
    const charged = formatPence(dealBreakdown(budget * 100, brandIsEnterprise).totalCharge);
    return `${charged} charged to you, including the ${brandIsEnterprise ? "card processing fee" : `${COMBINED_PLATFORM_FEE_PERCENT}% FlipCollab platform fee`}`;
  };

  // The price typed in the box is what the creator gets, in whole pounds.
  const maxPrice = formatPounds(creatorNetPence(MAX_DEAL_PRICE, brandIsEnterprise));
  const typed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const typedBudget = Number.isInteger(typed) && typed >= 1 ? budgetForCreatorNet(typed * 100, brandIsEnterprise) : NaN;
  const validTyped = Number.isInteger(typedBudget) && typedBudget >= MIN_DEAL_PRICE && typedBudget <= MAX_DEAL_PRICE;

  const run = async (task: () => Promise<string | null>, afterSuccess?: () => void) => {
    setBusy(true);
    setError(null);
    const problem = await task();
    setBusy(false);
    if (problem) { setError(problem); onChanged(); return; }
    setEditing(false);
    setValue("");
    onChanged();
    afterSuccess?.();
  };

  const push = (recipientId: string, kind: PriceNoticeKind, budget: number) =>
    void pushPriceNotice({ recipientId, kind, myName: notify.myName, amount: creatorNetPence(budget, brandIsEnterprise) / 100, campaignName: notify.campaignName, applicationId, conversationId: notify.conversationId });

  const sendOffer = () => {
    if (!validTyped) { setError(`Enter a whole number of pounds between £1 and ${maxPrice}.`); return; }
    if (typedBudget === price) {
      setError(typed * 100 === creatorNetPence(price, brandIsEnterprise) ? "That is already the price." : `That comes to the same price as now (${shown(price)}).`);
      return;
    }
    // Answering the other person's waiting offer with a different price is a counter-offer.
    const kind: PriceNoticeKind = open && open.proposed_by !== currentUserId ? "counter" : "offer";
    void run(() => proposeDealPrice(applicationId, typedBudget), () => push(notify.otherUserId, kind, typedBudget));
  };

  const mine = open?.proposed_by === currentUserId;

  return (
    <div data-testid="deal-price-card" style={{ alignSelf: "flex-start", width: "100%", maxWidth: "92%", background: "var(--c-111)", border: "1px solid var(--c-222)", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div>
        <p style={{ margin: 0, fontSize: "10px", color: "var(--t-888)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{agreed ? "Agreed price" : "Price"}</p>
        <p style={{ margin: "2px 0 0", fontFamily: "'TikTok Sans', sans-serif", fontSize: "24px", fontWeight: 800, color: "var(--t-fff)", lineHeight: 1.15 }}>{shown(price)}</p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--t-aaa)" }}>{meaning(price)}</p>
      </div>

      {open && (
        <div className="fc-pop" style={{ borderTop: "1px solid var(--c-1c1c1c)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--t-fff)", fontWeight: 600 }}>
            {mine ? `You offered ${shown(open.amount)}` : `${otherName} offered ${shown(open.amount)}`}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--t-aaa)" }}>{meaning(open.amount)}</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {mine ? (
              <>
                <span style={{ fontSize: "12px", color: "var(--t-888)", alignSelf: "center" }}>Waiting for {otherName}</span>
                <button type="button" disabled={busy} style={button} onClick={() => run(() => answerDealPrice(open.id, "withdraw"))}>Withdraw</button>
              </>
            ) : (
              <>
                <button type="button" disabled={busy} style={primary} onClick={() => run(() => answerDealPrice(open.id, "accept"), () => push(open.proposed_by, "accept", open.amount))}>Accept {shown(open.amount)}</button>
                <button type="button" disabled={busy} style={button} onClick={() => run(() => answerDealPrice(open.id, "decline"), () => push(open.proposed_by, "decline", open.amount))}>Decline</button>
              </>
            )}
          </div>
        </div>
      )}

      {editing ? (
        <div style={{ borderTop: "1px solid var(--c-1c1c1c)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <label htmlFor="deal-price-input" style={{ fontSize: "10px", color: "var(--t-888)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {open && !mine ? "Counter with a different price (£)" : "Your price (£)"}
          </label>
          <input
            id="deal-price-input"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={e => { setValue(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === "Enter") sendOffer(); }}
            placeholder={String(Math.round(creatorNetPence(price, brandIsEnterprise) / 100))}
            style={{ background: "var(--c-0a0a0a)", border: "1px solid var(--c-222)", borderRadius: "6px", padding: "10px 12px", color: "var(--t-fff)", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
          />
          {validTyped && typedBudget !== price && <p style={{ margin: 0, fontSize: "12px", color: "var(--t-aaa)" }}>Price {shown(typedBudget)} · {meaning(typedBudget)}</p>}
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" disabled={busy} style={primary} onClick={sendOffer}>{busy ? "Sending..." : "Send offer"}</button>
            <button type="button" disabled={busy} style={button} onClick={() => { setEditing(false); setValue(""); setError(null); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" style={button} onClick={() => { setEditing(true); setError(null); }}>
            {open && !mine ? "Counter offer" : "Offer a different price"}
          </button>
        </div>
      )}

      {error && <p role="alert" style={{ margin: 0, fontSize: "12px", color: "var(--t-ff4d4d)" }}>{error}</p>}
    </div>
  );
}
