import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { campaign_post_id } = await req.json();
    if (!campaign_post_id) throw new Error("campaign_post_id is required");

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) throw new Error("Not authenticated");

    const { data: post, error: postError } = await supabase
      .from("campaign_posts")
      .select("id, application_id, posted_by_user_id, posted_by_role, tiktok_publish_id, status")
      .eq("id", campaign_post_id)
      .single();
    if (postError || !post) throw new Error("Post not found");
    if (post.posted_by_user_id !== user.id) throw new Error("Not authorized for this post");

    // Already resolved - no need to hit TikTok again.
    if (post.status !== "processing") {
      return new Response(JSON.stringify({ status: post.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const accessToken = await getFreshAccessToken(supabase, user.id);
    const statusRes = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: post.tiktok_publish_id }),
    });
    const statusData = await statusRes.json();
    const tiktokStatus = statusData?.data?.status;

    if (tiktokStatus === "PUBLISH_COMPLETE") {
      // TikTok's status response doesn't reliably include a direct link
      // for SELF_ONLY posts (only the poster can view it anyway) - leave
      // this null rather than guess at an unverified field/URL shape.
      const postUrl: string | null = null;

      await supabase.from("campaign_posts").update({
        status: "published",
        published_at: new Date().toISOString(),
        post_url: postUrl,
      }).eq("id", campaign_post_id);

      // Auto-release: only when the CREATOR's own post just went live for
      // a deal that opted into the TikTok-gated flow, and only if it
      // hasn't already been released some other way (e.g. the brand's
      // manual release button).
      if (post.posted_by_role === "creator") {
        const { data: application } = await supabase
          .from("applications")
          .select("id, campaign_id, creator_id, payout_release_mode, status")
          .eq("id", post.application_id)
          .single();

        if (application && application.payout_release_mode === "tiktok_gated" && application.status !== "paid") {
          await supabase.from("applications").update({ status: "paid" }).eq("id", application.id);
          await supabase.from("transactions").update({ status: "completed" })
            .eq("campaign_id", application.campaign_id)
            .eq("creator_id", application.creator_id)
            .eq("status", "pending");
        }
      }

      return new Response(JSON.stringify({ status: "published", post_url: postUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (tiktokStatus === "FAILED") {
      await supabase.from("campaign_posts").update({ status: "failed" }).eq("id", campaign_post_id);
      return new Response(JSON.stringify({ status: "failed", detail: statusData?.data?.fail_reason }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ status: "processing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("tiktok-post-status error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
