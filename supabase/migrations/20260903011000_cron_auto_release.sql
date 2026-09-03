-- Same cadence and secret-sharing mechanism as the media cleanup cron job.
select cron.schedule(
  'auto-release-payments',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://otbcvpgtxxidgtbxgzpo.supabase.co/functions/v1/auto-release-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', (select value from public.app_secrets where key = 'cleanup_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
