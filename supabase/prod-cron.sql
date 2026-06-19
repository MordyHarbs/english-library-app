-- =============================================================================
-- PRODUCTION ONLY — run once in the Supabase SQL editor after deploy (Phase 11).
-- NOT a local migration: pg_cron/pg_net aren't needed (or always available)
-- locally, and this needs the real Functions URL + service-role key.
--
-- Schedules daily-reminders and backup-to-drive checks every 5 minutes. The
-- functions read settings.daily_tasks_time (default 08:00 Asia/Jerusalem) and
-- run at most once per Jerusalem calendar day.
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> before running.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into settings (key, value, description) values
  ('daily_tasks_time', '"08:00"'::jsonb, 'Jerusalem time when daily backups and reminder checks should run')
on conflict (key) do nothing;

select cron.unschedule('daily-reminders')
where exists (select 1 from cron.job where jobname = 'daily-reminders');

select cron.unschedule('backup-to-drive')
where exists (select 1 from cron.job where jobname = 'backup-to-drive');

select cron.schedule(
  'daily-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
                 'Content-Type',  'application/json'
               ),
    body    := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);

select cron.schedule(
  'backup-to-drive',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/backup-to-drive',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
                 'Content-Type',  'application/json'
               ),
    body    := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);

-- To remove later:  select cron.unschedule('daily-reminders');
--                   select cron.unschedule('backup-to-drive');
-- To inspect jobs:  select jobid, jobname, schedule, active from cron.job order by jobname;
-- To inspect runs:  select * from cron.job_run_details order by start_time desc limit 10;
