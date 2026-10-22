-- =============================================================================
-- Admin can mark a book unavailable (lost, damaged, withdrawn, ...).
-- * books.is_unavailable: the flag
-- * book_availability: is_available is false for flagged books; is_unavailable exposed
-- * trigger: new loans for a flagged book are refused
-- =============================================================================

alter table books add column if not exists is_unavailable boolean not null default false;

create or replace view book_availability
with (security_invoker = off) as
  select b.id as book_id,
         (not b.is_unavailable and l.id is null and not exists (
            select 1 from reservation_items ri
             where ri.book_id = b.id and ri.status = 'approved'
         )) as is_available,
         l.due_date as expected_return,
         (not b.is_unavailable and l.id is null and exists (
            select 1 from reservation_items ri
             where ri.book_id = b.id and ri.status = 'approved'
         )) as is_reserved,
         b.is_unavailable as is_unavailable
    from books b
    left join loans l
      on l.book_id = b.id and l.date_returned is null;

grant select on book_availability to anon, authenticated;

create or replace function guard_loan_book_available()
returns trigger
language plpgsql
as $$
begin
  if new.date_returned is null
     and exists (select 1 from books where id = new.book_id and is_unavailable) then
    raise exception 'This book is marked unavailable';
  end if;
  return new;
end;
$$;

drop trigger if exists loans_guard_book_available on loans;
create trigger loans_guard_book_available
  before insert on loans
  for each row execute function guard_loan_book_available();
