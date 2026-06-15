-- Return the login mode for a member email. This checks both the member flag
-- and Supabase Auth, so existing password users are not treated as OTP-only.
create or replace function member_login_status(p_email citext)
returns table(member_id uuid, has_password boolean)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select
    m.id as member_id,
    bool_or(
      m.has_password
      or coalesce(u.encrypted_password, '') <> ''
    ) as has_password
  from public.members m
  left join auth.users u
    on u.id = m.auth_user_id
    or lower(u.email::text) = lower(m.email::text)
  where m.email = p_email
  group by m.id
  limit 1;
$$;