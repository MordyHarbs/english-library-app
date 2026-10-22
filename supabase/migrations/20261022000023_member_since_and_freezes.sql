-- =============================================================================
-- Editable "member since" date + membership freezes.
-- A freeze pauses the dues requirement between start_date and end_date
-- (end_date null = open-ended, until the admin ends it).
-- =============================================================================

alter table members add column if not exists member_since date;
update members set member_since = (date_added at time zone 'Asia/Jerusalem')::date
 where member_since is null;
alter table members alter column member_since set default current_date;

create table membership_freezes (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members (id) on delete cascade,
  start_date  date not null,
  end_date    date,
  reason      text,
  created_at  timestamptz not null default now(),
  constraint membership_freezes_range check (end_date is null or end_date >= start_date)
);

create index membership_freezes_member_idx
  on membership_freezes (member_id, start_date desc);

alter table membership_freezes enable row level security;

create policy membership_freezes_self_read on membership_freezes
  for select to authenticated
  using (member_id = current_member_id() or is_admin());
create policy membership_freezes_admin_write on membership_freezes
  for all to authenticated using (is_admin()) with check (is_admin());

grant select, insert, update, delete on membership_freezes to authenticated;
grant all on membership_freezes to service_role;
