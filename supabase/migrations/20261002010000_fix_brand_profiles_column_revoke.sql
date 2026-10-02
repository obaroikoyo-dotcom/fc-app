-- The previous migration's column-level REVOKE on brand_profiles had no
-- effect - verified directly with has_column_privilege() after running it.
-- Supabase grants SELECT on the whole table to `authenticated` by default,
-- and a column-level REVOKE cannot override a table-level GRANT (there's
-- no column-level privilege to revoke in the first place - the access
-- comes from the table grant, which is a separate privilege entirely).
-- The actual fix is to revoke the table-level grant and re-grant SELECT on
-- only the safe columns.
revoke select on public.brand_profiles from authenticated, anon;
grant select (
  id, name, company_name, verified, profile_visible, bio, website, instagram,
  tiktok, industry, niche, location, target_audience, budget_range,
  content_types, logo_url, avatar_url, is_enterprise,
  subscription_cancel_at_period_end, onboarding_complete, campaign_budget
) on public.brand_profiles to authenticated, anon;
