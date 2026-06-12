-- =============================================================================
-- English Library — triggers (TECH-PLAN D1)
-- 1. Auto-fulfill a reservation item when a loan is created from it.
-- 2. Guard legal reservation-item status transitions.
-- 3. Enforce the max-book-limit per reservation (defense behind the Edge Fn).
-- =============================================================================

-- --- 1. Auto-fulfill on loan creation ---------------------------------------
create or replace function fulfill_reservation_item()
returns trigger
language plpgsql
as $$
begin
  if new.reservation_item_id is not null then
    update reservation_items
       set status = 'fulfilled',
           loan_id = new.id,
           decided_at = coalesce(decided_at, now())
     where id = new.reservation_item_id;
  end if;
  return new;
end;
$$;

create trigger trg_fulfill_item
  after insert on loans
  for each row
  execute function fulfill_reservation_item();

-- --- 2. Status-transition guard ---------------------------------------------
create or replace function guard_reservation_item_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  -- Allowed transitions:
  --   pending   -> approved | rejected | cancelled | fulfilled
  --   approved  -> fulfilled | cancelled
  --   (rejected, cancelled, fulfilled are terminal)
  if old.status = 'pending'
     and new.status in ('approved', 'rejected', 'cancelled', 'fulfilled') then
    return new;
  elsif old.status = 'approved'
     and new.status in ('fulfilled', 'cancelled') then
    return new;
  end if;

  raise exception 'Illegal reservation_item status transition: % -> %', old.status, new.status;
end;
$$;

create trigger trg_item_status_guard
  before update on reservation_items
  for each row
  when (old.status is distinct from new.status)
  execute function guard_reservation_item_status();

-- --- 3. Max-book-limit guard ------------------------------------------------
create or replace function enforce_max_books()
returns trigger
language plpgsql
as $$
declare
  max_books int;
  current_count int;
begin
  select coalesce((value::text)::int, 9999) into max_books
    from settings where key = 'max_book_limit';
  max_books := coalesce(max_books, 9999);

  select count(*) into current_count
    from reservation_items
   where reservation_id = new.reservation_id;

  if current_count + 1 > max_books then
    raise exception 'Reservation exceeds the maximum of % books', max_books;
  end if;

  return new;
end;
$$;

create trigger trg_max_books
  before insert on reservation_items
  for each row
  execute function enforce_max_books();
