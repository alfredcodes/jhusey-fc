-- RLS, constraint and generator tests for public.venues and public.sessions.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

-- Start from an empty slate (rolled back at the end; real local data is untouched).
delete from public.audit_log;
delete from public.fines;
delete from public.payments;
delete from public.attendance;
delete from public.sessions;
delete from public.venues;
delete from auth.users;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 'member@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'inactive@test.local');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000e1';

insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Main Court', 27.7172, 85.3240),
  ('10000000-0000-0000-0000-000000000002', 'Old Court', 27.7, 85.3);
update public.venues set is_active = false where id = '10000000-0000-0000-0000-000000000002';

insert into public.sessions (id, session_date, venue_id) values
  ('20000000-0000-0000-0000-000000000001', public.nepal_today() + 1,
   '10000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Helpers and constraints (as the migration owner)
-- ---------------------------------------------------------------------------
select is(public.nepal_today(), (now() at time zone 'Asia/Kathmandu')::date,
  'nepal_today() is the current date in Asia/Kathmandu');

select is((select geofence_radius_m from public.venues where name = 'Main Court'), 100,
  'the geofence radius defaults to 100 m');

select throws_ok(
  $$ insert into public.venues (name, latitude, longitude) values ('Bad', 95, 85) $$,
  '23514', null, 'latitude must be between -90 and 90');

select throws_ok(
  $$ insert into public.venues (name, latitude, longitude, geofence_radius_m) values ('Bad', 27, 85, 5) $$,
  '23514', null, 'a geofence radius below 20 m is rejected');

select throws_ok(
  $$ insert into public.sessions (session_date, venue_id)
     values (public.nepal_today() + 1, '10000000-0000-0000-0000-000000000001') $$,
  '23505', null, 'only one session per date');

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.venues $$, '42501', null, 'anon cannot read venues');
select throws_ok($$ select * from public.sessions $$, '42501', null, 'anon cannot read sessions');
reset role;

-- ---------------------------------------------------------------------------
-- Inactive member
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.venues), 0, 'an inactive member sees no venues');
select is((select count(*)::int from public.sessions), 0, 'an inactive member sees no sessions');
reset role;

-- ---------------------------------------------------------------------------
-- Active member
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.venues), 2, 'a member can read venues');
select is((select count(*)::int from public.sessions), 1, 'a member can read sessions');

select throws_ok(
  $$ insert into public.venues (name, latitude, longitude) values ('Mine', 27, 85) $$,
  '42501', null, 'a member cannot create venues');

select throws_ok(
  $$ insert into public.sessions (session_date, venue_id)
     values (public.nepal_today() + 2, '10000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'a member cannot create sessions');

select throws_ok(
  $$ select public.admin_create_sessions('10000000-0000-0000-0000-000000000001',
       public.nepal_today() + 1, public.nepal_today() + 7, array[0, 1, 2, 3, 4, 5, 6]) $$,
  '42501', null, 'a member cannot run the session generator');

-- Updates and deletes by a member match zero rows under RLS.
update public.venues set geofence_radius_m = 1000;
update public.sessions set status = 'cancelled';
delete from public.sessions;

reset role;

select is((select geofence_radius_m from public.venues where name = 'Main Court'), 100,
  'a member cannot change a venue radius');
select is((select status::text from public.sessions where id = '20000000-0000-0000-0000-000000000001'),
  'scheduled', 'a member cannot cancel a session');
select is((select count(*)::int from public.sessions), 1, 'a member cannot delete sessions');

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ update public.venues set geofence_radius_m = 150 where name = 'Main Court' $$,
  'the admin can change the venue radius');

select lives_ok(
  $$ update public.sessions set status = 'cancelled'
     where id = '20000000-0000-0000-0000-000000000001' $$,
  'the admin can cancel a session');

-- Two weeks starting tomorrow, Sundays and Wednesdays. Tomorrow already has a session.
select is(
  public.admin_create_sessions('10000000-0000-0000-0000-000000000001',
    public.nepal_today() + 1, public.nepal_today() + 14, array[0, 3]),
  (select count(*)::int
   from generate_series(public.nepal_today() + 1, public.nepal_today() + 14, interval '1 day') d
   where extract(dow from d)::int in (0, 3)
     and d::date <> public.nepal_today() + 1),
  'the generator creates one session per chosen weekday, skipping existing dates');

select is(
  public.admin_create_sessions('10000000-0000-0000-0000-000000000001',
    public.nepal_today() + 1, public.nepal_today() + 14, array[0, 3]),
  0, 'running the generator again creates nothing');

select is(
  (select count(*)::int from public.sessions
   where extract(dow from session_date)::int not in (0, 3)
     and id <> '20000000-0000-0000-0000-000000000001'),
  0, 'only the chosen weekdays were created');

select throws_ok(
  $$ select public.admin_create_sessions('10000000-0000-0000-0000-000000000001',
       public.nepal_today() - 1, public.nepal_today() + 7, array[1]) $$,
  '22023', 'Sessions cannot start in the past.', 'the generator refuses past dates');

select throws_ok(
  $$ select public.admin_create_sessions('10000000-0000-0000-0000-000000000001',
       public.nepal_today(), public.nepal_today() + 7, array[7]) $$,
  '22023', 'Choose at least one weekday.', 'the generator refuses an invalid weekday');

select throws_ok(
  $$ select public.admin_create_sessions('10000000-0000-0000-0000-000000000001',
       public.nepal_today(), public.nepal_today() + 181, array[1]) $$,
  '22023', 'Create at most 180 days of sessions at a time.', 'the generator limits the range');

select throws_ok(
  $$ select public.admin_create_sessions('10000000-0000-0000-0000-000000000002',
       public.nepal_today(), public.nepal_today() + 7, array[1]) $$,
  '22023', 'Choose an active venue.', 'the generator refuses an inactive venue');

select lives_ok(
  $$ delete from public.sessions where id = '20000000-0000-0000-0000-000000000001' $$,
  'the admin can delete a session that has no attendance');

reset role;

select * from finish();
rollback;
