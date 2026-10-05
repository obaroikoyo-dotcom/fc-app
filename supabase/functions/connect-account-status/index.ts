import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";
import { releasePayoutForApplication } from "../_shared/releasePayout.ts";

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

    // "Instant" deals try to release the moment the brand pays - but if the
    // creator hadn't finished payout setup yet, that attempt couldn't go
    // anywhere and the money stayed held as "funded". Once payouts are
    // confirmed active, release the ones that were only waiting on that -
    // but only where the creator has actually delivered something, so money
    // is never released for work that hasn't been handed over. Post-gated
    // deals, disputed deals and anything without a deliverable are left
    // alone. releasePayoutForApplication re-verifies a real charge exists and
    // claims the transaction atomically, so this can't double-pay.
    let releasedCount = 0;
    if (flags.payouts_enabled) {
      try {
        const { data: waiting } = await supabaseAdmin
          .from("applications")
          .select("id")
          .eq("creator_id", caller.id)
          .eq("status", "funded")
          .eq("payout_release_mode", "instant")
          .not("deliverable_url", "is", null);
        for (const app of waiting ?? []) {
          try {
            const result = await releasePayoutForApplication(supabaseAdmin, app.id);
            if (result.released && !result.alreadyReleased) releasedCount++;
          } catch (releaseErr) {
            console.error("Auto-release after payout setup failed for application", app.id, releaseErr);
          }
        }
      } catch (lookupErr) {
        console.error("Looking up deals waiting on payout setup failed:", lookupErr);
      }
    }

    return new Response(JSON.stringify({ connected: true, ...flags, released_count: releasedCount }), {
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
