-- =============================================================================
-- English Library — RLS, helper functions, member RPCs (TECH-PLAN D1/D2)
-- Edge Functions use the service role and bypass all of this.
-- =============================================================================

-- --- Helper functions (SECURITY DEFINER to avoid RLS recursion) --------------
create or replace function current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from members where auth_user_id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select is_admin from members where auth_user_id = auth.uid()),
    false
  );
$$;

grant execute on function current_member_id() to anon, authenticated;
grant execute on function is_admin() to anon, authenticated;

-- --- Table grants (coarse; RLS does the fine-grained gating) -----------------
grant select on books, categories to anon, authenticated;
grant select, insert, update, delete
  on members, books, categories, reservations, reservation_items, loans, settings, email_log
  to authenticated;

-- service_role is used by Edge Functions and bypasses RLS — give it full access.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- --- Enable RLS on everything -----------------------------------------------
alter table members            enable row level security;
alter table categories         enable row level security;
alter table books              enable row level security;
alter table reservations       enable row level security;
alter table reservation_items  enable row level security;
alter table loans              enable row level security;
alter table settings           enable row level security;
alter table email_log          enable row level security;

-- --- books / categories: public read, admin write ---------------------------
create policy books_public_read on books
  for select to anon, authenticated using (true);
create policy books_admin_write on books
  for all to authenticated using (is_admin()) with check (is_admin());

create policy categories_public_read on categories
  for select to anon, authenticated using (true);
create policy categories_admin_write on categories
  for all to authenticated using (is_admin()) with check (is_admin());

-- --- members: own row read, admin full --------------------------------------
create policy members_self_read on members
  for select to authenticated
  using (auth_user_id = auth.uid() or is_admin());
create policy members_admin_write on members
  for all to authenticated using (is_admin()) with check (is_admin());

-- --- reservations: own read, admin full -------------------------------------
create policy reservations_self_read on reservations
  for select to authenticated
  using (member_id = current_member_id() or is_admin());
create policy reservations_admin_write on reservations
  for all to authenticated using (is_admin()) with check (is_admin());

-- --- reservation_items: own (via parent) read, admin full -------------------
create policy reservation_items_self_read on reservation_items
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from reservations r
      where r.id = reservation_items.reservation_id
        and r.member_id = current_member_id()
    )
  );
create policy reservation_items_admin_write on reservation_items
  for all to authenticated using (is_admin()) with check (is_admin());

-- --- loans: own read, admin full --------------------------------------------
create policy loans_self_read on loans
  for select to authenticated
  using (member_id = current_member_id() or is_admin());
create policy loans_admin_write on loans
  for all to authenticated using (is_admin()) with check (is_admin());

-- --- settings: admin only ----------------------------------------------------
create policy settings_admin_all on settings
  for all to authenticated using (is_admin()) with check (is_admin());

-- --- email_log: admin read only ---------------------------------------------
create policy email_log_admin_read on email_log
  for select to authenticated using (is_admin());

-- =============================================================================
-- Member-initiated RPCs (members never write tables directly)
-- =============================================================================

-- Link the logged-in auth user to their member row by matching email.
create or replace function claim_membership()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email citext;
  v_member_id uuid;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return null;
  end if;

  update members
     set auth_user_id = auth.uid()
   where email = v_email
     and auth_user_id is null
  returning id into v_member_id;

  if v_member_id is null then
    -- Already linked, or no matching member; return existing link if any.
    select id into v_member_id from members where auth_user_id = auth.uid();
  end if;

  return v_member_id;
end;
$$;

-- Cancel one of the caller's own PENDING reservation items.
create or replace function cancel_my_item(item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update reservation_items ri
     set status = 'cancelled', decided_at = now()
   where ri.id = item_id
     and ri.status = 'pending'
     and exists (
       select 1 from reservations r
       where r.id = ri.reservation_id
         and r.member_id = current_member_id()
     );

  if not found then
    raise exception 'Item not found, not yours, or not cancellable';
  end if;
end;
$$;

grant execute on function claim_membership() to authenticated;
grant execute on function cancel_my_item(uuid) to authenticated;
