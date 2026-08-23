import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const withinLimit = await checkRateLimit(supabaseAdmin, "connect-account-status", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 30,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { creator_id } = await req.json().catch(() => ({ creator_id: undefined }));

    // Checking someone ELSE's status (used by the brand's pay-flow soft
    // warning) only ever returns the one non-sensitive boolean it needs -
    // never the account id or other detail, and never hits Stripe (reads
    // the cached flag, refreshed whenever that creator visits their own
    // Payouts screen).
    if (creator_id && creator_id !== caller.id) {
      const { data } = await supabaseAdmin
        .from("creator_stripe_accounts")
        .select("payouts_enabled")
        .eq("user_id", creator_id)
        .maybeSingle();
      return new Response(JSON.stringify({ payouts_enabled: !!data?.payouts_enabled }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await supabaseAdmin
      .from("creator_stripe_accounts")
      .select("stripe_account_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({ connected: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeRes = await fetch(`https://api.stripe.com/v1/accounts/${account.stripe_account_id}`, {
      headers: { "Authorization": `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}` },
    });
    const stripeAccount = await stripeRes.json();
    if (!stripeAccount.id) throw new Error("Failed to read Stripe account: " + JSON.stringify(stripeAccount));

    const flags = {
      charges_enabled: !!stripeAccount.charges_enabled,
      payouts_enabled: !!stripeAccount.payouts_enabled,
      details_submitted: !!stripeAccount.details_submitted,
    };

    await supabaseAdmin.from("creator_stripe_accounts").update({
      ...flags,
      updated_at: new Date().toISOString(),
    }).eq("user_id", caller.id);

    return new Response(JSON.stringify({ connected: true, ...flags }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("connect-account-status error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
