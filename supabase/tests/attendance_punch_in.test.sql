-- Punch-in rules, late fines and RLS for attendance and fines.
-- Uses _punch_in() with fixed clock values so every boundary is exact.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(40);

-- Empty slate (rolled back at the end; real local data is untouched).
delete from public.audit_log;
delete from public.fines;
delete from public.payments;
delete from public.attendance;
delete from public.sessions;
delete from public.venues;
-- Local fee data (rolled back at the end) would block removing the users below.
delete from public.fee_submissions;
delete from public.fee_payments;
delete from public.member_fees;
delete from public.fee_periods;
-- Tests run against the default rules, whatever the local settings are (rolled back at the end).
update public.club_settings
set updated_by = null, punch_open = '18:30', on_time_cutoff = '19:15', punch_close = '21:00',
  late_fine_npr = 50, absence_fine_npr = 100, regular_fee_npr = 800, partial_fee_npr = 400,
  fee_due_days = 16, fine_due_days = null
where id;
delete from public.game_commitments;
delete from public.member_inactive_periods;
delete from auth.users;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 'member.a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'member.b@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'inactive@test.local');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000e1';

insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);

-- Sessions on 1-10 Jan 2027; 7 Jan is cancelled.
insert into public.sessions (session_date, venue_id)
select d::date, '10000000-0000-0000-0000-000000000001'
from generate_series(date '2027-01-01', date '2027-01-10', interval '1 day') d;
update public.sessions set status = 'cancelled' where session_date = '2027-01-07';

-- Points: ~44 m north of the venue (inside 100 m) and ~133 m north (outside).
create temp table pts as select
  27.7198624 + 0.0004 as in_lat, 85.3407743 as lng,
  27.7198624 + 0.0012 as out_lat;

-- ---------------------------------------------------------------------------
-- Pure helpers
-- ---------------------------------------------------------------------------
select ok(
  public.distance_m(27.7198624, 85.3407743, (select in_lat from pts), 85.3407743) between 43 and 46,
  'distance_m: 0.0004 degrees of latitude is about 44 m');

select is(public.attendance_status_for('2027-01-01 19:14:59+05:45', '2027-01-01'), 'on_time', '19:14:59 is On Time');
select is(public.attendance_status_for('2027-01-01 19:15:00+05:45', '2027-01-01'), 'on_time', '19:15:00 is On Time');
select is(public.attendance_status_for('2027-01-01 19:15:00.999+05:45', '2027-01-01'), 'on_time', '19:15:00.999 is On Time (whole seconds)');
select is(public.attendance_status_for('2027-01-01 19:15:01+05:45', '2027-01-01'), 'late', '19:15:01 is Late');

-- ---------------------------------------------------------------------------
-- Punch-in through _punch_in (as the owner, with a fixed clock)
-- ---------------------------------------------------------------------------
select is(
  public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-01 19:14:59+05:45',
    (select in_lat from pts), (select lng from pts), 10) ->> 'status',
  'on_time', 'punch-in at 19:14:59 is On Time');

select is(
  (select count(*)::int from public.fines f join public.attendance a on a.id = f.attendance_id
   join public.sessions s on s.id = a.session_id where s.session_date = '2027-01-01'),
  0, 'an On Time punch-in creates no fine');

select is(
  public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-02 19:15:00.999+05:45',
    (select in_lat from pts), (select lng from pts), 10) ->> 'status',
  'on_time', 'punch-in at 19:15:00.999 is On Time');

select is(
  public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-03 19:15:01+05:45',
    (select in_lat from pts), (select lng from pts), 10) ->> 'fine_npr',
  '50', 'punch-in at 19:15:01 is Late and reports an NPR 50 fine');

select results_eq(
  $$ select f.reason, f.amount_npr, f.status::text, f.member_id
     from public.fines f join public.attendance a on a.id = f.attendance_id
     join public.sessions s on s.id = a.session_id where s.session_date = '2027-01-03' $$,
  $$ values ('late', 50, 'pending', '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'the late punch-in created one pending NPR 50 late fine for the member');

select results_eq(
  $$ select a.status::text, a.venue_radius_m, a.venue_max_accuracy_m, round(a.distance_m)::int
     from public.attendance a join public.sessions s on s.id = a.session_id
     where s.session_date = '2027-01-03' $$,
  $$ values ('late', 100, 50, 44) $$,
  'attendance stores the status, the venue settings used and the server distance');

select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-03 19:30:00+05:45',
       (select in_lat from pts), (select lng from pts), 10) $$,
  '22023', 'You have already punched in for today''s session.', 'a second punch-in is refused');

select is(
  (select count(*)::int from public.fines where member_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'the refused duplicate created no extra fine');

select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-04 18:29:59+05:45',
       (select in_lat from pts), (select lng from pts), 10) $$,
  '22023', 'Punch-in opens at 6:30 PM.', '18:29:59 is before the window');

select is(
  public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-04 18:30:00+05:45',
    (select in_lat from pts), (select lng from pts), 10) ->> 'status',
  'on_time', '18:30:00 opens the window');

