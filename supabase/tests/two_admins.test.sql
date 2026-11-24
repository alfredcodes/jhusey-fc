-- Up to two admins (2026-11-24): a third is refused; admins cannot deactivate each other.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

delete from public.audit_log;
delete from public.fines;
delete from public.payments;
delete from public.absence_excuses;
delete from public.attendance;
delete from public.sessions;
delete from public.venues;
delete from public.fee_submissions;
delete from public.fee_payments;
delete from public.member_fees;
delete from public.fee_periods;
delete from public.member_inactive_periods;
update public.club_settings set updated_by = null where id;
delete from auth.users;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', '{"display_name":"Admin A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"display_name":"Admin B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.local', '{"display_name":"Chandra"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.local', '{"display_name":"Dipak"}');

select lives_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'the first admin is allowed');
select lives_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'a second admin is allowed');
select throws_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '23514', 'There can be at most two admins.', 'a third admin is refused');
select lives_ok($$ update public.profiles set display_name = 'Admin B.' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'updating an existing admin does not count as a new admin');

-- Admin A acts in the app.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_update_member('00000000-0000-0000-0000-00000000000b', 'Admin B', false) $$,
  '22023', 'An admin account cannot be deactivated. Remove the admin role first.',
  'one admin cannot deactivate the other');
select lives_ok($$ select public.admin_update_member('00000000-0000-0000-0000-00000000000b', 'Admin Bee', true) $$,
  'but can rename them');
select throws_ok($$ select public.admin_update_member('00000000-0000-0000-0000-00000000000a', 'Admin A', false) $$,
  '22023', 'You cannot deactivate your own admin account.', 'an admin cannot deactivate themselves');
select lives_ok($$ select public.admin_update_member('00000000-0000-0000-0000-0000000000d1', 'Dipak', false) $$,
  'either admin can deactivate a member');
reset role;

-- Removing an admin role frees the slot.
update public.profiles set role = 'member' where id = '00000000-0000-0000-0000-00000000000b';
select lives_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'after one admin is removed, another member can become admin');

select * from finish();
rollback;
