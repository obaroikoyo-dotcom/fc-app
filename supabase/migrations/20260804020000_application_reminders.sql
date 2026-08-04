-- Lets a creator's own client nudge a brand that's sat on a pending
-- application for 24h+. There's no server-side cron in this project, so
-- the check runs opportunistically from the creator's browser (see
-- src/lib/applicationReminders.ts) whenever they view their applications -
-- reminder_sent_at stops it firing more than once per application.
alter table public.applications add column reminder_sent_at timestamptz;

alter policy "Allow insert of known notification types"
  on public.notifications
  with check (
    type in ('new_message', 'campaign_application', 'campaign_chatting', 'payment_received', 'application_reminder')
  );
