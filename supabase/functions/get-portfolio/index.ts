import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public, unauthenticated (verify_jwt off) - this is the data source for a
// creator's standalone /p/<slug> portfolio page, which a stranger opens from
// a bio link with no FlipCollab session at all. Reads go through the service
// role and shape the response by hand instead of trusting client-side RLS on
// an anon SELECT, matching how every other public-facing read in this
// project stays server-authoritative.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") || "").trim();
    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const withinLimit = await checkRateLimit(supabase, "get-portfolio", clientIdentifier(req), {
      windowSeconds: 60,
      maxRequests: 30,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { data: creator } = await supabase
      .from("creator_profiles")
      .select("id, name, bio, avatar_url, niche, location, content_types, languages, audience_age_range, audience_location, rates, collabs, profile_visible, portfolio_sections")
      .ilike("portfolio_slug", slug)
      .maybeSingle();

    if (!creator || creator.profile_visible === false) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: posts }, { data: trackRows }, { data: reviews }] = await Promise.all([
      supabase.from("social_posts_cache").select("platform, post_id, post_url, thumbnail_url, caption, username, follower_count").eq("user_id", creator.id).eq("featured", true),
      supabase.rpc("get_creator_track_record", { target_creator_id: creator.id }),
      supabase.from("creator_reviews").select("id, rating, comment, created_at, brand_profiles(name, logo_url), campaigns(name)").eq("creator_id", creator.id).order("created_at", { ascending: false }).limit(10),
    ]);

    const trackRow = trackRows?.[0];
    const trackRecord = {
      completedCampaigns: Number(trackRow?.completed_campaigns ?? 0),
      avgTurnaroundHours: trackRow?.avg_turnaround_hours != null ? Number(trackRow.avg_turnaround_hours) : null,
      avgRating: trackRow?.avg_rating != null ? Number(trackRow.avg_rating) : null,
      reviewCount: Number(trackRow?.review_count ?? 0),
    };

    const seenPlatform = new Set<string>();
    const social = (posts || []).filter(p => {
      if (!p.username || seenPlatform.has(p.platform)) return false;
      seenPlatform.add(p.platform);
      return true;
    }).map(p => ({ platform: p.platform, username: p.username, follower_count: p.follower_count }));

    return new Response(JSON.stringify({
      name: creator.name,
      bio: creator.bio,
      avatar_url: creator.avatar_url,
      niche: creator.niche,
      location: creator.location,
      content_types: creator.content_types,
      languages: creator.languages,
      audience_age_range: creator.audience_age_range,
      audience_location: creator.audience_location,
      rates: creator.rates,
      collabs: creator.collabs,
      sections: creator.portfolio_sections,
      social,
      posts: (posts || []).map(p => ({ platform: p.platform, post_id: p.post_id, post_url: p.post_url, thumbnail_url: p.thumbnail_url, caption: p.caption })),
      trackRecord,
      reviews: (reviews as any[] || []).map(r => ({
        id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
        brand_name: r.brand_profiles?.name ?? null, brand_avatar: r.brand_profiles?.logo_url ?? null,
        campaign_name: r.campaigns?.name ?? null,
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
