-- =============================================================================
-- English Library — core schema (TECH-PLAN D1)
-- Extensions, enums, tables, constraints, indexes.
-- =============================================================================

create extension if not exists citext;

-- --- Enums ------------------------------------------------------------------
create type reservation_item_status as enum
  ('pending', 'approved', 'rejected', 'cancelled', 'fulfilled');

-- --- Tables -----------------------------------------------------------------

create table members (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  name          text not null,
  email         citext not null unique,
  phone         text,
  address       text,
  paid          boolean not null default false,
  fees_owed     numeric(8, 2) not null default 0,
  comments      text,
  is_admin      boolean not null default false,
  date_added    timestamptz not null default now()
);

create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        citext not null unique,
  sort_order  int not null default 999
);

create table books (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  author       text,
  category_id  uuid references categories (id) on delete set null,
  description  text,
  pages        int,
  comments     text,
  cover_path   text,
  date_added   timestamptz not null default now()
);

create table reservations (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid references members (id) on delete set null,
  name          text not null,
  email         citext not null,
  phone         text,
  address       text,
  pickup_time   text,
  comments      text,
  admin_note    text,
  created_at    timestamptz not null default now(),
  finalized_at  timestamptz
);

-- reservation_items references loans, and loans references reservation_items
-- (circular). Create reservation_items first WITHOUT the loan_id FK, add it
-- after loans exists.
create table reservation_items (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations (id) on delete cascade,
  book_id         uuid not null references books (id),
  status          reservation_item_status not null default 'pending',
  decided_at      timestamptz,
  loan_id         uuid
);

create table loans (
  id                   uuid primary key default gen_random_uuid(),
  book_id              uuid not null references books (id),
  member_id            uuid not null references members (id),
  reservation_item_id  uuid unique references reservation_items (id),
  date_given           date not null default (now() at time zone 'Asia/Jerusalem')::date,
  due_date             date not null,
  date_returned        date,
  comments             text,
  created_at           timestamptz not null default now()
);

-- Now close the circular reference.
alter table reservation_items
  add constraint reservation_items_loan_id_fkey
  foreign key (loan_id) references loans (id) on delete set null;

create table settings (
  key          text primary key,
  value        jsonb not null,
  description  text
);

create table email_log (
  id              uuid primary key default gen_random_uuid(),
  type            text not null,
  recipient       citext not null,
  loan_id         uuid references loans (id) on delete set null,
  reservation_id  uuid references reservations (id) on delete set null,
  dedupe_key      text unique,
  sent_at         timestamptz not null default now()
);

-- --- Constraints & indexes --------------------------------------------------

-- A physical book can be on loan only once at a time.
create unique index one_open_loan_per_book
  on loans (book_id) where date_returned is null;

create index loans_member_idx on loans (member_id);
create index loans_due_open_idx on loans (due_date) where date_returned is null;
create index reservation_items_reservation_idx on reservation_items (reservation_id);
create index reservation_items_active_book_idx
  on reservation_items (book_id) where status in ('pending', 'approved');
create index books_category_idx on books (category_id);
create index reservations_member_idx on reservations (member_id);
create index reservations_created_idx on reservations (created_at desc);
