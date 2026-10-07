import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { releasePayoutForApplication, refundApplication } from "../_shared/releasePayout.ts";

const ONESIGNAL_APP_ID = "66adae38-64f2-425f-b984-83e65f99ce1f";
const DAY_MS = 24 * 60 * 60 * 1000;

// In-app notification row plus a push, written with the service role.
async function notify(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  await supabaseAdmin.from("notifications").insert({ user_id: userId, type, title, body, data });
  const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  if (!restApiKey) return;
  await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Key ${restApiKey}` },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      include_aliases: { external_id: [userId] },
      headings: { en: title },
      contents: { en: body },
      data,
    }),
  });
}

// Runs on a schedule (see the pg_cron migration) - a delivered deal the
// brand hasn't released *or* disputed within 7 days releases itself, so a
// creator who's actually done the work is never stuck waiting on a brand
// that's gone quiet. A dispute raised inside that window (application
// status flips to "disputed") is excluded here - it's already accounted
// for by the status filter below, not by a separate check.
serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const realSecret = Deno.env.get("CLEANUP_SECRET") ?? "";

  // Shares the same cron secret r2-scheduled-cleanup bootstraps into
  // Postgres - no need for a second one.
  if (realSecret) {
    await supabaseAdmin.rpc("set_app_secret", { p_key: "cleanup_secret", p_value: realSecret });
  }

  const providedSecret = req.headers.get("x-cleanup-secret");
  // Constant-time compare so the secret can't be recovered by timing responses.
  const secretsMatch = !!providedSecret && !!realSecret && providedSecret.length === realSecret.length &&
    [...providedSecret].reduce((diff, ch, i) => diff | (ch.charCodeAt(0) ^ realSecret.charCodeAt(i)), 0) === 0;
  if (!secretsMatch) {
    return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const results = { released: 0, refunded: 0, errors: [] as string[] };

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: due } = await supabaseAdmin
      .from("applications")
      .select("id, creator_id")
      .eq("status", "funded")
      .not("deliverable_uploaded_at", "is", null)
      .lte("deliverable_uploaded_at", sevenDaysAgo);

    // A creator who hasn't finished payout setup can't be paid yet. Trying
    // anyway every 15 minutes made the release code add a fresh "Set up
    // payouts" notification on every run (96 a day), so check first and nudge
    // at most once a day instead.
    const creatorIds = [...new Set((due ?? []).map((a: { creator_id: string }) => a.creator_id))];
    const { data: accounts } = creatorIds.length
      ? await supabaseAdmin.from("creator_stripe_accounts").select("user_id, payouts_enabled").in("user_id", creatorIds)
      : { data: [] as { user_id: string; payouts_enabled: boolean }[] };
    const payoutReady = new Set((accounts ?? []).filter((a: { payouts_enabled: boolean }) => a.payouts_enabled).map((a: { user_id: string }) => a.user_id));

    for (const app of due ?? []) {
      try {
        if (!payoutReady.has(app.creator_id)) {
          const { data: recent } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("user_id", app.creator_id)
            .eq("type", "payout_setup_needed")
            .gte("created_at", new Date(Date.now() - DAY_MS).toISOString())
            .contains("data", { application_id: app.id })
            .limit(1);
          if (!recent?.length) {
            await notify(supabaseAdmin, app.creator_id, "payout_setup_needed", "Set up payouts to get paid",
              "Your payout is ready to release, but you need to finish setting up payouts first.", { application_id: app.id });
          }
          continue;
        }
        const result = await releasePayoutForApplication(supabaseAdmin, app.id);
        if (result.released) results.released++;
        else results.errors.push(`application ${app.id}: ${result.reason} - ${result.error ?? ""}`);
      } catch (err) {
        results.errors.push(`application ${app.id}: ${(err as Error).message || err}`);
      }
    }
  } catch (err) {
    results.errors.push(`top-level: ${(err as Error).message || err}`);
  }

  // A brand sent a funded deal back for another video and the creator never
  // delivered one. The brand has no dispute to raise (nothing is delivered),
  // so: warn the creator at day 3 and day 6, then refund the brand at day 7 -
  // the mirror image of the auto-release above. A replacement upload sets
  // deliverable_uploaded_at again, which drops the deal out of this query.
  try {
    const { data: waiting } = await supabaseAdmin
      .from("applications")
      .select("id, creator_id, campaign_id, revision_requested_at, revision_warned_3d_at, revision_warned_6d_at, campaigns!inner(brand_id, name)")
      .eq("status", "funded")
      .is("deliverable_uploaded_at", null)
      .not("revision_requested_at", "is", null);

    for (const app of (waiting ?? []) as any[]) {
      try {
        const ageDays = (Date.now() - new Date(app.revision_requested_at).getTime()) / DAY_MS;
        const campaignName = app.campaigns?.name ?? "your campaign";
        const brandId = app.campaigns?.brand_id;
        const data = { application_id: app.id, campaign_id: app.campaign_id };

        if (ageDays >= 7) {
          const result = await refundApplication(supabaseAdmin, app.id);
          if (!result.refunded) {
            results.errors.push(`refund ${app.id}: ${result.reason} - ${result.error ?? ""}`);
            continue;
          }
          results.refunded++;
          if (brandId) {
            await notify(supabaseAdmin, brandId, "revision_refunded", "Deal Refunded",
              `The creator didn't send a new video for "${campaignName}" within 7 days, so your payment has been refunded.`, data);
          }
          await notify(supabaseAdmin, app.creator_id, "revision_refunded", "Deal Refunded to the Brand",
            `You didn't send the new video for "${campaignName}" within 7 days, so the payment was refunded to the brand.`, data);
        } else if (ageDays >= 6 && !app.revision_warned_6d_at) {
          // Claim the warning first (only one run can win), then send it.
          const { data: claimed } = await supabaseAdmin.from("applications")
            .update({ revision_warned_6d_at: new Date().toISOString() })
            .eq("id", app.id).is("revision_warned_6d_at", null).select("id");
          if (claimed?.length) {
            await notify(supabaseAdmin, app.creator_id, "revision_warning", "1 Day Left",
              `Send your new video for "${campaignName}" within 1 day or the deal is refunded to the brand.`, data);
          }
        } else if (ageDays >= 3 && !app.revision_warned_3d_at) {
          const { data: claimed } = await supabaseAdmin.from("applications")
            .update({ revision_warned_3d_at: new Date().toISOString() })
            .eq("id", app.id).is("revision_warned_3d_at", null).select("id");
          if (claimed?.length) {
            await notify(supabaseAdmin, app.creator_id, "revision_warning", "4 Days Left",
              `The brand is still waiting on your new video for "${campaignName}". Send it within 4 days or the deal is refunded to the brand.`, data);
          }
        }
      } catch (err) {
        results.errors.push(`revision ${app.id}: ${(err as Error).message || err}`);
      }
    }
  } catch (err) {
    results.errors.push(`revision-top-level: ${(err as Error).message || err}`);
  }

  return new Response(JSON.stringify(results), { status: 200, headers: { "Content-Type": "application/json" } });
});
