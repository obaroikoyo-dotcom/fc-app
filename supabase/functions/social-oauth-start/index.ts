import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CALLBACK_URL = "https://otbcvpgtxxidgtbxgzpo.supabase.co/functions/v1/social-oauth-callback";

// The state param has to survive a round trip to Instagram/TikTok and back
// with no server-side session to check against, so it carries its own
// signature: whoever generated it must have known SOCIAL_OAUTH_STATE_SECRET,
// which only this function and social-oauth-callback have access to.
async function signState(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${payload}.${sigHex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { platform } = await req.json();
    if (platform !== "instagram" && platform !== "tiktok") {
      throw new Error("Unsupported platform");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) throw new Error("Not authenticated");

    const withinLimit = await checkRateLimit(supabase, "social-oauth-start", clientIdentifier(req, user.id), {
      windowSeconds: 60,
      maxRequests: 10,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const stateSecret = Deno.env.get("SOCIAL_OAUTH_STATE_SECRET") ?? "";
    const payload = `${user.id}:${platform}:${crypto.randomUUID()}`;
    const state = await signState(payload, stateSecret);

    let authorizeUrl: string;
    if (platform === "instagram") {
      const clientId = Deno.env.get("INSTAGRAM_CLIENT_ID") ?? "";
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: CALLBACK_URL,
        response_type: "code",
        scope: "instagram_business_basic",
        state,
      });
      authorizeUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;
    } else {
      const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
      const params = new URLSearchParams({
        client_key: clientKey,
        redirect_uri: CALLBACK_URL,
        response_type: "code",
        scope: "user.info.basic,user.info.stats,video.list,video.publish",
        state,
      });
      authorizeUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    }

    return new Response(JSON.stringify({ url: authorizeUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("social-oauth-start error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
