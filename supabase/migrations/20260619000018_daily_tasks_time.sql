insert into settings (key, value, description) values
  ('daily_tasks_time', '"08:00"'::jsonb, 'Jerusalem time when daily backups and reminder checks should run')
on conflict (key) do nothing;