import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function stripeFetch(path: string, params: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  return res.json();
}

// Returns a client_secret for Stripe's embedded Connect components
// (onboarding + ongoing account management), rendered inline in
// CreatorProfile's Payouts screen - no redirect to a Stripe-hosted page.
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

    const withinLimit = await checkRateLimit(supabaseAdmin, "connect-account-session", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 10,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { country } = await req.json().catch(() => ({ country: undefined }));

    let { data: account } = await supabaseAdmin
      .from("creator_stripe_accounts")
      .select("stripe_account_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!account) {
      if (!country || typeof country !== "string" || country.length !== 2) {
        return new Response(JSON.stringify({ error: "A valid two-letter country code is required to set up payouts." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stripeAccount = await stripeFetch("accounts", new URLSearchParams({
        country: country.toUpperCase(),
        email: caller.email ?? "",
        "capabilities[transfers][requested]": "true",
        "controller[stripe_dashboard][type]": "none",
        "controller[fees][payer]": "application",
        "controller[losses][payments]": "application",
        "controller[requirement_collection]": "stripe",
      }));
      if (!stripeAccount.id) {
        throw new Error("Failed to create Stripe account: " + JSON.stringify(stripeAccount));
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("creator_stripe_accounts")
        .insert({ user_id: caller.id, stripe_account_id: stripeAccount.id, country: country.toUpperCase() })
        .select("stripe_account_id")
        .single();
      if (insertError || !inserted) throw new Error("Failed to save Stripe account: " + insertError?.message);
      account = inserted;
    }

    const session = await stripeFetch("account_sessions", new URLSearchParams({
      account: account.stripe_account_id,
      "components[account_onboarding][enabled]": "true",
      "components[account_management][enabled]": "true",
      "components[payouts][enabled]": "true",
    }));
    if (!session.client_secret) {
      throw new Error("Failed to create account session: " + JSON.stringify(session));
    }

    return new Response(JSON.stringify({ client_secret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("connect-account-session error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
