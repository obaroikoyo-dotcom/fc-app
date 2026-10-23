import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { priceNotice, type PriceNoticeKind } from "./priceNotices";

// Changing a deal's price in the chat. One side offers, the other accepts; only
// then does the price of that one deal change (the campaign's own budget, which
// Explore and the Market tab show, is never touched). The database functions
// propose_deal_price and answer_deal_price do all the checking - these are just
// the calls, plus the maths for "what is the price right now".

export const MIN_DEAL_PRICE = 1;
export const MAX_DEAL_PRICE = 100_000;

export interface PriceOffer {
  id: string;
  application_id: string;
  proposed_by: string;
  amount: number; // whole pounds
  status: "pending" | "accepted" | "declined" | "withdrawn" | "replaced";
  created_at: string;
  responded_at: string | null;
}

export interface DealPrice {
  price: number; // whole pounds: the agreed price, or the campaign's budget if none
  agreed: boolean;
  open: PriceOffer | null; // the offer waiting for an answer, if any
}

export function currentDealPrice(offers: PriceOffer[] | undefined, baseBudget: number): DealPrice {
  const list = offers ?? [];
  const accepted = list
    .filter(o => o.status === "accepted")
    .sort((a, b) => Date.parse(b.responded_at ?? b.created_at) - Date.parse(a.responded_at ?? a.created_at))[0];
  const open = list.find(o => o.status === "pending") ?? null;
  return { price: accepted ? accepted.amount : baseBudget, agreed: !!accepted, open };
}

export async function fetchOffers(applicationIds: string[]): Promise<PriceOffer[]> {
  if (applicationIds.length === 0) return [];
  const { data, error } = await supabase
    .from("price_offers")
    .select("id, application_id, proposed_by, amount, status, created_at, responded_at")
    .in("application_id", applicationIds)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load price offers:", error);
    return [];
  }
  return (data ?? []) as PriceOffer[];
}

// The functions raise plain sentences for things the person can fix; "not
// authorized" is the catch-all for anything that should never happen from the app.
function reason(message: string | undefined): string {
  if (!message || message === "not authorized") return "You can't change the price on this deal.";
  return message;
}

// Returns an error sentence, or null when it worked.
export async function proposeDealPrice(applicationId: string, amount: number): Promise<string | null> {
  const { error } = await supabase.rpc("propose_deal_price", { p_application_id: applicationId, p_amount: amount });
  return error ? reason(error.message) : null;
}

export async function answerDealPrice(offerId: string, action: "accept" | "decline" | "withdraw"): Promise<string | null> {
  const { error } = await supabase.rpc("answer_deal_price", { p_offer_id: offerId, p_action: action });
  return error ? reason(error.message) : null;
}

// The phone push message that goes with a price change (the entry in the notifications
// list is written by the database function). Best effort: a push that can't be sent never
// stops the offer itself, and someone with push switched off just sees it in the app.
export async function pushPriceNotice(args: {
  recipientId: string;
  kind: PriceNoticeKind;
  myName: string;
  amount: number;
  campaignName: string;
  applicationId: string;
  conversationId: string;
}): Promise<void> {
  if (!args.recipientId) return;
  const { title, body } = priceNotice(args.kind, args.myName, args.amount, args.campaignName);
  try {
    await supabase.functions.invoke("send-push", {
      body: {
        user_id: args.recipientId,
        type: "price_offer",
        title,
        body,
        data: { application_id: args.applicationId, conversation_id: args.conversationId },
      },
    });
  } catch (err) {
    console.error("Failed to push the price notice:", err);
  }
}

// Every offer for these deals, kept fresh: reloaded when something changes (the
// other person offering or answering shows up live) and after your own actions.
export function useDealOffers(applicationIds: string[]) {
  const [offers, setOffers] = useState<Record<string, PriceOffer[]>>({});
  const key = applicationIds.join(",");
  const idsRef = useRef<string[]>([]);

  const load = useCallback(async () => {
    const ids = idsRef.current;
    if (ids.length === 0) return;
    const rows = await fetchOffers(ids);
    if (idsRef.current !== ids) return; // moved on to another chat while this was loading
    const grouped: Record<string, PriceOffer[]> = {};
    for (const id of ids) grouped[id] = [];
    for (const row of rows) (grouped[row.application_id] ??= []).push(row);
    setOffers(prev => ({ ...prev, ...grouped }));
  }, []);

  useEffect(() => {
    idsRef.current = key ? key.split(",") : [];
    if (!key) return;
    void load();
    const channel = supabase
      .channel(`price-offers-${key.slice(0, 40)}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "price_offers" }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [key, load]);

  return { offers, refresh: load };
}
