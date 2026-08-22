import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "obaroikoyo@gmail.com";
// Supabase's documented convention for an effectively-permanent ban -
// there's no dedicated "banned forever" value, just a very long duration.
const PERMANENT_BAN_DURATION = "876000h";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // This function (like every other one in this project) isn't gated by
    // verify_jwt, so the admin check has to happen here - confirm the
    // CALLER's own session belongs to the admin account before touching
    // anyone's ability to sign in.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();

    if (callerError || !caller || caller.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const withinLimit = await checkRateLimit(supabaseAdmin, "moderate-user", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 20,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { user_id, action } = await req.json();
    if (!user_id || (action !== "ban" && action !== "unban")) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      ban_duration: action === "ban" ? PERMANENT_BAN_DURATION : "none",
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
