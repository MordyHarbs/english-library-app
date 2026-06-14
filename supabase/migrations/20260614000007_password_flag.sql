-- Track whether a member has set a password, so login can choose password vs code.
alter table members add column if not exists has_password boolean not null default false;

-- Member marks their own row after setting a password (members are otherwise
-- read-only to themselves, so this needs a security-definer RPC).
create or replace function mark_password_set()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update members set has_password = true where auth_user_id = auth.uid();
end;
$$;

grant execute on function mark_password_set() to authenticated;
