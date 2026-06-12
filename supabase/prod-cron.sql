-- =============================================================================
-- PRODUCTION ONLY — run once in the Supabase SQL editor after deploy (Phase 11).
-- NOT a local migration: pg_cron/pg_net aren't needed (or always available)
-- locally, and this needs the real Functions URL + service-role key.
--
-- Schedules daily-reminders at 05:00 UTC (~07:00–08:00 Israel time).
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> before running.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-reminders',
  '0 5 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
                 'Content-Type',  'application/json'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- To remove later:  select cron.unschedule('daily-reminders');
-- To inspect runs:  select * from cron.job_run_details order by start_time desc limit 10;
