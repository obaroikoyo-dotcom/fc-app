import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = "https://flipcollab.com";
const CALLBACK_URL = "https://otbcvpgtxxidgtbxgzpo.supabase.co/functions/v1/social-oauth-callback";

async function verifyState(state: string, secret: string): Promise<{ userId: string; platform: string } | null> {
  const lastDot = state.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = state.slice(0, lastDot);
  const sigHex = state.slice(lastDot + 1);

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expectedHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (expectedHex !== sigHex) return null;

  const [userId, platform] = payload.split(":");
  if (!userId || !platform) return null;
  return { userId, platform };
}

function redirectTo(path: string) {
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}${path}` } });
}

async function handleInstagram(code: string, supabase: ReturnType<typeof createClient>, userId: string) {
  const clientId = Deno.env.get("INSTAGRAM_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("INSTAGRAM_CLIENT_SECRET") ?? "";

  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: CALLBACK_URL,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Instagram token exchange failed: " + JSON.stringify(tokenData));

  // Trade the short-lived token for a long-lived one (~60 days) so we're
  // not re-authenticating the user constantly.
  const longLivedRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${tokenData.access_token}`
  );
  const longLivedData = await longLivedRes.json();
  const accessToken = longLivedData.access_token || tokenData.access_token;
  const expiresInSec = longLivedData.expires_in || 3600;

  const profileRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`);
  const profile = await profileRes.json();

  await supabase.from("social_connections").upsert({
    user_id: userId,
    platform: "instagram",
    platform_user_id: profile.id || tokenData.user_id,
    username: profile.username || null,
    access_token: accessToken,
    refresh_token: null,
    expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  }, { onConflict: "user_id,platform" });

  // Fetch a larger pool than what actually gets shown - the creator picks
  // up to 5 of these to feature on their public profile, rather than the
  // most recent 5 being auto-selected for them.
  const mediaRes = await fetch(
    `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=20&access_token=${accessToken}`
  );
  const media = await mediaRes.json();
  const posts = (media.data || []).map((m: any, i: number) => ({
    user_id: userId,
    platform: "instagram",
    post_id: m.id,
    post_url: m.permalink,
    thumbnail_url: m.media_type === "VIDEO" ? (m.thumbnail_url || m.media_url) : m.media_url,
    caption: m.caption || null,
    posted_at: m.timestamp || null,
    cached_at: new Date().toISOString(),
    // Default to featuring the most recent 5 so something shows up right
    // away; the creator can change the selection anytime from settings.
    featured: i < 5,
  }));
  if (posts.length) {
    await supabase.from("social_posts_cache").upsert(posts, { onConflict: "user_id,platform,post_id" });
  }
}

async function handleTiktok(code: string, supabase: ReturnType<typeof createClient>, userId: string) {
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: CALLBACK_URL,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("TikTok token exchange failed: " + JSON.stringify(tokenData));

  const profileRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profileData = await profileRes.json();
  const displayName = profileData?.data?.user?.display_name || null;

  await supabase.from("social_connections").upsert({
    user_id: userId,
    platform: "tiktok",
    platform_user_id: tokenData.open_id,
    username: displayName,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  }, { onConflict: "user_id,platform" });

  // Fetch a larger pool than what actually gets shown - the creator picks
  // up to 5 of these to feature on their public profile.
  const videosRes = await fetch("https://open.tiktokapis.com/v2/video/list/?fields=id,cover_image_url,share_url,video_description,create_time", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ max_count: 20 }),
  });
  const videosData = await videosRes.json();
  const posts = (videosData?.data?.videos || []).map((v: any, i: number) => ({
    user_id: userId,
    platform: "tiktok",
    post_id: v.id,
    post_url: v.share_url,
    thumbnail_url: v.cover_image_url,
    caption: v.video_description || null,
    posted_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
    cached_at: new Date().toISOString(),
    // Default to featuring the most recent 5 so something shows up right
    // away; the creator can change the selection anytime from settings.
    featured: i < 5,
  }));
  if (posts.length) {
    await supabase.from("social_posts_cache").upsert(posts, { onConflict: "user_id,platform,post_id" });
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectTo(`/?social_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirectTo("/?social_error=missing_code");
  }

  try {
    const stateSecret = Deno.env.get("SOCIAL_OAUTH_STATE_SECRET") ?? "";
    const verified = await verifyState(state, stateSecret);
    if (!verified) return redirectTo("/?social_error=invalid_state");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (verified.platform === "instagram") {
      await handleInstagram(code, supabase, verified.userId);
    } else if (verified.platform === "tiktok") {
      await handleTiktok(code, supabase, verified.userId);
    } else {
      return redirectTo("/?social_error=unknown_platform");
    }

    return redirectTo(`/?social_connected=${verified.platform}`);
  } catch (err) {
    console.error("social-oauth-callback error:", err);
    return redirectTo(`/?social_error=${encodeURIComponent(String(err))}`);
  }
});
