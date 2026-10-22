-- =============================================================================
-- Membership dues: optional recurring payment tracking.
-- * settings: membership_tracking (on/off), membership_period_months, membership_fee
-- * membership_payments: one row per payment, with the date range it covers.
-- The legacy members.paid flag is untouched and still used when tracking is off.
-- =============================================================================

insert into settings (key, value, description) values
  ('membership_tracking',      'false'::jsonb, 'Require members to pay dues every period'),
  ('membership_period_months', '12'::jsonb,    'Months a membership payment is valid for'),
  ('membership_fee',           '0'::jsonb,     'Default membership fee (NIS) suggested when recording a payment')
on conflict (key) do nothing;

create table membership_payments (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references members (id) on delete cascade,
  paid_on       date not null default current_date,
  period_start  date not null,
  period_end    date not null,
  amount        numeric(8, 2),
  method        text,
  note          text,
  created_at    timestamptz not null default now(),
  constraint membership_payments_range check (period_end >= period_start)
);

create index membership_payments_member_idx
  on membership_payments (member_id, period_end desc);

alter table membership_payments enable row level security;

create policy membership_payments_self_read on membership_payments
  for select to authenticated
  using (member_id = current_member_id() or is_admin());
create policy membership_payments_admin_write on membership_payments
  for all to authenticated using (is_admin()) with check (is_admin());

grant select, insert, update, delete on membership_payments to authenticated;
grant all on membership_payments to service_role;
