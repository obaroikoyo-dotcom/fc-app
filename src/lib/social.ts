import { supabase } from "./supabase";

export type SocialPlatform = "instagram" | "tiktok";

export interface SocialConnection {
  platform: SocialPlatform;
  username: string | null;
  connected_at: string;
}

export interface SocialPost {
  platform: SocialPlatform;
  post_id: string;
  post_url: string;
  thumbnail_url: string;
  caption: string | null;
  posted_at: string | null;
}

export interface SocialPostOption extends SocialPost {
  featured: boolean;
}

export const MAX_FEATURED_POSTS = 5;

export async function startSocialConnect(platform: SocialPlatform) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("https://otbcvpgtxxidgtbxgzpo.supabase.co/functions/v1/social-oauth-start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ platform }),
  });
  const data = await res.json();
  if (!data.url) throw new Error(data.error || "Failed to start connection");
  window.location.href = data.url;
}

export async function getSocialConnections(userId: string): Promise<SocialConnection[]> {
  const { data } = await supabase
    .from("social_connections")
    .select("platform, username, connected_at")
    .eq("user_id", userId);
  return data || [];
}

export async function disconnectSocialPlatform(userId: string, platform: SocialPlatform) {
  await supabase.from("social_connections").delete().eq("user_id", userId).eq("platform", platform);
  await supabase.from("social_posts_cache").delete().eq("user_id", userId).eq("platform", platform);
}

export async function getSocialPosts(userId: string): Promise<SocialPost[]> {
  const { data } = await supabase
    .from("social_posts_cache")
    .select("platform, post_id, post_url, thumbnail_url, caption, posted_at")
    .eq("user_id", userId)
    .eq("featured", true)
    .order("posted_at", { ascending: false })
    .limit(MAX_FEATURED_POSTS);
  return data || [];
}

// The full pool of fetched posts for a platform, so the owner can pick which
// ones to feature - not just whatever was auto-selected on connect.
export async function getSocialPostOptions(userId: string, platform: SocialPlatform): Promise<SocialPostOption[]> {
  const { data } = await supabase
    .from("social_posts_cache")
    .select("platform, post_id, post_url, thumbnail_url, caption, posted_at, featured")
    .eq("user_id", userId)
    .eq("platform", platform)
    .order("posted_at", { ascending: false });
  return data || [];
}

export async function setFeaturedPosts(userId: string, platform: SocialPlatform, postIds: string[]) {
  const capped = postIds.slice(0, MAX_FEATURED_POSTS);
  await supabase.from("social_posts_cache").update({ featured: false }).eq("user_id", userId).eq("platform", platform);
  if (capped.length) {
    await supabase.from("social_posts_cache").update({ featured: true }).eq("user_id", userId).eq("platform", platform).in("post_id", capped);
  }
}