select is(
  public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-05 21:00:00+05:45',
    (select in_lat from pts), (select lng from pts), 10) ->> 'status',
  'late', '21:00:00 is still accepted (Late)');

select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-06 21:00:01+05:45',
       (select in_lat from pts), (select lng from pts), 10) $$,
  '22023', 'Punch-in closed at 9:00 PM.', '21:00:01 is after the window');

select throws_like(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-06 19:00:00+05:45',
       (select out_lat from pts), (select lng from pts), 10) $$,
  'You are 133 m from Dhanyentari Futsal.%', 'a punch-in 133 m away is refused with the distance');

select throws_like(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-06 19:00:00+05:45',
       (select in_lat from pts), (select lng from pts), 51) $$,
  'Your location is too uncertain%', 'GPS accuracy worse than 50 m is refused');

select lives_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-06 19:00:00+05:45',
       (select in_lat from pts), (select lng from pts), 50) $$,
  'GPS accuracy of exactly 50 m is accepted');

select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-07 19:00:00+05:45',
       (select in_lat from pts), (select lng from pts), 10) $$,
  '22023', 'Today''s session is cancelled.', 'a cancelled session refuses punch-in');

select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-02-01 19:00:00+05:45',
       (select in_lat from pts), (select lng from pts), 10) $$,
  '22023', 'There is no session today.', 'a day without a session refuses punch-in');

select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000e1', '2027-01-08 19:00:00+05:45',
       (select in_lat from pts), (select lng from pts), 10) $$,
  '22023', 'Your account is not active. Contact the team admin.', 'an inactive member cannot punch in');

select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-08 19:00:00+05:45',
       95, (select lng from pts), 10) $$,
  '22023', 'The location from your phone was not valid. Please try again.', 'an impossible latitude is refused');

select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-08 19:00:00+05:45',
       (select in_lat from pts), (select lng from pts), 'NaN') $$,
  '22023', 'The location from your phone was not valid. Please try again.', 'a NaN accuracy is refused');

select throws_ok(
  $$ delete from public.sessions where session_date = '2027-01-01' $$,
  '23503', null, 'a session with attendance cannot be deleted');

-- Member B: late on 1 Jan, so B has a fine too.
select is(
  public._punch_in('00000000-0000-0000-0000-0000000000b1', '2027-01-01 19:20:00+05:45',
    (select in_lat from pts), (select lng from pts), 10) ->> 'status',
  'late', 'a second member can punch in for the same session');

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select public.punch_in(27.7, 85.3, 10) $$, '42501', null, 'anon cannot call punch_in');
select throws_ok($$ select * from public.attendance $$, '42501', null, 'anon cannot read attendance');
reset role;

-- ---------------------------------------------------------------------------
-- Member A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.attendance where member_id = '00000000-0000-0000-0000-0000000000a1'),
  6, 'a member reads their own complete punch-in history');
select is(
  (select count(*)::int from public.attendance where member_id <> '00000000-0000-0000-0000-0000000000a1'),
  0, 'a member cannot read another member''s attendance or GPS');
select ok(
  (select count(*)::int from public.fines where member_id <> '00000000-0000-0000-0000-0000000000a1') > 0,
  'team transparency: a member reads the other members'' fines');

select throws_ok(
  $$ insert into public.attendance (member_id, session_id, venue_id, punched_in_at, status, latitude,
       longitude, accuracy_m, distance_m, venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m)
     select '00000000-0000-0000-0000-0000000000a1', id, venue_id, now(), 'on_time', 0, 0, 0, 0, 0, 0, 100, 50
     from public.sessions where session_date = '2027-01-09' $$,
  '42501', null, 'a member cannot write attendance directly');
select throws_ok(
  $$ update public.attendance set status = 'on_time' $$,
  '42501', null, 'a member cannot change attendance (status, time or GPS)');
select throws_ok(
  $$ update public.fines set status = 'waived' $$,
  '42501', null, 'a member cannot waive or pay their own fine');
select throws_ok(
  $$ delete from public.fines $$,
  '42501', null, 'a member cannot delete fines');
select throws_ok(
  $$ select public._punch_in('00000000-0000-0000-0000-0000000000a1', '2027-01-09 19:00:00+05:45', 27.72, 85.34, 10) $$,
  '42501', null, 'a member cannot call the internal _punch_in (no choosing the clock)');
select throws_ok(
  $$ select public.punch_in(27.72, 85.34, 10) $$,
  '22023', 'There is no session today.', 'a member can call punch_in, which uses the real clock');

reset role;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.attendance where member_id = '00000000-0000-0000-0000-0000000000b1'),
  1, 'the admin reads every member''s attendance');
select throws_ok(
  $$ insert into public.fines (member_id, reason, amount_npr)
     values ('00000000-0000-0000-0000-0000000000b1', 'late', 50) $$,
  '42501', null, 'even the admin cannot insert fines directly');

reset role;

select * from finish();
rollback;
