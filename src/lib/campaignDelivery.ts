import { supabase } from "./supabase";
import { uploadToR2 } from "./r2Upload";
import { notifyAndPush } from "./push";
import { REVIEW_WINDOW_DAYS } from "./review";

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

// Tells the brand (in-app notification + push) that the creator just sent
// their deliverable. Best-effort: the upload itself already succeeded, so a
// failed notification must never surface as an upload error.
export async function notifyBrandOfDeliverable(applicationId: string): Promise<void> {
  try {
    const { data: app } = await supabase
      .from("applications")
      .select("id, campaign_id, status, campaigns(brand_id, name)")
      .eq("id", applicationId)
      .single();
    const campaign = Array.isArray(app?.campaigns) ? app?.campaigns[0] : app?.campaigns;
    if (!app || !campaign?.brand_id) return;
    // Before payment there's nothing to confirm or dispute yet, so say what's
    // actually true instead of asking them to review a payout.
    const funded = app.status === "funded";
    await notifyAndPush({
      user_id: campaign.brand_id,
      type: "deliverable_uploaded",
      title: "Deliverable Received",
      body: funded
        ? `Your creator sent their video for "${campaign.name}". Are you happy with it? You have ${REVIEW_WINDOW_DAYS} days to answer. If you don't, the payment is released to the creator automatically.`
        : `Your creator has already sent their video for "${campaign.name}". Once you've paid, you'll have ${REVIEW_WINDOW_DAYS} days to check it.`,
      data: { campaign_id: app.campaign_id, application_id: app.id },
    });
  } catch (err) {
    console.error("Failed to notify brand of deliverable:", err);
  }
}

// Sends a funded deal back for a new deliverable (max 2 times, enforced in
// the database). The server clears the current video, restarts the review
// clock for whatever gets uploaded next, and notifies the creator.
export async function requestDeliverableRevision(applicationId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("request_deliverable_revision", { p_application_id: applicationId, p_note: note });
  if (error) throw new Error(error.message);
  try {
    const { data: app } = await supabase
      .from("applications")
      .select("creator_id, campaign_id, campaigns(name)")
      .eq("id", applicationId)
      .single();
    const campaign = Array.isArray(app?.campaigns) ? app?.campaigns[0] : app?.campaigns;
    if (app) {
      await supabase.functions.invoke("send-push", {
        body: {
          user_id: app.creator_id,
          type: "revision_requested",
          title: "New Video Requested",
          body: `The brand asked for another video for "${campaign?.name ?? "your campaign"}": ${note}`,
          data: { campaign_id: app.campaign_id, application_id: applicationId },
        },
      });
    }
  } catch (err) {
    console.error("Failed to push revision request:", err);
  }
}

export type DeliveryPlatform = "tiktok" | "instagram" | "youtube";

// Each of these gates a fully-built integration (edge functions, DB
// columns) behind a flag until its own external prerequisite clears - flip
// one on and the whole flow (including the "Coming Soon" UI below) picks it
// up with no other changes:
// - Instagram: Meta's instagram_business_content_publish permission needs
//   App Review approval.
// - YouTube: works for accounts explicitly added as Google testers today;
//   needs a Google-side security assessment (CASA) to open to everyone.
const INSTAGRAM_GATING_ENABLED = false;
const YOUTUBE_GATING_ENABLED = false;

// A campaign's declared platform (e.g. "TikTok Video", "IG Reel", "IG Story",
// "IG Carousel", "YouTube Short") maps to which social platform it targets,
// regardless of whether gated posting is actually enabled for it yet - lets
// the UI tell "Instagram, coming soon" apart from "no integration at all"
// (UGC packages, etc.).
export function socialPlatformFor(platform: string | undefined | null): DeliveryPlatform | null {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.startsWith("tiktok")) return "tiktok";
  if (p.startsWith("ig ") || p.startsWith("instagram")) return "instagram";
  if (p.startsWith("youtube")) return "youtube";
  return null;
}

// The gating flow actually usable right now - same as socialPlatformFor,
// except platforms withheld by their own *_GATING_ENABLED flag return null.
export function deliveryPlatformFor(platform: string | undefined | null): DeliveryPlatform | null {
  const social = socialPlatformFor(platform);
  if (social === "instagram" && !INSTAGRAM_GATING_ENABLED) return null;
  if (social === "youtube" && !YOUTUBE_GATING_ENABLED) return null;
  return social;
}

const POST_CONTENT_FN: Record<DeliveryPlatform, string> = {
  tiktok: "tiktok-post-video",
  instagram: "instagram-post-content",
  youtube: "youtube-post-content",
};
const POST_STATUS_FN: Record<DeliveryPlatform, string> = {
  tiktok: "tiktok-post-status",
  instagram: "instagram-post-status",
  youtube: "youtube-post-status",
};

export async function postDeliverable(platform: DeliveryPlatform, applicationId: string): Promise<{ campaign_post_id: string }> {
  return authedFetch(POST_CONTENT_FN[platform], { application_id: applicationId });
}

export async function pollPostStatus(platform: DeliveryPlatform, campaignPostId: string): Promise<{ status: "processing" | "published" | "failed"; post_url?: string | null; detail?: string; payout_released?: boolean; payout_error?: string }> {
  return authedFetch(POST_STATUS_FN[platform], { campaign_post_id: campaignPostId });
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
