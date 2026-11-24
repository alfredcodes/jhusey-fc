-- Grants for the admin-users Edge Function (2026-11-24).
-- Local Supabase gives service_role every table privilege by default; new hosted projects do not,
-- so on the hosted project the function could not read the caller's profile and refused every
-- admin with "Only the admin can do this." Grant exactly what the function uses
-- (supabase/functions/admin-users/index.ts). service_role already bypasses RLS.
grant select on public.profiles to service_role;
grant select, update (phone, must_change_password) on public.member_private to service_role;
grant insert on public.audit_log to service_role;
