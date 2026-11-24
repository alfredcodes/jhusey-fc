-- Admin reports and exports.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

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

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', '{"display_name":"Asha"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', '{"display_name":"=HYPERLINK(1)"}');
update public.profiles set created_at = now() - interval '30 days';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);
insert into public.sessions (id, session_date, venue_id, status) values
  ('20000000-0000-0000-0000-000000000010', public.nepal_today() - 10, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000009', public.nepal_today() - 9,  '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000008', public.nepal_today() - 8,  '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000007', public.nepal_today() - 7,  '10000000-0000-0000-0000-000000000001', 'cancelled'),
  ('20000000-0000-0000-0000-000000000050', public.nepal_today() - 50, '10000000-0000-0000-0000-000000000001', 'scheduled');

create function pg_temp.att(p_member uuid, p_session uuid, p_status public.attendance_status) returns uuid
language sql as $$
  insert into public.attendance (member_id, session_id, venue_id, punched_in_at, status, latitude, longitude,
    accuracy_m, distance_m, venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m)
  values (p_member, p_session, '10000000-0000-0000-0000-000000000001', now(), p_status,
    27.7202, 85.3408, 12, 40, 27.7198624, 85.3407743, 100, 50)
  returning id;
$$;

-- Asha: on time (-10), late (-9, fine paid), absent (-8). Member B: late (-10, fine pending), late (-9, fine waived).
select pg_temp.att('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000010', 'on_time');
insert into public.fines (id, member_id, attendance_id, reason, amount_npr) values
  ('40000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000a1',
   pg_temp.att('00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000009', 'late'), 'late', 50),
  ('40000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000b1',
   pg_temp.att('00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000010', 'late'), 'late', 50),
  ('40000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000b1',
   pg_temp.att('00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000009', 'late'), 'late', 50);
insert into public.payments (id, member_id, amount_npr, method, recorded_by) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 50, 'cash',
   '00000000-0000-0000-0000-00000000000a');
update public.fines set status = 'paid', payment_id = '50000000-0000-0000-0000-000000000001'
  where id = '40000000-0000-0000-0000-0000000000a9';
update public.fines set status = 'waived' where id = '40000000-0000-0000-0000-0000000000b9';

-- ---------------------------------------------------------------------------
-- Member: denied everything
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
-- Team transparency: every active member reads the team report; GPS and payment exports stay admin-only.
select is(
  (select count(*)::int from public.team_report(public.nepal_today() - 14, public.nepal_today())),
  (select count(*)::int from public.profiles where is_active),
  'a member reads the whole team report');
select throws_ok($$ select * from public.admin_export_attendance(public.nepal_today() - 14, public.nepal_today()) $$,
  '42501', 'Only the admin can do this.', 'a member cannot export everyone''s GPS');
select throws_ok($$ select * from public.admin_export_payments(public.nepal_today() - 14, public.nepal_today()) $$,
  '42501', 'Only the admin can do this.', 'a member cannot export payments');
reset role;

set local role anon;
select throws_ok($$ select * from public.admin_export_fines(current_date, current_date) $$,
  '42501', null, 'anon cannot export');
reset role;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select display_name, sessions, on_time, late, absent, attendance_percent
     from public.team_report(public.nepal_today() - 14, public.nepal_today())
     where display_name = 'Asha' $$,
  $$ values ('Asha', 3, 1, 1, 1, 67) $$,
  'Asha: 3 sessions (cancelled and out-of-range excluded), 1 on time, 1 late, 1 absent, 67% (late still counts as attended)');

select results_eq(
  $$ select fines_npr, fines_paid_npr, fines_waived_npr, fines_outstanding_npr
     from public.team_report(public.nepal_today() - 14, public.nepal_today())
     where display_name = 'Asha' $$,
  $$ values (50, 50, 0, 0) $$,
  'Asha''s fine is assigned and paid');

select results_eq(
  $$ select fines_npr, fines_paid_npr, fines_waived_npr, fines_outstanding_npr
     from public.team_report(public.nepal_today() - 14, public.nepal_today())
     where member_id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values (50, 0, 50, 50) $$,
  'waived fines are reported separately and not counted as assigned');

select is(
  (select attendance_percent from public.team_report(public.nepal_today() - 14, public.nepal_today())
   where display_name = 'Admin'),
  0, 'a member with sessions but no punch-ins is at 0%');

select is(
  (select sessions from public.team_report(public.nepal_today() - 60, public.nepal_today() - 40)
   where display_name = 'Asha'),
  0, 'a session before the member joined is not counted');

select throws_ok($$ select * from public.team_report(public.nepal_today(), public.nepal_today() - 1) $$,
  '22023', 'Choose a valid date range.', 'an inverted range is refused');
select throws_ok($$ select * from public.team_report(public.nepal_today() - 400, public.nepal_today()) $$,
  '22023', 'Choose a range of at most one year.', 'ranges are limited to one year');

select results_eq(
  $$ select count(*)::int, count(latitude)::int from public.admin_export_attendance(public.nepal_today() - 14, public.nepal_today()) $$,
  $$ values (4, 4) $$,
  'the attendance export has every punch-in with its GPS evidence');

select results_eq(
  $$ select status, payment_id from public.admin_export_fines(public.nepal_today() - 14, public.nepal_today())
     where member = 'Asha' $$,
  $$ values ('paid', '50000000-0000-0000-0000-000000000001'::uuid) $$,
  'the fines export links each paid fine to its payment');

select results_eq(
  $$ select member, amount_npr, method, fines_count from public.admin_export_payments(public.nepal_today(), public.nepal_today()) $$,
  $$ values ('Asha', 50, 'cash', 1) $$,
  'the payments export lists payments by the Nepal date they were recorded');

reset role;

select * from finish();
rollback;
