-- Members can be tracked without an email address. Members without email cannot
-- use email login until an address is added.
alter table members alter column email drop not null;