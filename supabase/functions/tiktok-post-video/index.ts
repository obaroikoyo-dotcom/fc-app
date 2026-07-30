import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TikTok access tokens are short-lived (~24h) - refresh proactively if
// this one is expired or close to it, since a creator/brand could be
// posting well after they originally connected.
async function getFreshAccessToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: connection } = await supabase
    .from("social_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", "tiktok")
    .single();

  if (!connection) throw new Error("TikTok is not connected for this account.");

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return connection.access_token;
  }

  if (!connection.refresh_token) throw new Error("TikTok connection expired - reconnect the account.");

  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
  const refreshRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });
  const refreshData = await refreshRes.json();
  if (!refreshData.access_token) throw new Error("Failed to refresh TikTok token: " + JSON.stringify(refreshData));

  await supabase.from("social_connections").update({
    access_token: refreshData.access_token,
    refresh_token: refreshData.refresh_token || connection.refresh_token,
    expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
  }).eq("user_id", userId).eq("platform", "tiktok");

  return refreshData.access_token;
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
      // A brand can only post the creator's content to their own TikTok
      // once the creator has actually been paid - never allow a brand to
      // use the work before the creator has been compensated for it.
      if (application.status !== "paid") {
        throw new Error("The creator hasn't been paid for this campaign yet - payment must complete before you can post this content.");
      }
    } else {
      throw new Error("Not authorized for this application");
    }

    const accessToken = await getFreshAccessToken(supabase, user.id);

    const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: `${campaign?.name || "FlipCollab campaign"}`,
          privacy_level: "SELF_ONLY",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: application.deliverable_url,
        },
      }),
    });
    const initData = await initRes.json();
    const publishId = initData?.data?.publish_id;
    if (!publishId) throw new Error("TikTok post init failed: " + JSON.stringify(initData));

    const { data: post, error: insertError } = await supabase.from("campaign_posts").insert({
      application_id,
      posted_by_user_id: user.id,
      posted_by_role: postedByRole,
      platform: "tiktok",
      tiktok_publish_id: publishId,
      status: "processing",
    }).select().single();
    if (insertError) throw new Error("Failed to record post: " + insertError.message);

    return new Response(JSON.stringify({ campaign_post_id: post.id, publish_id: publishId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("tiktok-post-video error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
