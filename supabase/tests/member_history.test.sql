-- Member history, derived absences and the team view.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

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
-- Fixtures (relative to the real Nepal date, so "closed" uses the real clock)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', '{"display_name":"Asha"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', '{"display_name":"Bikash"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.local', '{"display_name":"Inactive"}');
-- Both members joined 10 days ago.
update public.profiles set created_at = now() - interval '10 days';
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000e1';

insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);

insert into public.sessions (id, session_date, venue_id, status) values
  ('20000000-0000-0000-0000-000000000012', public.nepal_today() - 12, '10000000-0000-0000-0000-000000000001', 'scheduled'), -- before joining
  ('20000000-0000-0000-0000-000000000009', public.nepal_today() - 9,  '10000000-0000-0000-0000-000000000001', 'scheduled'), -- A on time, B late
  ('20000000-0000-0000-0000-000000000008', public.nepal_today() - 8,  '10000000-0000-0000-0000-000000000001', 'scheduled'), -- A late + fine
  ('20000000-0000-0000-0000-000000000007', public.nepal_today() - 7,  '10000000-0000-0000-0000-000000000001', 'scheduled'), -- A absent
  ('20000000-0000-0000-0000-000000000006', public.nepal_today() - 6,  '10000000-0000-0000-0000-000000000001', 'cancelled'), -- not counted
  ('20000000-0000-0000-0000-000000000099', public.nepal_today() + 1,  '10000000-0000-0000-0000-000000000001', 'scheduled'); -- future

-- Attendance written directly by the owner (punch_in() is tested elsewhere).
create function pg_temp.att(p_member uuid, p_session uuid, p_status public.attendance_status) returns uuid
language sql as $$
  insert into public.attendance (member_id, session_id, venue_id, punched_in_at, status, latitude, longitude,
    accuracy_m, distance_m, venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m)
  values (p_member, p_session, '10000000-0000-0000-0000-000000000001', now(), p_status,
    27.7202, 85.3408, 12, 40, 27.7198624, 85.3407743, 100, 50)
  returning id;
$$;

select pg_temp.att('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000009', 'on_time');
insert into public.fines (member_id, attendance_id, reason, amount_npr)
select '00000000-0000-0000-0000-0000000000a1',
  pg_temp.att('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000008', 'late'), 'late', 50;
select pg_temp.att('00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000009', 'late');

-- ---------------------------------------------------------------------------
select is(public.session_closed(public.nepal_today() - 1), true, 'yesterday''s session is closed');
select is(public.session_closed(public.nepal_today() + 1), false, 'tomorrow''s session is not closed');

-- ---------------------------------------------------------------------------
-- Member A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select session_date, result from public.my_session_history() $$,
  $$ values (public.nepal_today() - 7, 'absent'),
            (public.nepal_today() - 8, 'late'),
            (public.nepal_today() - 9, 'on_time') $$,
  'history: newest first; absences derived; cancelled, pre-joining and future sessions excluded');

select results_eq(
  $$ select fine_npr, fine_status::text from public.my_session_history() where result = 'late' $$,
  $$ values (50, 'pending') $$,
  'the late session shows its NPR 50 pending fine');

select is(
  (select fine_npr from public.my_session_history() where result = 'absent'), null,
  'an absence has no fine');

select ok(
  (select latitude is not null and distance_m = 40 from public.my_session_history() where result = 'on_time'),
  'a member sees their own GPS evidence in their history');

select results_eq(
  $$ select display_name, result from public.session_roster('20000000-0000-0000-0000-000000000009')
     where result in ('on_time', 'late') $$,
  $$ values ('Asha', 'on_time'), ('Bikash', 'late') $$,
  'team roster: every member who punched in, with status');

select ok(
  (select count(*) > 0 from public.session_roster('20000000-0000-0000-0000-000000000007') where result = 'absent'),
  'team roster also lists absent members (transparency)');

select ok(
  (select distance_m is null and accuracy_m is null
   from public.session_roster('20000000-0000-0000-0000-000000000009') where display_name = 'Bikash'),
  'the roster hides another member''s distance and accuracy');

select ok(
  (select distance_m is not null
   from public.session_roster('20000000-0000-0000-0000-000000000009') where display_name = 'Asha'),
  'the roster shows the caller''s own distance');

select is(
  (select count(*)::int from public.attendance where member_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'the roster does not open up other members'' attendance rows (GPS)');

reset role;

-- ---------------------------------------------------------------------------
-- Member B sees their own history only
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select session_date, result from public.my_session_history() $$,
  $$ values (public.nepal_today() - 7, 'absent'),
            (public.nepal_today() - 8, 'absent'),
            (public.nepal_today() - 9, 'late') $$,
  'another member gets their own results, not member A''s');

select is(
  (select count(*)::int from public.my_session_history() where fine_npr is not null),
  0, 'member B does not see member A''s fine');

reset role;

-- ---------------------------------------------------------------------------
-- Inactive member and anon
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.session_roster('20000000-0000-0000-0000-000000000009') $$,
  '42501', 'Your account is not active.', 'an inactive member cannot use the team roster');
select is((select count(*)::int from public.my_session_history()), 0,
  'an inactive member gets no history (sessions are hidden from them)');
reset role;

set local role anon;
select throws_ok($$ select * from public.my_session_history() $$, '42501', null, 'anon cannot read history');
select throws_ok($$ select * from public.session_roster('20000000-0000-0000-0000-000000000009') $$,
  '42501', null, 'anon cannot use the team view');
select throws_ok($$ select public.session_closed(current_date) $$, '42501', null, 'anon cannot call session_closed');
reset role;

select * from finish();
rollback;
