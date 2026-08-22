import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONESIGNAL_APP_ID = "66adae38-64f2-425f-b984-83e65f99ce1f";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, data } = await req.json();
    if (!user_id || !title) throw new Error("Missing user_id or title");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // This function (like every other one in this project) isn't gated by
    // verify_jwt, so confirm the caller is a signed-in FlipCollab user
    // before dispatching - previously anyone who found this URL could spam
    // push notifications to any user id. The target user_id legitimately
    // differs from the caller (e.g. a brand action notifies a creator), so
    // this only checks that SOME real session made the request, not that
    // it's the target's own.
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
    const withinLimit = await checkRateLimit(supabaseAdmin, "send-push", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 20,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (!restApiKey) throw new Error("Missing ONESIGNAL_REST_API_KEY");

    // Targets the subscriber(s) linked to this Supabase user id via
    // OneSignal.login(userId) on the client (src/lib/onesignal.ts).
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        include_aliases: { external_id: [user_id] },
        headings: { en: title },
        contents: { en: body ?? "" },
        data: data ?? {},
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(`OneSignal error: ${JSON.stringify(result)}`);

    // A non-empty id means OneSignal accepted and dispatched the message;
    // an empty string id means the request was valid but no subscriber
    // matched the target external_id.
    const sent = typeof result.id === "string" && result.id.length > 0 ? 1 : 0;
    return new Response(JSON.stringify({ sent, id: result.id }), {
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
