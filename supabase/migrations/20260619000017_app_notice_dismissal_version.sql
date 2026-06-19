alter table app_notices
  add column if not exists dismissal_version integer not null default 1;

create or replace view active_app_notices
with (security_invoker = off) as
  select id, title, body, sort_order, dismissal_version
    from app_notices
   where is_active = true
     and (btrim(title) <> '' or btrim(body) <> '')
   order by sort_order asc, created_at asc;

grant select on active_app_notices to anon, authenticated;
