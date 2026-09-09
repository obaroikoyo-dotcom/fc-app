import { supabase } from "./supabase";
import { uploadToR2 } from "./r2Upload";

export interface CampaignPost {
  id: string;
  application_id: string;
  posted_by_user_id: string;
  posted_by_role: "creator" | "brand";
  status: "processing" | "published" | "failed";
  post_url: string | null;
  created_at: string;
  published_at: string | null;
}

const FUNCTIONS_BASE = "https://otbcvpgtxxidgtbxgzpo.supabase.co/functions/v1";

async function authedFetch(path: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${path} failed`);
  return data;
}

export async function uploadDeliverable(applicationId: string, creatorId: string, file: File): Promise<string> {
  const publicUrl = await uploadToR2({ purpose: "deliverable", file, application_id: applicationId });
  await supabase.from("applications").update({
    deliverable_url: publicUrl,
    deliverable_uploaded_at: new Date().toISOString(),
  }).eq("id", applicationId).eq("creator_id", creatorId);
  return publicUrl;
}

export type DeliveryPlatform = "tiktok" | "instagram";

// The Instagram side of the gated-posting integration (edge functions, DB
// columns) is fully built, but Meta's instagram_business_content_publish
// permission needs App Review approval before it'll actually work for real
// creator accounts - flip this on once that's approved and the whole flow
// (including the "Coming Soon" UI below) picks it up with no other changes.
const INSTAGRAM_GATING_ENABLED = false;

// A campaign's declared platform (e.g. "TikTok Video", "IG Reel", "IG Story",
// "IG Carousel") maps to which social platform it targets, regardless of
// whether gated posting is actually enabled for it yet - lets the UI tell
// "Instagram, coming soon" apart from "no integration at all" (YouTube, UGC
// packages, etc.).
export function socialPlatformFor(platform: string | undefined | null): DeliveryPlatform | null {
  if (!platform) return null;
  if (platform.toLowerCase().startsWith("tiktok")) return "tiktok";
  if (platform.toLowerCase().startsWith("ig ") || platform.toLowerCase().startsWith("instagram")) return "instagram";
  return null;
}

// The gating flow actually usable right now - same as socialPlatformFor,
// except Instagram is withheld until INSTAGRAM_GATING_ENABLED flips on.
export function deliveryPlatformFor(platform: string | undefined | null): DeliveryPlatform | null {
  const social = socialPlatformFor(platform);
  if (social === "instagram" && !INSTAGRAM_GATING_ENABLED) return null;
  return social;
}

export async function postDeliverable(platform: DeliveryPlatform, applicationId: string): Promise<{ campaign_post_id: string }> {
  const fn = platform === "instagram" ? "instagram-post-content" : "tiktok-post-video";
  return authedFetch(fn, { application_id: applicationId });
}

export async function pollPostStatus(platform: DeliveryPlatform, campaignPostId: string): Promise<{ status: "processing" | "published" | "failed"; post_url?: string | null; detail?: string; payout_released?: boolean; payout_error?: string }> {
  const fn = platform === "instagram" ? "instagram-post-status" : "tiktok-post-status";
  return authedFetch(fn, { campaign_post_id: campaignPostId });
}

export async function getCampaignPosts(applicationId: string): Promise<CampaignPost[]> {
  const { data } = await supabase
    .from("campaign_posts")
    .select("id, application_id, posted_by_user_id, posted_by_role, status, post_url, created_at, published_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  return data || [];
}

// The brand's manual escape hatch for deals that never touch TikTok at
// all (in-person handoffs, etc.), and also used for the ungated "instant"
// pay flow - creates the actual Stripe Transfer to the creator's connected
// account, so this has to go through the edge function rather than writing
// applications/transactions status directly (the Stripe secret key can
// never reach the browser).
export async function releasePayout(applicationId: string): Promise<{ released: boolean; alreadyReleased?: boolean; transfer_id?: string }> {
  return authedFetch("release-payout", { application_id: applicationId });
}
