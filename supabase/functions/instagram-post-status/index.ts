import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";
import { releasePayoutForApplication } from "../_shared/releasePayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const withinLimit = await checkRateLimit(supabase, "instagram-post-status", clientIdentifier(req, user.id), {
      windowSeconds: 60,
      maxRequests: 30,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { data: post, error: postError } = await supabase
      .from("campaign_posts")
      .select("id, application_id, posted_by_user_id, posted_by_role, ig_container_id, status")
      .eq("id", campaign_post_id)
      .single();
    if (postError || !post) throw new Error("Post not found");
    if (post.posted_by_user_id !== user.id) throw new Error("Not authorized for this post");

    // Already resolved - no need to hit Instagram again. Still report
    // payout status since a prior attempt may have published but failed to
    // release (e.g. creator wasn't connected to Stripe yet).
    if (post.status !== "processing") {
      let payoutReleased: boolean | undefined;
      if (post.status === "published") {
        const { data: app } = await supabase.from("applications").select("status").eq("id", post.application_id).single();
        payoutReleased = app?.status === "paid";
      }
      return new Response(JSON.stringify({ status: post.status, payout_released: payoutReleased }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { accessToken } = await getFreshAccessToken(supabase, user.id);
    const statusRes = await fetch(
      `https://graph.instagram.com/${post.ig_container_id}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();
    const containerStatus = statusData?.status_code;

    if (containerStatus === "FINISHED") {
      const { accessToken: publishToken, igUserId } = await getFreshAccessToken(supabase, user.id);
      const publishRes = await fetch(`https://graph.instagram.com/${igUserId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: post.ig_container_id, access_token: publishToken }),
      });
      const publishData = await publishRes.json();
      const mediaId = publishData?.id;
      if (!mediaId) {
        await supabase.from("campaign_posts").update({ status: "failed" }).eq("id", campaign_post_id);
        return new Response(JSON.stringify({ status: "failed", detail: JSON.stringify(publishData) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      let postUrl: string | null = null;
      try {
        const permalinkRes = await fetch(`https://graph.instagram.com/${mediaId}?fields=permalink&access_token=${publishToken}`);
        const permalinkData = await permalinkRes.json();
        postUrl = permalinkData?.permalink || null;
      } catch {
        // Non-fatal - the post itself already succeeded above.
      }

      await supabase.from("campaign_posts").update({
        status: "published",
        published_at: new Date().toISOString(),
        post_url: postUrl,
      }).eq("id", campaign_post_id);

      // Auto-release: only when the CREATOR's own post just went live for
      // a deal that opted into the Instagram-gated flow, and only if it
      // hasn't already been released some other way (e.g. the brand's
      // manual release button).
      let payoutReleased: boolean | undefined;
      let payoutError: string | undefined;
      if (post.posted_by_role === "creator") {
        const { data: application } = await supabase
          .from("applications")
          .select("id, payout_release_mode, status")
          .eq("id", post.application_id)
          .single();

        if (application && application.payout_release_mode === "instagram_gated" && application.status !== "paid") {
          const result = await releasePayoutForApplication(supabase, application.id);
          payoutReleased = result.released;
          if (!result.released) {
            payoutError = result.reason === "not_connected"
              ? "The creator hasn't finished setting up payouts yet."
              : result.error;
          }
        } else {
          payoutReleased = application?.status === "paid";
        }
      }

      return new Response(JSON.stringify({ status: "published", post_url: postUrl, payout_released: payoutReleased, payout_error: payoutError }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (containerStatus === "ERROR" || containerStatus === "EXPIRED") {
      await supabase.from("campaign_posts").update({ status: "failed" }).eq("id", campaign_post_id);
      return new Response(JSON.stringify({ status: "failed", detail: containerStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ status: "processing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("instagram-post-status error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
