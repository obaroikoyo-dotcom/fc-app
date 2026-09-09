import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google access tokens are short-lived (~1h) - refresh proactively if this
// one is expired or close to it, since a creator/brand could be posting
// well after they originally connected.
async function getFreshAccessToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: connection } = await supabase
    .from("social_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", "youtube")
    .single();

  if (!connection) throw new Error("YouTube is not connected for this account.");

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return connection.access_token;
  }

  if (!connection.refresh_token) throw new Error("YouTube connection expired - reconnect the account.");

  const clientId = Deno.env.get("GOOGLE_YOUTUBE_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GOOGLE_YOUTUBE_CLIENT_SECRET") ?? "";
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });
  const refreshData = await refreshRes.json();
  if (!refreshData.access_token) throw new Error("Failed to refresh YouTube token: " + JSON.stringify(refreshData));

  await supabase.from("social_connections").update({
    access_token: refreshData.access_token,
    expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
  }).eq("user_id", userId).eq("platform", "youtube");

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

    const withinLimit = await checkRateLimit(supabase, "youtube-post-content", clientIdentifier(req, user.id), {
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
      // A brand can only post the creator's content to their own YouTube
      // once the creator has actually been paid - never allow a brand to
      // use the work before the creator has been compensated for it.
      if (application.status !== "paid") {
        throw new Error("The creator hasn't been paid for this campaign yet - payment must complete before you can post this content.");
      }
    } else {
      throw new Error("Not authorized for this application");
    }

    const accessToken = await getFreshAccessToken(supabase, user.id);

    // Same buffer-then-push approach as tiktok-post-video - YouTube's
    // resumable upload also accepts pushing the bytes directly rather than
    // needing a pre-verified domain, so this sidesteps that entirely.
    const videoRes = await fetch(application.deliverable_url);
    if (!videoRes.ok) throw new Error(`Failed to fetch deliverable video (${videoRes.status})`);
    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());
    const videoSize = videoBytes.byteLength;
    if (videoSize === 0) throw new Error("Deliverable video is empty");

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(videoSize),
        },
        body: JSON.stringify({
          snippet: {
            title: `${campaign?.name || "FlipCollab campaign"}`,
            categoryId: "22",
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );
    if (!initRes.ok) {
      const initErr = await initRes.json().catch(() => ({}));
      throw new Error("YouTube post init failed: " + JSON.stringify(initErr));
    }
    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) throw new Error("YouTube post init failed: no upload URL returned");

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoSize),
      },
      body: videoBytes,
    });
    const uploadData = await uploadRes.json();
    const videoId = uploadData?.id;
    if (!videoId) throw new Error("Uploading video to YouTube failed: " + JSON.stringify(uploadData));

    const { data: post, error: insertError } = await supabase.from("campaign_posts").insert({
      application_id,
      posted_by_user_id: user.id,
      posted_by_role: postedByRole,
      platform: "youtube",
      youtube_video_id: videoId,
      status: "processing",
    }).select().single();
    if (insertError) throw new Error("Failed to record post: " + insertError.message);

    return new Response(JSON.stringify({ campaign_post_id: post.id, video_id: videoId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("youtube-post-content error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
