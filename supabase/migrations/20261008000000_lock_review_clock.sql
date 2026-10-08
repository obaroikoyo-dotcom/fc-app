-- The review clock (applications.deliverable_uploaded_at) drives two things: the
-- 15-minute job that releases the payment to the creator once the brand's 5 days
-- are up, and the brand's own window to report a problem. Creators may update
-- their delivery fields, and that included the clock itself. A creator could
-- upload any video, then set the upload time to six days ago: the payment would
-- be released within 15 minutes and the brand's window to dispute it would be
-- closed before they had seen anything.
--
-- From now on the browser never sets that time. Saving a new deliverable link
-- starts a fresh clock at that moment, on the server, and nothing else can move
-- it. While a dispute is open the deliverable link can't be replaced either, so
-- the evidence stays as it was.
--
-- Edge functions and the SQL editor are unaffected. request_deliverable_revision
-- clears both fields on purpose and opts out with the same flag the other
-- application guards already honour.

create or replace function public.guard_application_review_clock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;
  if coalesce(current_setting('app.bypass_application_lock', true), '') = 'true' then
    return new;
  end if;

  if new.deliverable_url is distinct from old.deliverable_url then
    if old.status = 'disputed' then
      raise exception 'The deliverable can''t be changed while a dispute is open';
    end if;
    new.deliverable_uploaded_at := case when new.deliverable_url is null then null else now() end;
  else
    new.deliverable_uploaded_at := old.deliverable_uploaded_at;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_review_clock_guard on public.applications;
create trigger applications_review_clock_guard
  before update on public.applications
  for each row execute function public.guard_application_review_clock();

revoke execute on function public.guard_application_review_clock() from public, anon, authenticated;
