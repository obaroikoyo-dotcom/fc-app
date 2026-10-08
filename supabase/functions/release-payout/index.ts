import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";
import { releasePayoutForApplication } from "../_shared/releasePayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONESIGNAL_APP_ID = "66adae38-64f2-425f-b984-83e65f99ce1f";

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

// Replaces the old client-side "flip applications.status to paid" release
// calls - creating the actual Stripe Transfer needs the secret key, so this
// can no longer happen directly from the browser. Called when the brand
// answers "Are you happy with the content?" with yes.
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

    const withinLimit = await checkRateLimit(supabaseAdmin, "release-payout", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 20,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { application_id } = await req.json();
    if (!application_id) throw new Error("application_id is required");

    const { data: application, error: appError } = await supabaseAdmin
      .from("applications")
      .select("id, status, creator_id, campaign_id, campaigns(brand_id, name)")
      .eq("id", application_id)
      .single();
    if (appError || !application) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaign = application.campaigns as any;
    if (!campaign || caller.id !== campaign.brand_id) {
      return new Response(JSON.stringify({ error: "Not authorized for this application" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (application.status === "paid") {
      return new Response(JSON.stringify({ released: true, alreadyReleased: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (application.status !== "funded") {
      return new Response(JSON.stringify({ error: "Nothing to release for this application" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await releasePayoutForApplication(supabaseAdmin, application_id);

    if (result.released) {
      // Tell the creator the money is on its way (the brand just said they're
      // happy). Best-effort: the release has already happened, so a failed
      // notification must never turn this into an error.
      if (!result.alreadyReleased) {
        try {
          await notify(supabaseAdmin, application.creator_id, "payout_released", "Payment Released",
            `The brand is happy with your content for "${campaign.name ?? "your campaign"}", so your payment has been released to your account. It will reach your bank on Stripe's usual payout schedule.`,
            { application_id: application.id, campaign_id: application.campaign_id });
        } catch (notifyErr) {
          console.error("release-payout: creator notification failed:", notifyErr);
        }
      }
      return new Response(JSON.stringify({ released: true, transfer_id: result.transferId, alreadyReleased: result.alreadyReleased }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.reason === "not_connected") {
      return new Response(JSON.stringify({ error: "This creator hasn't finished setting up payouts yet." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: result.error || "Failed to release payout" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("release-payout error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
