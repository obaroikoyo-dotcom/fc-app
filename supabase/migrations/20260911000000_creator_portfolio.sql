-- Public, standalone (no login required) portfolio page a creator can share
-- as a link in their social bios. portfolio_slug is the vanity part of the
-- URL (flipcollab.com/p/<slug>); portfolio_sections controls which blocks of
-- their existing profile data show up on it, so building the page is just
-- picking from data they've already filled in - no separate content entry.
alter table creator_profiles add column if not exists portfolio_slug text;
alter table creator_profiles add column if not exists portfolio_sections jsonb not null default '{"bio":true,"platforms":true,"rates":true,"collabs":true,"trackrecord":true,"reviews":true}'::jsonb;

create unique index if not exists creator_profiles_portfolio_slug_key on creator_profiles (lower(portfolio_slug)) where portfolio_slug is not null;
