// The database functions the app calls with supabase.rpc(...), re-done
// against the in-memory tables.

import { PgError, type Row } from "./query";
import type { Ctx } from "./ctx";

export function notifyUser(ctx: Ctx, userId: string, type: string, title: string, body: string, data: Row = {}): Row {
  return ctx.db.insert("notifications", { user_id: userId, type, title, body, data });
}

function average(nums: number[]): number | null {
  const clean = nums.filter(n => Number.isFinite(n));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
}

function hoursBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const h = (Date.parse(to) - Date.parse(from)) / 3_600_000;
  return h >= 0 ? h : null;
}

export function runRpc(ctx: Ctx, fn: string, args: Row): unknown {
  const { db } = ctx;

  switch (fn) {
    case "notify_user":
      notifyUser(ctx, args.target_user_id, args.notif_type, args.notif_title, args.notif_body, args.notif_data ?? {});
      return null;

    case "get_unread_notification_count":
      return db.rows("notifications").filter(n => n.user_id === args.p_user_id && !n.read).length;

    case "get_creator_track_record": {
      const id = args.target_creator_id;
      const paid = db.rows("applications").filter(a => a.creator_id === id && a.status === "paid");
      const reviews = db.rows("creator_reviews").filter(r => r.creator_id === id);
      return [{
        completed_campaigns: paid.length,
        avg_turnaround_hours: average(paid.map(a => hoursBetween(a.responded_at, a.deliverable_uploaded_at)).filter((h): h is number => h !== null)),
        avg_rating: average(reviews.map(r => Number(r.rating))),
        review_count: reviews.length,
      }];
    }

    case "get_brand_track_record": {
      const id = args.target_brand_id;
      const mine = new Set(db.rows("campaigns").filter(c => c.brand_id === id).map(c => c.id));
      const apps = db.rows("applications").filter(a => mine.has(a.campaign_id));
      const reviews = db.rows("brand_reviews").filter(r => r.brand_id === id);
      return [{
        completed_campaigns: apps.filter(a => a.status === "paid").length,
        avg_response_hours: average(apps.map(a => hoursBetween(a.created_at, a.responded_at)).filter((h): h is number => h !== null)),
        avg_rating: average(reviews.map(r => Number(r.rating))),
        review_count: reviews.length,
      }];
    }

    // No card is ever saved in the demo, so the brand always enters one fresh.
    case "get_own_saved_card":
      return [{ stripe_payment_method_id: null, card_last4: null, card_brand: null }];

    case "request_deliverable_revision": {
      const app = db.rows("applications").find(a => a.id === args.p_application_id);
      if (!app) throw new PgError(400, "P0001", "We couldn't find that deal.");
      if (app.status !== "funded") throw new PgError(400, "P0001", "A new video can only be requested once the deal is paid.");
      if (!app.deliverable_url) throw new PgError(400, "P0001", "There's no video to replace yet.");
      if ((app.revision_count ?? 0) >= 2) throw new PgError(400, "P0001", "You've already asked for two new videos on this deal.");
      const campaign = db.rows("campaigns").find(c => c.id === app.campaign_id);
      db.update("applications", [app], {
        deliverable_url: null,
        deliverable_uploaded_at: null,
        revision_count: (app.revision_count ?? 0) + 1,
        revision_note: String(args.p_note ?? ""),
        revision_requested_at: new Date().toISOString(),
      });
      notifyUser(ctx, app.creator_id, "revision_requested", "New Video Requested", `The brand asked for another video for "${campaign?.name ?? "your campaign"}": ${args.p_note}`, { campaign_id: app.campaign_id, application_id: app.id });
      return null;
    }

    case "respond_to_dispute": {
      const dispute = db.rows("disputes").find(d => d.id === args.p_dispute_id);
      if (!dispute) throw new PgError(400, "P0001", "We couldn't find that dispute.");
      db.update("disputes", [dispute], { creator_response: String(args.p_response ?? "") });
      return null;
    }

    // Moderation tools belong to the real admin only.
    case "admin_list_users":
    case "admin_open_disputes":
    case "admin_dispute_chat":
    case "admin_set_account_status":
    case "approve_verification_request":
    case "reject_verification_request":
    case "resolve_report":
      throw new PgError(403, "42501", "That isn't available in the demo.");

    default:
      throw new PgError(404, "PGRST202", `Could not find the function public.${fn} in the schema cache`);
  }
}
