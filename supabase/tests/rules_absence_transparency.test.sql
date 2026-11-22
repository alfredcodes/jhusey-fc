-- Editable club rules, absence fines and excuses, team transparency, private member data.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(51);

delete from public.audit_log;
delete from public.fines;
delete from public.payments;
delete from public.attendance;
delete from public.sessions;
delete from public.venues;
delete from auth.users;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', '{"display_name":"Asha"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', '{"display_name":"Bikash"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.local', '{"display_name":"Chandra"}');
update public.profiles set created_at = now() - interval '60 days';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000c1';

-- Known rules for the test (the real row is restored by the rollback).
update public.club_settings set punch_open = '18:30', on_time_cutoff = '19:15', punch_close = '21:00',
  late_fine_npr = 50, absence_fine_npr = 100, absence_fines_from = public.nepal_today() - 20;

insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);
insert into public.sessions (id, session_date, venue_id, status) values
  ('20000000-0000-0000-0000-000000000001', public.nepal_today() - 5,  '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000002', public.nepal_today() - 4,  '10000000-0000-0000-0000-000000000001', 'cancelled'),
  ('20000000-0000-0000-0000-000000000003', public.nepal_today() - 30, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000004', public.nepal_today() + 3,  '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000005', public.nepal_today() + 1,  '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000006', public.nepal_today(),      '10000000-0000-0000-0000-000000000001', 'scheduled');

-- Asha punched in on time at S1.
insert into public.attendance (member_id, session_id, venue_id, punched_in_at, status, latitude, longitude,
  accuracy_m, distance_m, venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m)
values ('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', now() - interval '5 days', 'on_time',
  27.7202, 85.3408, 12, 40, 27.7198624, 85.3407743, 100, 50);

create function pg_temp.nepal(p_day integer, p_time time) returns timestamptz
language sql as $$ select ((public.nepal_today() + p_day) + p_time) at time zone 'Asia/Kathmandu' $$;

-- ---------------------------------------------------------------------------
-- Member excuses (deadline: midnight before the session day)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.notify_absence('20000000-0000-0000-0000-000000000005', 'Work trip') $$,
  'a member can say they cannot come to tomorrow''s session');
select throws_ok($$ select public.notify_absence('20000000-0000-0000-0000-000000000005', null) $$,
  '22023', 'You have already told the team you cannot come.', 'a second notice is refused');
select throws_ok($$ select public.notify_absence('20000000-0000-0000-0000-000000000006', null) $$,
  '22023', 'Absence notices close at midnight before the session day. Contact the admin.',
  'a notice on the session day is too late');
select throws_ok($$ select public.notify_absence('20000000-0000-0000-0000-000000000002', null) $$,
  '22023', 'Choose a scheduled session.', 'a cancelled session cannot be excused');
select lives_ok($$ select public.withdraw_absence('20000000-0000-0000-0000-000000000005') $$,
  'a member can withdraw their notice before the deadline');
select is((select count(*)::int from public.absence_excuses), 0, 'the notice is gone');
select lives_ok($$ select public.notify_absence('20000000-0000-0000-0000-000000000005', 'Work trip') $$,
  'and can give it again');
select throws_ok(
  $$ insert into public.absence_excuses (member_id, session_id, source, created_by) values
     ('00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000001', 'member',
      '00000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'members cannot write excuses directly (e.g. for a past session)');
select throws_ok($$ select note from public.absence_excuses $$,
  '42501', null, 'excuse notes are not readable directly');
select throws_ok($$ select public.admin_excuse_absence('00000000-0000-0000-0000-0000000000b1',
  '20000000-0000-0000-0000-000000000001', 'Was sick') $$,
  '42501', 'Only the admin can do this.', 'a member cannot excuse themselves after the deadline');
reset role;

-- ---------------------------------------------------------------------------
-- Absence fines (pg_cron calls _create_absence_fines(now()))
-- ---------------------------------------------------------------------------
select is(public._create_absence_fines(pg_temp.nepal(0, '12:00')), 2,
  'closed sessions since the start date: S1 fines the admin and Bikash (Asha attended; cancelled, too-old, inactive and open sessions are skipped)');
select is(
  (select array_agg(amount_npr || ':' || status order by amount_npr) from public.fines where reason = 'absence'),
  array['100:pending', '100:pending'], 'each absence fine is NPR 100 and pending');
select is(public._create_absence_fines(pg_temp.nepal(0, '12:00')), 0, 'running again creates nothing');
select is(public._create_absence_fines(pg_temp.nepal(0, '21:00:00')), 0,
  'today''s session is still open at exactly the closing time');
select is(public._create_absence_fines(pg_temp.nepal(0, '21:00:01')), 3,
  'one second after closing, today''s absentees are fined');
select is(public._create_absence_fines(pg_temp.nepal(1, '21:30')), 2,
  'tomorrow: the excused member is not fined');
select is(
  (select count(*)::int from public.fines where member_id = '00000000-0000-0000-0000-0000000000c1'), 0,
  'inactive members are never fined');
select is(
  (select count(*)::int from cron.job where jobname = 'jhusey-absence-fines' and schedule = '*/15 * * * *'), 1,
  'the absence-fine job is scheduled every 15 minutes');

-- ---------------------------------------------------------------------------
-- Admin excuses and recorded attendance
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.admin_excuse_absence('00000000-0000-0000-0000-0000000000b1',
  '20000000-0000-0000-0000-000000000001', 'Was sick, told me by phone') $$,
  'the admin can excuse an absence after the fact');
select is(
  (select status::text from public.fines where member_id = '00000000-0000-0000-0000-0000000000b1'
     and session_id = '20000000-0000-0000-0000-000000000001'), 'waived',
  'excusing waives the pending absence fine');
select is(
  (select reason from public.audit_log where action = 'absence.excused'), 'Was sick, told me by phone',
  'the excuse is in the audit log with its reason');
select throws_ok($$ select public.admin_excuse_absence('00000000-0000-0000-0000-0000000000a1',
  '20000000-0000-0000-0000-000000000001', 'No reason') $$,
  '22023', 'This member punched in for that session; there is no absence to excuse.',
  'a member who attended cannot be excused');
select is(public.admin_record_attendance('00000000-0000-0000-0000-0000000000a1',
  '20000000-0000-0000-0000-000000000006', '19:00', 'Phone died at the court'), 'on_time',
  'recording attendance for a fined absentee works');
select is(
  (select status::text from public.fines where member_id = '00000000-0000-0000-0000-0000000000a1'
     and session_id = '20000000-0000-0000-0000-000000000006' and reason = 'absence'), 'waived',
  'and waives their absence fine');
reset role;

-- ---------------------------------------------------------------------------
-- Team views
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select result, excuse_source::text, excuse_note from public.session_roster('20000000-0000-0000-0000-000000000001')
     where display_name = 'Bikash' $$,
  $$ values ('excused', 'admin', 'Was sick, told me by phone') $$,
  'a member sees their own excuse and its note in the roster');
select results_eq(
  $$ select fine_reason, fine_status::text from public.my_session_history()
     where session_id = '20000000-0000-0000-0000-000000000001' $$,
  $$ values ('absence', 'waived') $$,
  'history shows the waived absence fine');
select is(
  (select result from public.my_session_history() where session_id = '20000000-0000-0000-0000-000000000001'),
  'excused', 'history shows the session as excused');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select result, excuse_note from public.session_roster('20000000-0000-0000-0000-000000000001')
     where display_name in ('Admin', 'Bikash') order by display_name $$,
  $$ values ('absent', null::text), ('excused', null::text) $$,
  'other members see absent/excused, but not the excuse note');
