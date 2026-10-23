import { useState, type CSSProperties } from "react";
import { dealBreakdown, formatPence } from "../lib/fees";
import { MAX_DEAL_PRICE, MIN_DEAL_PRICE, answerDealPrice, currentDealPrice, proposeDealPrice, type PriceOffer } from "../lib/priceOffers";

// The price of one deal, shown in the chat, with a way for either person to offer a
// different one. The other person accepts or declines; only then does the price
// change, and only for this deal (Explore and the Market tab keep showing the
// campaign's own budget). Fees are added on top of the agreed price exactly as on
// the budget, so each side sees what it means for them: the brand what is charged,
// the creator what they receive. Written in the app's dark palette like the rest of
// the chat; the light look is applied on top.

const pounds = (n: number) => `£${n.toLocaleString()}`;

const button: CSSProperties = {
  borderRadius: "6px", padding: "8px 14px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "inherit", border: "1px solid var(--c-2a2a2a)",
  background: "transparent", color: "var(--t-ddd)",
};
const primary: CSSProperties = { ...button, background: "var(--c-fff)", color: "var(--t-0a0a0a)", border: "1px solid var(--c-fff)" };

export default function DealPriceCard({ applicationId, role, currentUserId, otherName, baseBudget, offers, brandIsEnterprise, onChanged }: {
  applicationId: string;
  role: "brand" | "creator";
  currentUserId: string;
  otherName: string;
  baseBudget: number; // the campaign's own budget, in whole pounds
  offers: PriceOffer[] | undefined;
  brandIsEnterprise: boolean;
  onChanged: () => void; // reload the offers after something was sent or answered
}) {
  const { price, agreed, open } = currentDealPrice(offers, baseBudget);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What a price means for the person looking at it.
  const meaning = (p: number): string => {
    const d = dealBreakdown(p * 100, brandIsEnterprise);
    if (role === "brand") return `${formatPence(d.totalCharge)} charged to you, including the ${brandIsEnterprise ? "card processing fee" : "5% platform fee"}`;
    return `You'd receive ${formatPence(d.creatorPayout)}${brandIsEnterprise ? "" : " after the 10% platform fee"}`;
  };

  const typed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const validTyped = Number.isInteger(typed) && typed >= MIN_DEAL_PRICE && typed <= MAX_DEAL_PRICE;

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const problem = await task();
    setBusy(false);
    if (problem) { setError(problem); onChanged(); return; }
    setEditing(false);
    setValue("");
    onChanged();
  };

  const sendOffer = () => {
    if (!validTyped) { setError(`Enter a whole number of pounds between ${pounds(MIN_DEAL_PRICE)} and ${pounds(MAX_DEAL_PRICE)}.`); return; }
    if (typed === price) { setError("That is already the price."); return; }
    void run(() => proposeDealPrice(applicationId, typed));
  };

  const mine = open?.proposed_by === currentUserId;

  return (
    <div data-testid="deal-price-card" style={{ alignSelf: "flex-start", width: "100%", maxWidth: "92%", background: "var(--c-111)", border: "1px solid var(--c-222)", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div>
        <p style={{ margin: 0, fontSize: "10px", color: "var(--t-888)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{agreed ? "Agreed price" : "Price"}</p>
        <p style={{ margin: "2px 0 0", fontFamily: "'TikTok Sans', sans-serif", fontSize: "24px", fontWeight: 800, color: "var(--t-fff)", lineHeight: 1.15 }}>{pounds(price)}</p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--t-aaa)" }}>{meaning(price)}</p>
      </div>

      {open && (
        <div className="fc-pop" style={{ borderTop: "1px solid var(--c-1c1c1c)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--t-fff)", fontWeight: 600 }}>
            {mine ? `You offered ${pounds(open.amount)}` : `${otherName} offered ${pounds(open.amount)}`}
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
                <button type="button" disabled={busy} style={primary} onClick={() => run(() => answerDealPrice(open.id, "accept"))}>Accept {pounds(open.amount)}</button>
                <button type="button" disabled={busy} style={button} onClick={() => run(() => answerDealPrice(open.id, "decline"))}>Decline</button>
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
            placeholder={String(price)}
            style={{ background: "var(--c-0a0a0a)", border: "1px solid var(--c-222)", borderRadius: "6px", padding: "10px 12px", color: "var(--t-fff)", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
          />
          {validTyped && typed !== price && <p style={{ margin: 0, fontSize: "12px", color: "var(--t-aaa)" }}>{meaning(typed)}</p>}
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
      <p style={{ margin: 0, fontSize: "11px", color: "var(--t-777)", lineHeight: 1.5 }}>
        Only this deal changes, once {otherName} agrees. The campaign keeps its own price for everyone else.
      </p>
    </div>
  );
}
