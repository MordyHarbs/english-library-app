-- Run this in the KS Kids Library Supabase SQL editor after migrations are applied.
-- It keeps the shared codebase generic while making this project use its own branding.

insert into settings (key, value, description) values
  ('library_name',       '"KS Kids Library"'::jsonb,            'Display name used in the app and emails'),
  ('library_logo_url',   '"/book-logo.svg"'::jsonb,             'Logo image URL used in the app and emails'),
  ('library_icon_url',   '"/book-icon.svg"'::jsonb,             'Browser icon URL used for this library'),
  ('contact_phone',      '""'::jsonb,                           'Phone number shown in reminder emails'),
  ('backup_folder_name', '"KS Kids Library Backups"'::jsonb,    'Google Drive root folder for backups')
on conflict (key) do update
set value = excluded.value,
    description = excluded.description;
