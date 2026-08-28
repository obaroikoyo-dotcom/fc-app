import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cancels at the end of the current billing period, not immediately - the
// brand keeps Enterprise (0% fees) through what they already paid for.
// is_enterprise itself only gets flipped back to false later, by
// stripe-webhook's customer.subscription.deleted handler, once the
// subscription actually ends - not here, so a brand can't lose Enterprise
// mid-period just by requesting cancellation.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { brand_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller || caller.id !== brand_id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const withinLimit = await checkRateLimit(supabase, "cancel-subscription", clientIdentifier(req, caller.id), {
      windowSeconds: 600,
      maxRequests: 5,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { data: brand } = await supabase.from("brand_profiles").select("stripe_subscription_id").eq("id", brand_id).single();
    if (!brand?.stripe_subscription_id) {
      throw new Error("No active subscription found.");
    }

    const cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${brand.stripe_subscription_id}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ cancel_at_period_end: "true" }),
    });
    const canceled = await cancelRes.json();
    if (canceled.error) throw new Error(`Stripe cancellation error: ${canceled.error.message}`);

    const { error: dbError } = await supabase
      .from("brand_profiles")
      .update({ subscription_cancel_at_period_end: true })
      .eq("id", brand_id);
    if (dbError) throw new Error(`Supabase update failed: ${dbError.message}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("cancel-subscription error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
