-- =============================================================================
-- English Library — public views (TECH-PLAN D1)
-- These run as the view owner (security_invoker = off), so they bypass RLS on
-- the underlying tables and expose ONLY non-private columns to anon/authenticated.
-- =============================================================================

-- Availability: which books are out and when they're due back.
-- Exposes nothing about WHO has the book.
create view book_availability
with (security_invoker = off) as
  select b.id as book_id,
         (l.id is null) as is_available,
         l.due_date as expected_return
    from books b
    left join loans l
      on l.book_id = b.id and l.date_returned is null;

-- The subset of settings the public reserve UI needs (book limits, loan length).
create view public_settings
with (security_invoker = off) as
  select key, value
    from settings
   where key in ('default_book_limit', 'max_book_limit', 'loan_duration_days');

grant select on book_availability to anon, authenticated;
grant select on public_settings to anon, authenticated;
