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
    .order("posted_at", { ascending: false })
    .limit(10);
  return data || [];
}
