-- A book with an approved (not yet picked up) reservation item is unavailable,
-- just like one that's on loan. Future-dated loans already count as unavailable
-- because the open loan row exists from the moment it's created.
create or replace view book_availability
with (security_invoker = off) as
  select b.id as book_id,
         (l.id is null and not exists (
            select 1 from reservation_items ri
             where ri.book_id = b.id and ri.status = 'approved'
         )) as is_available,
         l.due_date as expected_return,
         (l.id is null and exists (
            select 1 from reservation_items ri
             where ri.book_id = b.id and ri.status = 'approved'
         )) as is_reserved
    from books b
    left join loans l
      on l.book_id = b.id and l.date_returned is null;

grant select on book_availability to anon, authenticated;
