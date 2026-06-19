-- =============================================================================
-- English Library — default settings (TECH-PLAN D1)
-- Replaces the old "Cofing" sheet. Editable from the admin Settings page.
-- =============================================================================

insert into settings (key, value, description) values
  ('loan_duration_days',      '14'::jsonb,                          'Default loan length in days'),
  ('default_book_limit',      '5'::jsonb,                           'Soft warning threshold when reserving'),
  ('max_book_limit',          '10'::jsonb,                          'Hard block: max books per reservation'),
  ('late_fee_per_week',       '0'::jsonb,                           'Late fee per overdue week (0 = off)'),
  ('reminder_days_before',    '2'::jsonb,                           'Send "due soon" this many days before due date'),
  ('daily_tasks_time',        '"08:00"'::jsonb,                     'Jerusalem time when daily backups and reminder checks should run'),
  ('email_member_on_finalize','true'::jsonb,                        'Email member when a reservation is finalized'),
  ('email_member_on_lend',    'true'::jsonb,                        'Email member when books are lent out'),
  ('email_member_on_return',  'false'::jsonb,                       'Email member when books are returned'),
  ('email_due_soon',          'true'::jsonb,                        'Send due-soon reminder emails'),
  ('email_overdue',           'true'::jsonb,                        'Send overdue reminder emails'),
  ('email_welcome_on_create', 'true'::jsonb,                        'Send welcome email when a member is created'),
  ('admin_notification_email','"ayalotlibrary@gmail.com"'::jsonb,   'Where new-reservation alerts are sent'),
  ('site_url',                '"http://localhost:5173"'::jsonb,     'Base URL used in email deep links')
on conflict (key) do nothing;
