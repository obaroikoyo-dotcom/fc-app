import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Instagram's long-lived tokens last ~60 days and can only be refreshed
// once they're at least 24h old - refresh proactively once there's less
// than 5 days left, which comfortably clears that minimum-age requirement
// for any token that's actually due, and just falls through to using the
// still-valid current token if a refresh attempt fails for any reason.
async function getFreshAccessToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ accessToken: string; igUserId: string }> {
  const { data: connection } = await supabase
    .from("social_connections")
    .select("access_token, expires_at, platform_user_id")
    .eq("user_id", userId)
    .eq("platform", "instagram")
    .single();

  if (!connection) throw new Error("Instagram is not connected for this account.");
  if (!connection.platform_user_id) throw new Error("Instagram connection is missing an account id - reconnect the account.");

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  if (expiresAt > Date.now() + fiveDaysMs) {
    return { accessToken: connection.access_token, igUserId: connection.platform_user_id };
  }

  try {
    const refreshRes = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${connection.access_token}`
    );
    const refreshData = await refreshRes.json();
    if (refreshData.access_token) {
      await supabase.from("social_connections").update({
        access_token: refreshData.access_token,
        expires_at: new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000).toISOString(),
      }).eq("user_id", userId).eq("platform", "instagram");
      return { accessToken: refreshData.access_token, igUserId: connection.platform_user_id };
    }
  } catch (err) {
    console.error("Instagram token refresh failed, using existing token:", err);
  }

  if (expiresAt < Date.now()) throw new Error("Instagram connection expired - reconnect the account.");
  return { accessToken: connection.access_token, igUserId: connection.platform_user_id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { application_id } = await req.json();
    if (!application_id) throw new Error("application_id is required");

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) throw new Error("Not authenticated");

    const withinLimit = await checkRateLimit(supabase, "instagram-post-content", clientIdentifier(req, user.id), {
      windowSeconds: 600,
      maxRequests: 5,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id, creator_id, deliverable_url, payout_release_mode, status, campaigns(brand_id, name)")
      .eq("id", application_id)
      .single();
    if (appError || !application) throw new Error("Application not found");
    if (!application.deliverable_url) throw new Error("No deliverable video uploaded for this application yet");

    const campaign = application.campaigns as any;
    let postedByRole: "creator" | "brand";
    if (user.id === application.creator_id) {
      postedByRole = "creator";
    } else if (user.id === campaign?.brand_id) {
      postedByRole = "brand";
      // A brand can only post the creator's content to their own Instagram
      // once the creator has actually been paid - never allow a brand to
      // use the work before the creator has been compensated for it.
      if (application.status !== "paid") {
        throw new Error("The creator hasn't been paid for this campaign yet - payment must complete before you can post this content.");
      }
    } else {
      throw new Error("Not authorized for this application");
    }

    const { accessToken, igUserId } = await getFreshAccessToken(supabase, user.id);

    // Instagram's Content Publishing API fetches the video itself from a
    // public URL server-side (unlike TikTok, which required us to push the
    // bytes) - the R2-hosted deliverable URL works directly here.
    const containerParams = new URLSearchParams({
      media_type: "REELS",
      video_url: application.deliverable_url,
      caption: `${campaign?.name || "FlipCollab campaign"}`,
      access_token: accessToken,
    });
    const containerRes = await fetch(`https://graph.instagram.com/${igUserId}/media`, {
      method: "POST",
      body: containerParams,
    });
    const containerData = await containerRes.json();
    const containerId = containerData?.id;
    if (!containerId) {
      throw new Error("Instagram post init failed: " + JSON.stringify(containerData));
    }

    const { data: post, error: insertError } = await supabase.from("campaign_posts").insert({
      application_id,
      posted_by_user_id: user.id,
      posted_by_role: postedByRole,
      platform: "instagram",
      ig_container_id: containerId,
      status: "processing",
    }).select().single();
    if (insertError) throw new Error("Failed to record post: " + insertError.message);

    return new Response(JSON.stringify({ campaign_post_id: post.id, container_id: containerId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("instagram-post-content error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
