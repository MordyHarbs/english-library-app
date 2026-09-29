-- =============================================================================
-- Fix: app_notices was created after the one-time blanket
-- `grant all on all tables in schema public to service_role` in
-- 20260612000004_rls.sql, so it never picked up that grant. Edge Functions
-- (e.g. backup-to-drive) run as service_role and got "permission denied for
-- table app_notices" trying to export it.
--
-- Also set default privileges so any *future* table automatically grants
-- service_role access, instead of relying on a one-time blanket grant that
-- only covers tables that already exist.
-- =============================================================================

grant all on app_notices to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
