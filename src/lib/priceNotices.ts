// What people are told when a price changes hands in a chat. One place for the words,
// used by the in-app demo, and by the phone push messages. (The real notifications
// in the app's notifications list are written by the database functions propose_deal_price
// and answer_deal_price, which use these same sentences; keep the two in step.)
//
// The amount in every sentence is what the creator gets, the same figure the price card
// in the chat shows to both people, so a notification never contradicts the card.

export type PriceNoticeKind = "offer" | "counter" | "accept" | "decline";

// 1200 -> "£1,200", 100.8 -> "£100.80": pence only when there are some.
export function poundsText(amount: number): string {
  const pence = Math.round(amount * 100);
  const digits = pence % 100 === 0 ? 0 : 2;
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function priceNotice(kind: PriceNoticeKind, who: string, amount: number, campaign: string): { title: string; body: string } {
  const name = who.trim() || "Someone";
  const deal = `${poundsText(amount)} for "${campaign}"`;
  switch (kind) {
    case "offer": return { title: "New price offered", body: `${name} offered ${deal}.` };
    case "counter": return { title: "Counter offer", body: `${name} countered with ${deal}.` };
    case "accept": return { title: "Price agreed", body: `${name} accepted ${deal}.` };
    case "decline": return { title: "Offer declined", body: `${name} declined your offer of ${deal}.` };
  }
}
