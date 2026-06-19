insert into settings (key, value, description) values
  ('default_extend_days', '7'::jsonb, 'Default number of days added when extending a loan')
on conflict (key) do nothing;