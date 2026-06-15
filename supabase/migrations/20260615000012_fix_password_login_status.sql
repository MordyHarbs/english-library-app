-- The login decision must use the app's explicit has_password flag only.
-- Auth users also exist for OTP login, so auth.users cannot be used to infer
-- that a member saved a password.
update public.members
   set has_password = false
 where has_password = true;

create or replace function member_login_status(p_email citext)
returns table(member_id uuid, has_password boolean)
language sql
security definer
set search_path = public, pg_temp
as $$
  select m.id as member_id, m.has_password
    from public.members m
   where m.email = p_email
   limit 1;
$$;