-- Existing auth users may already have passwords from before has_password was
-- tracked on members. Backfill the member flag from Supabase Auth once.
update public.members as m
   set has_password = true
  from auth.users as u
 where m.auth_user_id = u.id
   and coalesce(u.encrypted_password, '') <> '';