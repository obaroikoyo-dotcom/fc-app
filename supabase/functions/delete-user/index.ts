import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";
import { wipeAllUserMedia } from "../_shared/r2Client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // This function (like every other one in this project) isn't gated by
    // verify_jwt, so confirm the caller is deleting their OWN account before
    // touching auth.admin - previously anyone who found this URL could
    // delete any user by id.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller || caller.id !== user_id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const withinLimit = await checkRateLimit(supabaseAdmin, "delete-user", clientIdentifier(req, caller.id), {
      windowSeconds: 3600,
      maxRequests: 3,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    // Deleting the account cascades to applications, so any deal with money
    // still held would be orphaned - its escrow could never be released or
    // refunded afterwards. Refuse until every open payment has been settled.
    const { data: openDeals } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .or(`brand_id.eq.${user_id},creator_id.eq.${user_id}`)
      .in("status", ["pending", "completed"])
      .is("stripe_transfer_id", null)
      .limit(1);
    if (openDeals && openDeals.length > 0) {
      return new Response(JSON.stringify({
        error: "You have a deal with funds still held in escrow. Finish or resolve it before deleting your account.",
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // A brand with an Enterprise subscription must not keep being billed after
    // its account is gone, so cancel it at Stripe first. If that can't be done
    // the account is left alone and the user is told, rather than deleted with a
    // live subscription behind it. A subscription Stripe no longer has (or has
    // already ended) is fine.
    const { data: brand } = await supabaseAdmin
      .from("brand_profiles")
      .select("stripe_subscription_id")
      .eq("id", user_id)
      .maybeSingle();
    if (brand?.stripe_subscription_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      const subUrl = `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(brand.stripe_subscription_id)}`;
      const subRes = await fetch(subUrl, { headers: { "Authorization": `Bearer ${stripeKey}` } });
      const sub = await subRes.json();
      const alreadyGone = sub.error?.code === "resource_missing" || sub.status === "canceled";
      if (!alreadyGone) {
        if (sub.error) {
          console.error("delete-user: couldn't read subscription", sub.error);
          return new Response(JSON.stringify({
            error: "We couldn't cancel your Enterprise subscription, so your account hasn't been deleted. Please try again in a moment.",
          }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const cancelRes = await fetch(subUrl, { method: "DELETE", headers: { "Authorization": `Bearer ${stripeKey}` } });
        const canceled = await cancelRes.json();
        if (canceled.error && canceled.error.code !== "resource_missing") {
          console.error("delete-user: couldn't cancel subscription", canceled.error);
          return new Response(JSON.stringify({
            error: "We couldn't cancel your Enterprise subscription, so your account hasn't been deleted. Please try again in a moment.",
          }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Deleting the DB rows (or the auth user, which cascades to them) never
    // touched storage - uploaded files were left behind forever, silently
    // eating quota. Best-effort cleanup before the account itself goes;
    // failures here shouldn't block the actual account deletion.
    try {
      await wipeAllUserMedia(supabaseAdmin, user_id);
    } catch (storageErr) {
      console.error("Storage cleanup failed (continuing with account deletion):", storageErr);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});