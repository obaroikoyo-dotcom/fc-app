import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";
import { releasePayoutForApplication } from "../_shared/releasePayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Replaces the old client-side "flip applications.status to paid" release
// calls (Messages.tsx's manual-release button and its ungated instant-pay
// path) - creating the actual Stripe Transfer needs the secret key, so this
// can no longer happen directly from the browser.
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
      .select("id, status, campaigns(brand_id)")
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
