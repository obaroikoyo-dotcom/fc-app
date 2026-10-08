import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONESIGNAL_APP_ID = "66adae38-64f2-425f-b984-83e65f99ce1f";

// In-app notification row plus a push, written with the service role (the
// caller isn't allowed to notify the admin, so this can't go through the
// client-side notify path).
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

// Only the brand on a still-"funded" (delivered, not yet released) deal can
// raise a dispute, and only within the same review window auto-release
// works off (5 days - keep in step with auto-release-payments and
// src/lib/review.ts) - past that, auto-release will already have paid the creator.
const REVIEW_WINDOW_DAYS = 5;
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const withinLimit = await checkRateLimit(supabaseAdmin, "raise-dispute", clientIdentifier(req, caller.id), {
      windowSeconds: 3600,
      maxRequests: 10,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { application_id, reason } = await req.json();
    if (!application_id || typeof reason !== "string" || !reason.trim()) {
      return new Response(JSON.stringify({ error: "application_id and a reason are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: application } = await supabaseAdmin
      .from("applications")
      .select("id, creator_id, campaign_id, status, deliverable_uploaded_at, revision_requested_at, campaigns!inner(brand_id, name)")
      .eq("id", application_id)
      .maybeSingle();

    const brandId = (application as any)?.campaigns?.brand_id;
    const isBrand = !!application && brandId === caller.id;
    const isCreator = !!application && application.creator_id === caller.id;
    if (!application || (!isBrand && !isCreator)) {
      return new Response(JSON.stringify({ error: "Not authorized for this application" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (application.status !== "funded") {
      return new Response(JSON.stringify({ error: "This deal isn't in a disputable state (already released, rejected, or not yet delivered)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const raisedBy = isBrand ? "brand" : "creator";
    if (isBrand) {
      if (!application.deliverable_uploaded_at) {
        return new Response(JSON.stringify({ error: "Nothing has been delivered yet for this deal." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const daysSinceDelivery = (Date.now() - new Date(application.deliverable_uploaded_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > REVIEW_WINDOW_DAYS) {
        return new Response(JSON.stringify({ error: `The ${REVIEW_WINDOW_DAYS}-day window to report a problem with this delivery has passed.` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!application.revision_requested_at || application.deliverable_uploaded_at) {
      // A creator can only dispute while a brand's request for another video
      // is outstanding. Otherwise there's nothing to dispute: their delivery
      // is either still being reviewed (auto-release protects them) or paid.
      return new Response(JSON.stringify({ error: "You can only dispute a request for another video while you're waiting to resend it." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabaseAdmin.from("disputes").insert({
      application_id,
      brand_id: brandId,
      creator_id: application.creator_id,
      reason: reason.trim(),
      raised_by: raisedBy,
    });
    if (insertError) throw insertError;

    await supabaseAdmin.from("applications").update({ status: "disputed", disputed_at: new Date().toISOString() }).eq("id", application_id);

    // Nobody was being told: the admin had no way to know a dispute existed
    // unless they happened to open the review screen, and the creator only
    // found out by seeing the chat card change. Best-effort - the dispute is
    // already recorded, so a failed notification must never fail the request.
    const campaignName = (application as any).campaigns?.name ?? "a campaign";
    const shortReason = reason.trim().slice(0, 140);
    try {
      const { data: adminId } = await supabaseAdmin.rpc("get_admin_user_id");
      const ids = { application_id, campaign_id: (application as any).campaign_id };
      if (isBrand) {
        if (adminId) {
          await notify(supabaseAdmin, adminId as string, "dispute_raised", "New Dispute",
            `A brand disputed the delivery for "${campaignName}": ${shortReason}`, ids);
        }
        await notify(supabaseAdmin, application.creator_id, "dispute_raised", "Delivery Disputed",
          `The brand raised a dispute on "${campaignName}". The funds stay held while FlipCollab reviews it. You can add your side in the chat, and you'll be told once it's resolved.`, ids);
      } else {
        if (adminId) {
          await notify(supabaseAdmin, adminId as string, "dispute_raised", "New Dispute (from creator)",
            `A creator disputed a request for another video on "${campaignName}": ${shortReason}`, ids);
        }
        await notify(supabaseAdmin, brandId, "dispute_raised", "Video Request Disputed",
          `The creator disputed your request for another video on "${campaignName}". The funds stay held while FlipCollab reviews it, and you'll be told once it's resolved.`, ids);
      }
    } catch (err) {
      console.error("raise-dispute notifications failed:", err);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("raise-dispute error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
