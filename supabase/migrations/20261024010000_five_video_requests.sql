-- A brand can now send a funded deal back for another video up to 5 times (it was 2).
-- Same function as 20261006020000_admin_disputes_and_revision_refund.sql with the limit and
-- the wording of its message changed; nothing else moves. The number is also in the app
-- (MAX_VIDEO_REQUESTS in src/lib/review.ts), the demo and the Terms and Help text, so keep
-- them in step. Safe to run on top of the old version.

create or replace function public.request_deliverable_revision(p_application_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if length(v_note) < 3 or length(v_note) > 500 then
    raise exception 'Tell the creator what to change (3-500 characters).';
  end if;

  select a.id, a.creator_id, a.campaign_id, a.status, a.deliverable_url, a.revision_count, c.brand_id, c.name as campaign_name
    into v_app
  from public.applications a join public.campaigns c on c.id = a.campaign_id
  where a.id = p_application_id
  for update of a;

  if not found or v_app.brand_id <> auth.uid() then raise exception 'not authorized'; end if;
  if v_app.status <> 'funded' then raise exception 'Another video can only be requested while the deal is funded.'; end if;
  if v_app.deliverable_url is null then raise exception 'There is no deliverable to send back yet.'; end if;
  if v_app.revision_count >= 5 then
    raise exception 'You''ve used all 5 video requests for this deal. Release the payment or raise a dispute.';
  end if;

  perform set_config('app.bypass_application_lock', 'true', true);
  update public.applications
     set previous_deliverable_url = deliverable_url,
         deliverable_url = null,
         deliverable_uploaded_at = null,
         revision_count = revision_count + 1,
         revision_note = v_note,
         revision_requested_at = now(),
         revision_warned_3d_at = null,
         revision_warned_6d_at = null
   where id = p_application_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_app.creator_id, 'revision_requested', 'New Video Requested',
    'The brand asked for another video for "' || v_app.campaign_name || '": ' || v_note
      || ' Send it within 7 days, or this deal is refunded to the brand.',
    jsonb_build_object('campaign_id', v_app.campaign_id, 'application_id', v_app.id)
  );
end;
$$;

revoke execute on function public.request_deliverable_revision(uuid, text) from public, anon;
grant execute on function public.request_deliverable_revision(uuid, text) to authenticated;
