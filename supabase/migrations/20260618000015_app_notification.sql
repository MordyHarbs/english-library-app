create table if not exists app_notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  body        text not null default '',
  is_active   boolean not null default false,
  sort_order  integer not null default 999,
  dismissal_version integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table app_notices
  add column if not exists dismissal_version integer not null default 1;

grant select, insert, update, delete on app_notices to authenticated;
alter table app_notices enable row level security;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'app_notices'
       and policyname = 'app_notices_admin_all'
  ) then
    create policy app_notices_admin_all on app_notices
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

create or replace view active_app_notices
with (security_invoker = off) as
  select id, title, body, sort_order, dismissal_version
    from app_notices
   where is_active = true
     and (btrim(title) <> '' or btrim(body) <> '')
   order by sort_order asc, created_at asc;

grant select on active_app_notices to anon, authenticated;