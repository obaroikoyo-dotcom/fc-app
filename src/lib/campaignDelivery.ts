import { supabase } from "./supabase";

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

export async function uploadDeliverable(applicationId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `deliverables/${applicationId}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("campaign-pitches").upload(path, file, { cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("campaign-pitches").getPublicUrl(path);
  await supabase.from("applications").update({
    deliverable_url: data.publicUrl,
    deliverable_uploaded_at: new Date().toISOString(),
  }).eq("id", applicationId);
  return data.publicUrl;
}

export async function postDeliverableToTikTok(applicationId: string): Promise<{ campaign_post_id: string; publish_id: string }> {
  return authedFetch("tiktok-post-video", { application_id: applicationId });
}

export async function pollPostStatus(campaignPostId: string): Promise<{ status: "processing" | "published" | "failed"; post_url?: string | null; detail?: string; payout_released?: boolean; payout_error?: string }> {
  return authedFetch("tiktok-post-status", { campaign_post_id: campaignPostId });
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
