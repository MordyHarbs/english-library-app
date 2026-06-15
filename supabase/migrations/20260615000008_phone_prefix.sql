-- Normalize local phone numbers imported without a leading zero.
-- International numbers that start with + are left unchanged.
update members
   set phone = '0' || btrim(phone)
 where phone is not null
   and btrim(phone) <> ''
   and btrim(phone) not like '0%'
   and btrim(phone) not like '+%';

update reservations
   set phone = '0' || btrim(phone)
 where phone is not null
   and btrim(phone) <> ''
   and btrim(phone) not like '0%'
   and btrim(phone) not like '+%';