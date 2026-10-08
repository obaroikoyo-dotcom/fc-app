-- guard_application_media_urls already checks the shape of a deliverable or pitch
-- link (https, the right folder, the right id in the file name) but not which
-- website it points at, so a link to an outside site with the right ending was
-- accepted. It now also requires the link to start with the storage website.
--
-- The database can't read the edge functions' environment, so r2-presigned-url
-- records the storage host in app_secrets (key r2_public_host) every time it
-- hands out an upload link, and this reads it from there. Until that function
-- has been redeployed and used once, no host is recorded and the check behaves
-- exactly as it did before, so nothing can break during the switch-over.

create or replace function public.guard_application_media_urls()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_host text;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    select value into v_host from public.app_secrets where key = 'r2_public_host';

    if new.deliverable_url is not null
       and (tg_op = 'INSERT' or new.deliverable_url is distinct from old.deliverable_url) then
      if new.deliverable_url !~ ('^https://[^?#]+/deliverables/' || new.id::text || '_[0-9]+\.[A-Za-z0-9]+$')
         or (v_host is not null and not starts_with(lower(new.deliverable_url), 'https://' || lower(v_host) || '/')) then
        raise exception 'Deliverables must be uploaded through the app';
      end if;
    end if;

    if new.video_url is not null
       and (tg_op = 'INSERT' or new.video_url is distinct from old.video_url) then
      if new.video_url !~ ('^https://[^?#]+/pitches/' || new.creator_id::text || '_' || new.campaign_id::text || '_[0-9]+\.[A-Za-z0-9]+$')
         or (v_host is not null and not starts_with(lower(new.video_url), 'https://' || lower(v_host) || '/')) then
        raise exception 'Pitch videos must be uploaded through the app';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_application_media_urls() from public, anon, authenticated;
