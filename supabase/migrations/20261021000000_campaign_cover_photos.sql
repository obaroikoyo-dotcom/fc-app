-- A cover photo for a campaign: shown across the top of its card on Explore and on
-- the brand's Market tab. Without one the card shows its colour band, so every
-- existing campaign keeps working untouched.
alter table public.campaigns add column if not exists cover_url text;

-- Everyone who opens Explore loads this address in their own app, so a brand must
-- not be able to point it at any website (that would let them see who is looking,
-- or show something nobody uploaded). Like deliverables and chat photos, it has to
-- be a file this app itself stored, for this campaign, in the covers folder:
--   https://<storage host>/campaign-assets/<brand id>/<campaign id>/covers/<number>-<letters>.<ext>
-- The storage host is the one r2-presigned-url records in app_secrets
-- (r2_public_host). Until that has been recorded the host part is skipped and only
-- the path shape is checked. Removing a cover (null) is always allowed. Edge
-- functions and the SQL editor are not restricted.
create or replace function public.guard_campaign_cover_url()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_host text;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and new.cover_url is not null
     and (tg_op = 'INSERT' or new.cover_url is distinct from old.cover_url) then
    select value into v_host from public.app_secrets where key = 'r2_public_host';
    if new.cover_url !~ ('^https://[^?#]+/campaign-assets/' || new.brand_id::text || '/' || new.id::text || '/covers/[0-9]+-[a-z0-9]*\.[A-Za-z0-9]+$')
       or (v_host is not null and not starts_with(lower(new.cover_url), 'https://' || lower(v_host) || '/')) then
      raise exception 'Cover photos must be uploaded through the app';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campaigns_cover_url_guard on public.campaigns;
create trigger campaigns_cover_url_guard
  before insert or update on public.campaigns
  for each row execute function public.guard_campaign_cover_url();

revoke execute on function public.guard_campaign_cover_url() from public, anon, authenticated;

-- The app reads and writes the new column the same way it does the others.
grant select (cover_url), update (cover_url) on public.campaigns to authenticated;
