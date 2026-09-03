import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Editing is only allowed before the recipient has actually seen the
// message - enforced here, not just hidden client-side, since a client-only
// restriction could be trivially bypassed by anyone calling this directly.
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

    const withinLimit = await checkRateLimit(supabaseAdmin, "edit-message", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 30,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { message_id, text } = await req.json();
    if (!message_id || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "message_id and non-empty text are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: message } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, read_at, deleted_at, video_url, image_url")
      .eq("id", message_id)
      .maybeSingle();

    if (!message || message.sender_id !== caller.id) {
      return new Response(JSON.stringify({ error: "Not authorized for this message" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.deleted_at) {
      return new Response(JSON.stringify({ error: "This message was deleted." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.video_url || message.image_url) {
      return new Response(JSON.stringify({ error: "Media messages can't be edited." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.read_at) {
      return new Response(JSON.stringify({ error: "Can't edit a message that's already been seen." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("messages").update({
      text: text.trim(),
      edited_at: new Date().toISOString(),
    }).eq("id", message_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("edit-message error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
