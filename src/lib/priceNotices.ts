// What people are told when a price changes hands in a chat. One place for the words,
// used by the in-app demo, and by the phone push messages. (The real notifications
// in the app's notifications list are written by the database functions propose_deal_price
// and answer_deal_price, which use these same sentences; keep the two in step.)

export type PriceNoticeKind = "offer" | "counter" | "accept" | "decline";

export function priceNotice(kind: PriceNoticeKind, who: string, amount: number, campaign: string): { title: string; body: string } {
  const name = who.trim() || "Someone";
  const deal = `£${amount.toLocaleString("en-GB")} for "${campaign}"`;
  switch (kind) {
    case "offer": return { title: "New price offered", body: `${name} offered ${deal}.` };
    case "counter": return { title: "Counter offer", body: `${name} countered with ${deal}.` };
    case "accept": return { title: "Price agreed", body: `${name} accepted ${deal}.` };
    case "decline": return { title: "Offer declined", body: `${name} declined your offer of ${deal}.` };
  }
}
