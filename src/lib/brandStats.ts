import { supabase } from "./supabase";

export interface BrandTrackRecord {
  completedCampaigns: number;
  avgResponseHours: number | null;
  avgRating: number | null;
  reviewCount: number;
}

export interface BrandReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  creator_id: string;
  creator_name: string | null;
  creator_avatar: string | null;
  campaign_name: string | null;
}

export interface ReviewableCampaign {
  campaign_id: string;
  campaign_name: string;
}

export async function getBrandTrackRecord(brandId: string): Promise<BrandTrackRecord> {
  const { data } = await supabase.rpc("get_brand_track_record", { target_brand_id: brandId });
  const row = data?.[0];
  return {
    completedCampaigns: Number(row?.completed_campaigns ?? 0),
    avgResponseHours: row?.avg_response_hours != null ? Number(row.avg_response_hours) : null,
    avgRating: row?.avg_rating != null ? Number(row.avg_rating) : null,
    reviewCount: Number(row?.review_count ?? 0),
  };
}

export async function getBrandReviews(brandId: string, limit = 10): Promise<BrandReview[]> {
  const { data } = await supabase
    .from("brand_reviews")
    .select("id, rating, comment, created_at, creator_id, creator_profiles(name, avatar_url), campaigns(name)")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return (data as any[]).map(r => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    creator_id: r.creator_id,
    creator_name: r.creator_profiles?.name ?? null,
    creator_avatar: r.creator_profiles?.avatar_url ?? null,
    campaign_name: r.campaigns?.name ?? null,
  }));
}

// Paid campaigns this creator completed with this brand that they haven't
// already left a review for - the set they're allowed to leave a review on.
export async function getReviewableCampaigns(creatorId: string, brandId: string): Promise<ReviewableCampaign[]> {
  const { data: apps } = await supabase
    .from("applications")
    .select("campaign_id, campaigns!inner(id, name, brand_id)")
    .eq("creator_id", creatorId)
    .eq("status", "paid")
    .eq("campaigns.brand_id", brandId);
  if (!apps || apps.length === 0) return [];

  const { data: existingReviews } = await supabase
    .from("brand_reviews")
    .select("campaign_id")
    .eq("creator_id", creatorId)
    .eq("brand_id", brandId);
  const reviewed = new Set((existingReviews || []).map(r => r.campaign_id));

  const seen = new Set<string>();
  const result: ReviewableCampaign[] = [];
  for (const a of apps as any[]) {
    const campaignId = a.campaign_id;
    if (reviewed.has(campaignId) || seen.has(campaignId)) continue;
    seen.add(campaignId);
    result.push({ campaign_id: campaignId, campaign_name: a.campaigns?.name || "Campaign" });
  }
  return result;
}

export async function submitBrandReview(params: { brandId: string; creatorId: string; campaignId: string; rating: number; comment: string }) {
  const { error } = await supabase.from("brand_reviews").insert({
    brand_id: params.brandId,
    creator_id: params.creatorId,
    campaign_id: params.campaignId,
    rating: params.rating,
    comment: params.comment.trim() || null,
  });
  return { error };
}

export function formatResponseTime(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
