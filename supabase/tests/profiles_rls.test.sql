-- RLS and grant tests for public.profiles.
-- Run with: npm run db:test   (local stack only)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- Start from an empty slate. Everything runs in one transaction that is rolled
-- back at the end, so real local data is untouched.
delete from public.sessions;
delete from public.venues;
delete from auth.users;

-- ---------------------------------------------------------------------------
-- Fixtures: inserting into auth.users fires handle_new_user().
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"Team Admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'member.a@test.local', '{"display_name":"Member A","role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'member.b@test.local', '{}');

-- Bootstrap the admin the same way it is done in the dashboard: one SQL update.
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- To act as a signed-in user: set the JWT claims that auth.uid() reads,
-- then switch to the authenticated role for the rest of the transaction.

-- ---------------------------------------------------------------------------
-- Trigger behaviour (as the migration owner)
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.profiles), 3,
  'every auth user gets a profile');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'Member A', 'display_name comes from invite metadata');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'member.b', 'display_name falls back to the email local part');

select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'member', 'a role in user metadata is ignored');

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23505', null,
  'the database allows only one admin');

select throws_ok(
  $$ insert into auth.users (id, email) values
     ('00000000-0000-0000-0000-0000000000c1', ' ') $$,
  '23514', null,
  'a blank display name is rejected');

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok(
  $$ select * from public.profiles $$,
  '42501', null, 'anon cannot read profiles');

select throws_ok(
  $$ select public.is_admin() $$,
  '42501', null, 'anon cannot call is_admin()');

reset role;

-- ---------------------------------------------------------------------------
-- Member A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'a member sees only their own profile');

select is(public.is_admin(), false, 'is_admin() is false for a member');

select lives_ok(
  $$ update public.profiles set display_name = 'A Renamed'
     where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'a member can rename themselves');

select throws_ok(
  $$ update public.profiles set role = 'admin'
     where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'a member cannot change their role');

select throws_ok(
  $$ update public.profiles set is_active = false
     where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'a member cannot change is_active');

select throws_ok(
  $$ update public.profiles set id = gen_random_uuid()
     where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'a member cannot change their profile id');

-- Updating another member's row matches zero rows under RLS (no error, no change).
update public.profiles set display_name = 'Hacked'
  where id = '00000000-0000-0000-0000-0000000000b1';

select throws_ok(
  $$ insert into public.profiles (id, display_name)
     values ('00000000-0000-0000-0000-0000000000d1', 'Fake') $$,
  '42501', null, 'a member cannot insert profiles');

select throws_ok(
  $$ delete from public.profiles where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'a member cannot delete profiles');

reset role;

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'member.b', 'a member cannot rename another member');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'A Renamed', 'the own-profile rename was saved');

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is(public.is_admin(), true, 'is_admin() is true for the admin');

select is(
  (select count(*)::int from public.profiles), 3,
  'the admin can read every profile');

reset role;

-- A deactivated admin loses admin rights.
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is(public.is_admin(), false, 'an inactive admin is not treated as admin');

select is(
  (select count(*)::int from public.profiles), 1,
  'an inactive admin sees only their own profile');

reset role;

select * from finish();
rollback;
