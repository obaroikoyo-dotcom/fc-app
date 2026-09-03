import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Only the brand on a still-"funded" (delivered, not yet released) deal can
// raise a dispute, and only within the same 7-day window auto-release
// works off - past that, auto-release will already have paid the creator.
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
      .select("id, creator_id, status, deliverable_uploaded_at, campaigns!inner(brand_id, name)")
      .eq("id", application_id)
      .maybeSingle();

    const brandId = (application as any)?.campaigns?.brand_id;
    if (!application || brandId !== caller.id) {
      return new Response(JSON.stringify({ error: "Not authorized for this application" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (application.status !== "funded") {
      return new Response(JSON.stringify({ error: "This deal isn't in a disputable state (already released, rejected, or not yet delivered)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!application.deliverable_uploaded_at) {
      return new Response(JSON.stringify({ error: "Nothing has been delivered yet for this deal." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const daysSinceDelivery = (Date.now() - new Date(application.deliverable_uploaded_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 7) {
      return new Response(JSON.stringify({ error: "The 7-day window to dispute this delivery has passed." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabaseAdmin.from("disputes").insert({
      application_id,
      brand_id: caller.id,
      creator_id: application.creator_id,
      reason: reason.trim(),
    });
    if (insertError) throw insertError;

    await supabaseAdmin.from("applications").update({ status: "disputed", disputed_at: new Date().toISOString() }).eq("id", application_id);

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
