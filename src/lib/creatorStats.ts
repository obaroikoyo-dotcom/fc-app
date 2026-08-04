import { supabase } from "./supabase";

export interface CreatorTrackRecord {
  completedCampaigns: number;
  avgTurnaroundHours: number | null;
  avgRating: number | null;
  reviewCount: number;
}

export interface CreatorReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  brand_id: string;
  brand_name: string | null;
  brand_avatar: string | null;
  campaign_name: string | null;
}

export interface ReviewableCreatorCampaign {
  campaign_id: string;
  campaign_name: string;
}

export async function getCreatorTrackRecord(creatorId: string): Promise<CreatorTrackRecord> {
  const { data } = await supabase.rpc("get_creator_track_record", { target_creator_id: creatorId });
  const row = data?.[0];
  return {
    completedCampaigns: Number(row?.completed_campaigns ?? 0),
    avgTurnaroundHours: row?.avg_turnaround_hours != null ? Number(row.avg_turnaround_hours) : null,
    avgRating: row?.avg_rating != null ? Number(row.avg_rating) : null,
    reviewCount: Number(row?.review_count ?? 0),
  };
}

export async function getCreatorReviews(creatorId: string, limit = 10): Promise<CreatorReview[]> {
  const { data } = await supabase
    .from("creator_reviews")
    .select("id, rating, comment, created_at, brand_id, brand_profiles(name, logo_url), campaigns(name)")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return (data as any[]).map(r => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    brand_id: r.brand_id,
    brand_name: r.brand_profiles?.name ?? null,
    brand_avatar: r.brand_profiles?.logo_url ?? null,
    campaign_name: r.campaigns?.name ?? null,
  }));
}

// Paid campaigns this brand ran with this creator that they haven't already
// left a review for.
export async function getReviewableCreatorCampaigns(brandId: string, creatorId: string): Promise<ReviewableCreatorCampaign[]> {
  const { data: apps } = await supabase
    .from("applications")
    .select("campaign_id, campaigns!inner(id, name, brand_id)")
    .eq("creator_id", creatorId)
    .eq("status", "paid")
    .eq("campaigns.brand_id", brandId);
  if (!apps || apps.length === 0) return [];

  const { data: existingReviews } = await supabase
    .from("creator_reviews")
    .select("campaign_id")
    .eq("creator_id", creatorId)
    .eq("brand_id", brandId);
  const reviewed = new Set((existingReviews || []).map(r => r.campaign_id));

  const seen = new Set<string>();
  const result: ReviewableCreatorCampaign[] = [];
  for (const a of apps as any[]) {
    const campaignId = a.campaign_id;
    if (reviewed.has(campaignId) || seen.has(campaignId)) continue;
    seen.add(campaignId);
    result.push({ campaign_id: campaignId, campaign_name: a.campaigns?.name || "Campaign" });
  }
  return result;
}

export async function submitCreatorReview(params: { creatorId: string; brandId: string; campaignId: string; rating: number; comment: string }) {
  const { error } = await supabase.from("creator_reviews").insert({
    creator_id: params.creatorId,
    brand_id: params.brandId,
    campaign_id: params.campaignId,
    rating: params.rating,
    comment: params.comment.trim() || null,
  });
  return { error };
}

export function formatTurnaroundTime(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
