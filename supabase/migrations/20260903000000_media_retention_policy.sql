-- Media retention: images/videos (never message text, never applications
-- themselves) get auto-deleted once a deal closes or goes stale, per the
-- policy: 24h after payout, immediately once screened out (rejected), or
-- after 7 days of no response once a chat opens. Account/ban deletion is a
-- separate, total wipe handled in delete-user.

alter table public.applications add column if not exists media_delete_at timestamptz;
alter table public.applications add column if not exists media_deleted boolean not null default false;

-- A message's video/image can be cleared while the message row (and its
-- text) stays - the whole point is that a conversation can't be used as
-- proof of a deal without the message history itself surviving.
alter table public.messages add column if not exists image_url text;
alter table public.messages add column if not exists media_expired_at timestamptz;

-- Centralizes the retention timer in one place rather than every client
-- call site that changes an application's status (easy to miss one and
-- silently break the policy). Fires regardless of which code path made
-- the change.
create or replace function public.set_application_media_delete_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      new.media_delete_at := now() + interval '7 days';
    elsif new.status = 'rejected' then
      new.media_delete_at := now();
    elsif new.status = 'paid' then
      new.media_delete_at := now() + interval '24 hours';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_set_media_delete_at on public.applications;
create trigger applications_set_media_delete_at
  before update on public.applications
  for each row execute function public.set_application_media_delete_at();
