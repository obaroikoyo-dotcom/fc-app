import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";
import { releasePayoutForApplication, refundApplication } from "../_shared/releasePayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "obaroikoyo@gmail.com";
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
    // Email alone isn't proof of ownership - someone can register with an
    // address they don't control unless it's been confirmed.
    if (callerError || !caller || caller.email !== ADMIN_EMAIL || !caller.email_confirmed_at) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const withinLimit = await checkRateLimit(supabaseAdmin, "resolve-dispute", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 30,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { dispute_id, resolution, admin_notes } = await req.json();
    if (!dispute_id || (resolution !== "refund" && resolution !== "release")) {
      return new Response(JSON.stringify({ error: "dispute_id and resolution ('refund' or 'release') are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: dispute } = await supabaseAdmin.from("disputes").select("id, application_id, status").eq("id", dispute_id).maybeSingle();
    if (!dispute) {
      return new Response(JSON.stringify({ error: "Dispute not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (dispute.status !== "open") {
      return new Response(JSON.stringify({ error: "This dispute has already been resolved." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resolution === "refund") {
      const result = await refundApplication(supabaseAdmin, dispute.application_id);
      if (!result.refunded) {
        return new Response(JSON.stringify({ error: result.error || "Refund failed" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("disputes").update({
        status: "refunded", resolved_at: new Date().toISOString(), resolved_by: caller.id, admin_notes: admin_notes || null,
      }).eq("id", dispute_id);
    } else {
      const result = await releasePayoutForApplication(supabaseAdmin, dispute.application_id);
      if (!result.released) {
        return new Response(JSON.stringify({ error: result.error || "Release failed" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("disputes").update({
        status: "resolved_paid", resolved_at: new Date().toISOString(), resolved_by: caller.id, admin_notes: admin_notes || null,
      }).eq("id", dispute_id);
    }

    // Tell both sides how it came out. Best-effort: the resolution above has
    // already happened, so a failed notification must not fail the request.
    try {
      const { data: app } = await supabaseAdmin
        .from("applications")
        .select("id, creator_id, campaign_id, campaigns!inner(brand_id, name)")
        .eq("id", dispute.application_id)
        .maybeSingle();
      if (app) {
        const campaignName = (app as any).campaigns?.name ?? "your campaign";
        const brandId = (app as any).campaigns?.brand_id;
        const ids = { application_id: app.id, campaign_id: app.campaign_id };
        if (resolution === "refund") {
          if (brandId) await notify(supabaseAdmin, brandId, "dispute_resolved", "Dispute Resolved",
            `FlipCollab reviewed the dispute on "${campaignName}" and refunded your payment.`, ids);
          await notify(supabaseAdmin, app.creator_id, "dispute_resolved", "Dispute Resolved",
            `FlipCollab reviewed the dispute on "${campaignName}" and the payment was refunded to the brand.`, ids);
        } else {
          if (brandId) await notify(supabaseAdmin, brandId, "dispute_resolved", "Dispute Resolved",
            `FlipCollab reviewed the dispute on "${campaignName}" and released the payment to the creator.`, ids);
          await notify(supabaseAdmin, app.creator_id, "dispute_resolved", "Dispute Resolved",
            `FlipCollab reviewed the dispute on "${campaignName}" and released your payout.`, ids);
        }
      }
    } catch (err) {
      console.error("resolve-dispute notifications failed:", err);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("resolve-dispute error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
