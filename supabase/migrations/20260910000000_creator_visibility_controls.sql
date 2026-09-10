-- The Visibility settings screen's toggles (Public Profile, Rate Card) were
-- local UI state only - never persisted, never actually checked anywhere,
-- so switching them off did nothing. This adds real columns for those plus
-- new per-field toggles for the other things a creator's public profile
-- actually shows (location, follower counts, past collaborations).
alter table public.creator_profiles add column if not exists profile_visible boolean not null default true;
alter table public.creator_profiles add column if not exists rate_visible boolean not null default true;
alter table public.creator_profiles add column if not exists location_visible boolean not null default true;
alter table public.creator_profiles add column if not exists followers_visible boolean not null default true;
alter table public.creator_profiles add column if not exists collabs_visible boolean not null default true;

-- Same fix for the brand side's own (also unpersisted) Public Profile toggle.
alter table public.brand_profiles add column if not exists profile_visible boolean not null default true;