select is(
  (select excused from public.team_report(public.nepal_today() - 10, public.nepal_today())
   where display_name = 'Bikash'), 1, 'the team report counts excused absences');
select is(
  (select absence_fines_npr from public.team_report(public.nepal_today() - 10, public.nepal_today())
   where display_name = 'Admin'), 200, 'the team report totals absence fines');
select is(
  (select sum(absence_fines_npr)::int from public.team_monthly_summary(public.nepal_today() - 10, public.nepal_today())),
  (select sum(absence_fines_npr)::int from public.team_report(public.nepal_today() - 10, public.nepal_today())),
  'monthly totals match the team report');
select is(
  (select sum(excused)::int from public.team_monthly_summary(public.nepal_today() - 10, public.nepal_today())), 1,
  'monthly summary counts the excused absence');
reset role;

-- Payments: the team sees amounts, not notes.
insert into public.payments (id, member_id, amount_npr, method, note, recorded_by) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 100, 'cash', 'Receipt #12',
   '00000000-0000-0000-0000-00000000000a');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select display_name, amount_npr, method, voided from public.team_payments(public.nepal_today() - 1, public.nepal_today()) $$,
  $$ values ('Bikash', 100, 'cash', false) $$,
  'a member sees the team''s payments');
select is((select count(*)::int from public.payments), 0, 'but cannot read payment rows (notes) directly');
select is((select count(*)::int from public.member_private), 1, 'a member reads only their own private row');
select throws_ok($$ select * from public.admin_member_accounts() $$,
  '42501', 'Only the admin can do this.', 'a member cannot list login emails');
