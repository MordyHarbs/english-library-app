create sequence if not exists books_serial_number_seq;

alter table books add column if not exists serial_number integer;

with numbered as (
  select id, row_number() over (order by date_added, title, id)::integer as n
    from books
   where serial_number is null
)
update books b
   set serial_number = numbered.n
  from numbered
 where b.id = numbered.id;

select setval(
  'books_serial_number_seq',
  greatest(coalesce((select max(serial_number) from books), 0), 1),
  true
);

alter table books alter column serial_number set default nextval('books_serial_number_seq');
alter table books alter column serial_number set not null;

create unique index if not exists books_serial_number_key on books (serial_number);