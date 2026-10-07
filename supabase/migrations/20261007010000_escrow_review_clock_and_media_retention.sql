-- Two escrow bugs found while documenting the payment flow. Both predate the
-- "creator can upload before the brand pays" feature and the dispute window.
--
-- 1. MEDIA RETENTION DELETED DELIVERABLES THAT WERE STILL IN ESCROW.
--    Accepting an application starts a 7-day "stale chat" timer
--    (media_delete_at). Paying never cleared it, and the cleanup job doesn't
--    look at status, so a funded deal could lose its deliverable 7 days after
--    acceptance - before the brand had reviewed it, and as the evidence for a
--    dispute. While money is held (funded) or a dispute is open, nothing is
--    deleted. Refunded deals get a 7-day grace period like other closed deals.
--
-- 2. THE 7-DAY REVIEW CLOCK STARTED BEFORE THE BRAND COULD SEE THE VIDEO.
--    deliverable_uploaded_at drives both the auto-release and the dispute
--    window. A creator can upload as soon as the chat opens, so a brand who
--    paid on day 8 after a day-1 upload had a deliverable that already looked
--    "7 days old": the 15-minute auto-release job would pay the creator almost
--    immediately and the dispute window was already closed. The clock now
--    restarts at the moment the deal becomes funded, which is the moment the
--    brand first gets to review the video.

-- ---------- 1. retention ------------------------------------------------------
create or replace function public.set_application_media_delete_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      new.media_delete_at := now() + interval '7 days';
    elsif new.status in ('funded', 'disputed') then
      new.media_delete_at := null;
    elsif new.status = 'rejected' then
      new.media_delete_at := now();
    elsif new.status = 'paid' then
      new.media_delete_at := now() + interval '24 hours';
    elsif new.status = 'refunded' then
      new.media_delete_at := now() + interval '7 days';
    end if;
  end if;
  return new;
end;
$$;

-- Deals already in escrow keep their files until they settle.
update public.applications
   set media_delete_at = null
 where status in ('funded', 'disputed')
   and media_deleted = false
   and media_delete_at is not null;

-- ---------- 2. review clock ---------------------------------------------------
create or replace function public.start_review_clock_on_funding()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'funded'
     and old.status is distinct from 'funded'
     and new.deliverable_url is not null then
    new.deliverable_uploaded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists applications_start_review_clock on public.applications;
create trigger applications_start_review_clock
  before update on public.applications
  for each row execute function public.start_review_clock_on_funding();
