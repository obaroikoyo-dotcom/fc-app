-- Lets brands save a campaign as a draft instead of posting it live.
-- Idempotent per the established pattern in this project - schema drift
-- from dashboard-created columns means "add column" alone can't be
-- trusted to be safe.
alter table public.campaigns add column if not exists is_draft boolean not null default false;
