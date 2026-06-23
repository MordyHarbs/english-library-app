-- =============================================================================
-- Per-library branding settings.
-- Defaults preserve the existing Ayalot deployment; other projects can override
-- these rows from Admin -> Settings or a project-specific SQL snippet.
-- =============================================================================

insert into settings (key, value, description) values
  ('library_name',       '"Ayalot Library"'::jsonb,         'Display name used in the app and emails'),
  ('library_logo_url',   '"/logo.png"'::jsonb,              'Logo image URL used in the app and emails'),
  ('library_icon_url',   '"/favicon.png"'::jsonb,           'Browser icon URL used for this library'),
  ('contact_phone',      '"053-520-9283"'::jsonb,           'Phone number shown in reminder emails'),
  ('backup_folder_name', '"Ayalot Library Backups"'::jsonb, 'Google Drive root folder for backups')
on conflict (key) do nothing;

create or replace view public_settings
with (security_invoker = off) as
  select key, value
    from settings
   where key in (
     'default_book_limit',
     'max_book_limit',
     'loan_duration_days',
     'library_name',
     'library_logo_url',
     'library_icon_url',
     'contact_phone'
   );

grant select on public_settings to anon, authenticated;
