import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";
import { releasePayoutForApplication, refundApplication } from "../_shared/releasePayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "obaroikoyo@gmail.com";

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
    if (callerError || !caller || caller.email !== ADMIN_EMAIL) {
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
