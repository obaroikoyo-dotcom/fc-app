// The price of one deal in the demo: the price agreed in the chat if there is one,
// otherwise the campaign's own budget (which an agreed price never changes). The
// same rule the real create-payment-intent follows.

import type { Db, Row } from "./query";
import { creatorNetPence } from "../fees";

// What the creator gets for a deal at this budget: the figure the price card in the chat and
// the notifications talk about, since every price there is the creator's side of it.
export function creatorNetPounds(db: Db, campaign: Row | undefined, budgetPounds: number): number {
  const enterprise = !!db.rows("brand_profiles").find(b => b.id === campaign?.brand_id)?.is_enterprise;
  return creatorNetPence(budgetPounds, enterprise) / 100;
}

export function campaignBudgetPounds(campaign: Row | undefined): number {
  const n = Math.round(parseFloat(String(campaign?.budget ?? "")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function dealPricePounds(db: Db, app: Row): number {
  const accepted = db.rows("price_offers")
    .filter(o => o.application_id === app.id && o.status === "accepted")
    .sort((a, b) => Date.parse(String(b.responded_at ?? b.created_at)) - Date.parse(String(a.responded_at ?? a.created_at)))[0];
  if (accepted) return Number(accepted.amount);
  return campaignBudgetPounds(db.rows("campaigns").find(c => c.id === app.campaign_id));
}