select throws_ok($$ select public.update_my_phone('call me') $$,
  '22023', 'Enter a phone number of 7 to 20 digits.', 'a bad phone number is refused');
select lives_ok($$ select public.update_my_phone('+977 9800000000') $$, 'a member sets their phone');
select is((select count(*)::int from public.club_settings), 1, 'members read the club rules');
select throws_ok($$ select public.admin_update_rules('X', '18:00', '19:00', '21:00', 50, 100, public.nepal_today()) $$,
  '42501', 'Only the admin can do this.', 'a member cannot change the rules');
reset role;

-- ---------------------------------------------------------------------------
-- Rules editing
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.admin_member_accounts() where email like '%@test.local'), 4,
  'the admin lists every login email');
select throws_ok($$ select public.admin_update_rules('Jhusey FC', '19:30', '19:15', '21:00', 50, 100, public.nepal_today() - 20) $$,
  '22023', null, 'the window must be in order');
select throws_ok($$ select public.admin_update_rules('Jhusey FC', '18:30', '19:15', '21:00', 50, 100, public.nepal_today() - 21) $$,
  '22023', 'Absence fines cannot start in the past.', 'absence fines cannot be made retroactive');
select lives_ok($$ select public.admin_update_rules('Jhusey FC', '18:00', '19:30', '21:00', 75, 150, public.nepal_today() - 20) $$,
  'the admin changes the window, cutoff and fines');
select is((select count(*)::int from public.audit_log where action = 'rules.updated'), 1, 'the rule change is audited');
reset role;

select is(public.attendance_status_for(pg_temp.nepal(3, '19:30:00'), public.nepal_today() + 3), 'on_time',
  'the new cutoff decides On Time');
select is(public.attendance_status_for(pg_temp.nepal(3, '19:30:01'), public.nepal_today() + 3), 'late',
  'one second after the new cutoff is Late');
select throws_ok($$ select public._punch_in('00000000-0000-0000-0000-0000000000b1', pg_temp.nepal(3, '17:59:59'),
  27.7202, 85.3408, 10) $$, '22023', 'Punch-in opens at 6:00 PM.', 'the opening message uses the new time');
select is(
  (select public._punch_in('00000000-0000-0000-0000-0000000000b1', pg_temp.nepal(3, '19:40'),
    27.7202, 85.3408, 10) ->> 'fine_npr'), '75', 'a late punch-in uses the new late fine');
select is(
  (select amount_npr from public.fines where member_id = '00000000-0000-0000-0000-0000000000a1'
     and session_id = '20000000-0000-0000-0000-000000000006' and reason = 'absence'), 100,
  'fines created before the change keep their amount');

set local role anon;
select throws_ok($$ select * from public.session_roster('20000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'anon cannot read the roster');
reset role;

select * from finish();
rollback;
