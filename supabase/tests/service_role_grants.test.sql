-- The admin-users Edge Function runs as service_role: it needs exactly these privileges,
-- also on a hosted project where nothing is granted by default.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(4);
select ok(has_table_privilege('service_role', 'public.profiles', 'SELECT'), 'service_role reads profiles');
select ok(has_table_privilege('service_role', 'public.member_private', 'SELECT'), 'service_role reads member_private');
select ok(has_column_privilege('service_role', 'public.member_private', 'must_change_password', 'UPDATE'),
  'service_role can set must_change_password');
select ok(has_table_privilege('service_role', 'public.audit_log', 'INSERT'), 'service_role writes the audit log');
select * from finish();
rollback;
