-- =============================================================================
-- English Library — local dev seed (TECH-PLAN D1)
-- Applied automatically by `supabase db reset`. NOT used in production.
-- The admin member uses a real address so local OTP login works (codes land in
-- Mailpit locally regardless of the address).
-- =============================================================================

-- --- Categories -------------------------------------------------------------
insert into categories (name, sort_order) values
  ('Fiction', 1),
  ('Non-fiction', 2),
  ('Children', 3),
  ('Biography', 4);

-- --- Books ------------------------------------------------------------------
insert into books (title, author, category_id, description, pages) values
  ('The Hobbit', 'J.R.R. Tolkien', (select id from categories where name = 'Fiction'),
   'A hobbit is swept into a quest to reclaim a treasure guarded by a dragon.', 310),
  ('1984', 'George Orwell', (select id from categories where name = 'Fiction'),
   'A dystopian tale of surveillance and totalitarian control.', 328),
  ('Pride and Prejudice', 'Jane Austen', (select id from categories where name = 'Fiction'),
   'Elizabeth Bennet navigates love, reputation, and class.', 432),
  ('To Kill a Mockingbird', 'Harper Lee', (select id from categories where name = 'Fiction'),
   'A young girl confronts racial injustice in the American South.', 281),
  ('Sapiens', 'Yuval Noah Harari', (select id from categories where name = 'Non-fiction'),
   'A sweeping history of humankind.', 443),
  ('Atomic Habits', 'James Clear', (select id from categories where name = 'Non-fiction'),
   'A practical framework for building good habits.', 320),
  ('A Brief History of Time', 'Stephen Hawking', (select id from categories where name = 'Non-fiction'),
   'Cosmology for the general reader.', 256),
  ('The Very Hungry Caterpillar', 'Eric Carle', (select id from categories where name = 'Children'),
   'A caterpillar eats its way to becoming a butterfly.', 26),
  ('Where the Wild Things Are', 'Maurice Sendak', (select id from categories where name = 'Children'),
   'Max sails to the land of the Wild Things.', 48),
  ('Matilda', 'Roald Dahl', (select id from categories where name = 'Children'),
   'A gifted girl outwits cruel adults.', 240),
  ('Steve Jobs', 'Walter Isaacson', (select id from categories where name = 'Biography'),
   'The authorized biography of Apple''s co-founder.', 656),
  ('The Diary of a Young Girl', 'Anne Frank', (select id from categories where name = 'Biography'),
   'Anne Frank''s diary written in hiding during WWII.', 283);

-- --- Members ----------------------------------------------------------------
insert into members (name, email, phone, address, paid, is_admin, comments) values
  ('Library Admin', 'm3220298@gmail.com', '050-0000000', 'Library', true, true, 'Site administrator'),
  ('Alice Cohen', 'alice@example.com', '052-1111111', '12 Herzl St', true, false, null),
  ('Ben Levi', 'ben@example.com', '053-2222222', '34 Weizmann St', true, false, 'Prefers fiction'),
  ('Chana Mizrahi', 'chana@example.com', '054-3333333', '5 Ben Gurion Blvd', false, false, 'Membership fee pending'),
  ('David Katz', 'david@example.com', '055-4444444', '78 Rothschild Blvd', true, false, null);

-- --- Loans: one normal, one overdue -----------------------------------------
insert into loans (book_id, member_id, date_given, due_date, date_returned) values
  ((select id from books where title = '1984'),
   (select id from members where email = 'alice@example.com'),
   current_date - 3, current_date + 11, null),
  ((select id from books where title = 'Sapiens'),
   (select id from members where email = 'ben@example.com'),
   current_date - 20, current_date - 6, null);  -- overdue

-- --- A pending 3-book reservation from Chana --------------------------------
do $$
declare
  v_res uuid;
  v_member uuid;
begin
  select id into v_member from members where email = 'chana@example.com';

  insert into reservations (member_id, name, email, phone, pickup_time, comments)
  values (v_member, 'Chana Mizrahi', 'chana@example.com', '054-3333333',
          'Tomorrow afternoon', 'Looking forward to these!')
  returning id into v_res;

  insert into reservation_items (reservation_id, book_id, status) values
    (v_res, (select id from books where title = 'The Hobbit'), 'pending'),
    (v_res, (select id from books where title = 'Matilda'), 'pending'),
    (v_res, (select id from books where title = 'Sapiens'), 'pending');  -- currently out → waitlist
end $$;
