/* eslint-disable @typescript-eslint/no-explicit-any */
// The server functions the app calls (payments, payouts, push, uploads...),
// answered locally. Nothing here talks to Stripe, the file store or the push
// service: money moves are simulated rows in the in-memory database, and
// anything that would touch an outside service says it is switched off.

import { dealBreakdown } from "../fees";
import type { Row } from "./query";
import type { Ctx } from "./ctx";
import { notifyUser } from "./rpc";

export interface FnResult {
  status: number;
  json: Record<string, any>;
}

const ok = (json: Record<string, any> = { success: true }): FnResult => ({ status: 200, json });
const fail = (status: number, error: string): FnResult => ({ status, json: { error } });

// Records the payout as released, exactly the way the real function ends up:
// the deal is "paid", the transaction gets its release time, the creator is told.
export function releaseDeal(ctx: Ctx, app: Row): void {
  const { db } = ctx;
  const campaign = db.rows("campaigns").find(c => c.id === app.campaign_id);
  db.update("applications", [app], { status: "paid" });
  const txs = db.rows("transactions").filter(t => t.campaign_id === app.campaign_id && t.creator_id === app.creator_id);
  db.update("transactions", txs, { payout_released_at: new Date().toISOString() });
  notifyUser(ctx, app.creator_id, "payment_received", "Payout Released", `Your payout for "${campaign?.name ?? "your campaign"}" has been released.`, { campaign_id: app.campaign_id });
}

// Records the card payment as taken and the deal as funded, the way the
// payment webhook does in the real app.
export function fundDeal(ctx: Ctx, app: Row, amountPence: number): void {
  const { db } = ctx;
  const campaign = db.rows("campaigns").find(c => c.id === app.campaign_id);
  const brand = db.rows("brand_profiles").find(b => b.id === campaign?.brand_id);
  const split = dealBreakdown(amountPence, !!brand?.is_enterprise);
  db.update("applications", [app], { status: "funded" });
  db.insert("transactions", {
    campaign_id: app.campaign_id, brand_id: campaign?.brand_id, creator_id: app.creator_id,
    amount: split.totalCharge, platform_fee: split.brandFee + split.creatorCut + split.processingFee,
    creator_payout: split.creatorPayout, status: "completed", payout_released_at: null,
    stripe_payment_intent_id: `pi_demo_${Math.random().toString(36).slice(2, 10)}`,
  });
}

export function runFunction(ctx: Ctx, name: string, body: Row): FnResult {
  const { db } = ctx;

  switch (name) {
    case "send-push":
    case "r2-delete-assets":
    case "delete-user":
      return ok();

    case "create-payment-intent": {
      const app = db.rows("applications").find(a => a.campaign_id === body.campaign_id && a.creator_id === body.creator_id);
      if (!app) return fail(404, "We couldn't find that application.");
      if (app.status === "funded" || app.status === "paid") return fail(400, "This deal has already been paid for.");
      fundDeal(ctx, app, Math.round(Number(body.amount) || 0));
      return ok({ clientSecret: "pi_demo_secret_not_a_real_secret", paymentIntentId: "pi_demo" });
    }

    case "release-payout": {
      const app = db.rows("applications").find(a => a.id === body.application_id);
      if (!app) return fail(404, "We couldn't find that deal.");
      if (app.status === "paid") return ok({ released: true, alreadyReleased: true });
      if (app.status !== "funded") return fail(400, "This deal hasn't been paid yet.");
      releaseDeal(ctx, app);
      return ok({ released: true, transfer_id: "tr_demo" });
    }

    case "raise-dispute": {
      const app = db.rows("applications").find(a => a.id === body.application_id);
      if (!app) return fail(404, "We couldn't find that deal.");
      if (app.status !== "funded") return fail(400, "A dispute can only be raised on a paid deal.");
      db.update("applications", [app], { status: "disputed" });
      db.insert("disputes", { application_id: app.id, raised_by: ctx.session.userId, reason: String(body.reason ?? ""), status: "open", creator_response: null });
      return ok();
    }

    case "edit-message": {
      const msg = db.rows("messages").find(m => m.id === body.message_id);
      if (!msg) return fail(404, "We couldn't find that message.");
      db.update("messages", [msg], { text: String(body.text ?? ""), edited_at: new Date().toISOString() });
      return ok();
    }

    case "connect-account-status":
      return ok({ connected: true, charges_enabled: true, payouts_enabled: true, details_submitted: true });

    case "connect-account-session":
      return fail(400, "Payout setup is switched off in the demo.");

    case "create-subscription":
    case "cancel-subscription":
      return fail(400, "Subscriptions are switched off in the demo.");

    case "social-oauth-start":
      return fail(400, "Connecting accounts is switched off in the demo.");

    case "tiktok-post-video":
    case "tiktok-post-status":
    case "instagram-post-content":
    case "instagram-post-status":
    case "youtube-post-content":
    case "youtube-post-status":
      return fail(400, "Posting is switched off in the demo.");

    case "r2-presigned-url":
      return fail(400, "Uploads stay on your device in the demo.");

    case "resolve-dispute":
    case "moderate-user":
      return fail(403, "That isn't available in the demo.");

    default:
      return fail(404, "That isn't available in the demo.");
  }
}
