-- Admin corrections, manual attendance, waivers, payments, member management, audit log.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(40);

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
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', '{"display_name":"Asha"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', '{"display_name":"Bikash"}');
update public.profiles set created_at = now() - interval '10 days';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);
insert into public.sessions (id, session_date, venue_id) values
  ('20000000-0000-0000-0000-000000000003', public.nepal_today() - 3, '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', public.nepal_today() - 2, '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000099', public.nepal_today() + 2, '10000000-0000-0000-0000-000000000001');

-- A was late by GPS three days ago (with fine); B was on time.
insert into public.attendance (id, member_id, session_id, venue_id, punched_in_at, status, latitude, longitude,
  accuracy_m, distance_m, venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m) values
  ('30000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000001', now() - interval '3 days', 'late', 27.7202, 85.3408, 12, 40, 27.7198624, 85.3407743, 100, 50),
  ('30000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000001', now() - interval '3 days', 'on_time', 27.7202, 85.3408, 12, 40, 27.7198624, 85.3407743, 100, 50);
insert into public.fines (id, member_id, attendance_id, reason, amount_npr) values
  ('40000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3', 'late', 50);

-- Owner-level guarantees (no role switch)
select is((select original_status::text from public.attendance where id = '30000000-0000-0000-0000-0000000000a3'),
  'late', 'original_status is filled in automatically on insert');

select throws_ok(
  $$ update public.attendance set punched_in_at = now() where id = '30000000-0000-0000-0000-0000000000a3' $$,
  '42501', 'Attendance evidence cannot be changed.', 'even the database owner cannot change a punch-in time');

select throws_ok(
  $$ update public.attendance set latitude = 0 where id = '30000000-0000-0000-0000-0000000000a3' $$,
  '42501', 'Attendance evidence cannot be changed.', 'GPS evidence cannot be changed');

select throws_ok(
  $$ update public.fines set status = 'paid' where id = '40000000-0000-0000-0000-0000000000a3' $$,
  '23514', null, 'a fine cannot be marked paid without a payment record');

-- ---------------------------------------------------------------------------
-- A member cannot use any admin operation
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.admin_correct_attendance('30000000-0000-0000-0000-0000000000a3', 'on_time', 'please') $$,
  '42501', 'Only the admin can do this.', 'a member cannot correct their own attendance');
select throws_ok($$ select public.admin_waive_fine('40000000-0000-0000-0000-0000000000a3', 'please') $$,
  '42501', 'Only the admin can do this.', 'a member cannot waive their own fine');
select throws_ok($$ select public.admin_record_payment('00000000-0000-0000-0000-0000000000a1',
  array['40000000-0000-0000-0000-0000000000a3']::uuid[], 'cash', null) $$,
  '42501', 'Only the admin can do this.', 'a member cannot mark their own fine paid');
select throws_ok($$ select public.admin_update_member('00000000-0000-0000-0000-0000000000a1', 'Asha', true) $$,
  '42501', 'Only the admin can do this.', 'a member cannot use member management');
select throws_ok($$ select public.write_audit('x', 'x', gen_random_uuid(), null, null) $$,
  '42501', null, 'a member cannot write to the audit log');
reset role;

-- ---------------------------------------------------------------------------
-- Admin: corrections
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.admin_correct_attendance('30000000-0000-0000-0000-0000000000a3', 'on_time', '') $$,
  '22023', 'Give a reason (at least 3 characters).', 'a correction needs a reason');

select lives_ok($$ select public.admin_correct_attendance('30000000-0000-0000-0000-0000000000a3', 'on_time',
  'Gate was locked; arrived 7:10') $$, 'the admin corrects Late to On Time with a reason');

select results_eq(
  $$ select status::text, original_status::text, latitude, distance_m
     from public.attendance where id = '30000000-0000-0000-0000-0000000000a3' $$,
  $$ values ('on_time', 'late', 27.7202::float8, 40::float8) $$,
  'the status changes; the original status and GPS evidence are kept');

select is((select status::text from public.fines where id = '40000000-0000-0000-0000-0000000000a3'),
  'waived', 'the late fine is waived by the correction');

select results_eq(
  $$ select action, reason, actor_id, details ->> 'from', details ->> 'to', details ->> 'fine'
     from public.audit_log where action = 'attendance.corrected' $$,
  $$ values ('attendance.corrected', 'Gate was locked; arrived 7:10', '00000000-0000-0000-0000-00000000000a'::uuid,
             'late', 'on_time', 'waived') $$,
  'the correction is in the audit log with who, what and why');

select lives_ok($$ select public.admin_correct_attendance('30000000-0000-0000-0000-0000000000a3', 'late',
  'Checked again: was late') $$, 'the admin can correct back to Late');
select is((select status::text from public.fines where id = '40000000-0000-0000-0000-0000000000a3'),
  'pending', 'correcting back to Late reinstates the same fine');

select lives_ok($$ select public.admin_correct_attendance('30000000-0000-0000-0000-0000000000b3', 'late',
  'Arrived after the warm-up') $$, 'correcting On Time to Late');
select is((select amount_npr from public.fines where attendance_id = '30000000-0000-0000-0000-0000000000b3'),
  50, 'On Time to Late creates an NPR 50 fine');

-- ---------------------------------------------------------------------------
-- Admin: manual attendance
-- ---------------------------------------------------------------------------
select is(public.admin_record_attendance('00000000-0000-0000-0000-0000000000a1',
  '20000000-0000-0000-0000-000000000002', '19:20', 'Phone battery died'), 'late'::public.attendance_status,
  'manual attendance at 7:20 PM is Late');

select results_eq(
  $$ select a.source::text, a.latitude, a.recorded_by, a.manual_reason, f.amount_npr
     from public.attendance a left join public.fines f on f.attendance_id = a.id
     where a.session_id = '20000000-0000-0000-0000-000000000002'
       and a.member_id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('admin', null::float8, '00000000-0000-0000-0000-00000000000a'::uuid, 'Phone battery died', 50) $$,
  'it is marked as admin-recorded, has no GPS, records the reason, and creates the fine');

select is(public.admin_record_attendance('00000000-0000-0000-0000-0000000000b1',
  '20000000-0000-0000-0000-000000000002', '19:15', 'Phone battery died'), 'on_time'::public.attendance_status,
  'manual attendance at exactly 7:15 PM is On Time');

select throws_like($$ select public.admin_record_attendance('00000000-0000-0000-0000-0000000000a1',
  '20000000-0000-0000-0000-000000000002', '19:00', 'again') $$,
  'This member already has attendance%', 'manual attendance cannot duplicate a record');

select throws_ok($$ select public.admin_record_attendance('00000000-0000-0000-0000-0000000000a1',
  '20000000-0000-0000-0000-000000000099', '19:00', 'early') $$,
  '22023', 'Attendance cannot be recorded for a future session.', 'manual attendance cannot be for the future');

-- ---------------------------------------------------------------------------
-- Admin: waivers and payments
-- ---------------------------------------------------------------------------
create temp table ids as select
  (select f.id from public.fines f join public.attendance a on a.id = f.attendance_id
   where a.session_id = '20000000-0000-0000-0000-000000000002' and f.member_id = '00000000-0000-0000-0000-0000000000a1') as manual_fine;
grant select on ids to authenticated;

select lives_ok($$ select public.admin_waive_fine((select manual_fine from ids), 'First time, phone died') $$,
  'the admin waives a pending fine with a reason');
select throws_ok($$ select public.admin_waive_fine((select manual_fine from ids), 'again') $$,
  '22023', 'Only a pending fine can be waived.', 'a waived fine cannot be waived again');

select throws_ok($$ select public.admin_record_payment('00000000-0000-0000-0000-0000000000a1',
  array['40000000-0000-0000-0000-0000000000a3', (select manual_fine from ids)]::uuid[], 'cash', null) $$,
  '22023', 'Every selected fine must be pending and belong to this member.',
  'a payment cannot include a waived fine');

select throws_ok($$ select public.admin_record_payment('00000000-0000-0000-0000-0000000000b1',
  array['40000000-0000-0000-0000-0000000000a3']::uuid[], 'cash', null) $$,
  '22023', 'Every selected fine must be pending and belong to this member.',
  'a payment cannot take another member''s fine');

select throws_ok($$ select public.admin_record_payment('00000000-0000-0000-0000-0000000000a1',
  array['40000000-0000-0000-0000-0000000000a3']::uuid[], 'crypto', null) $$,
  '22023', null, 'an unknown payment method is refused');

select lives_ok($$ select public.admin_record_payment('00000000-0000-0000-0000-0000000000a1',
  array['40000000-0000-0000-0000-0000000000a3']::uuid[], 'cash', 'Paid at training') $$,
  'the admin records a cash payment');

select results_eq(
  $$ select p.amount_npr, f.status::text from public.payments p join public.fines f on f.payment_id = p.id $$,
  $$ values (50, 'paid') $$,
  'the payment amount is the fines'' total and the fine is now paid');

select throws_like($$ select public.admin_correct_attendance('30000000-0000-0000-0000-0000000000a3', 'on_time',
  'too late now') $$, 'The late fine is already paid.%', 'a paid fine blocks a correction to On Time');

select lives_ok($$ select public.admin_void_payment((select id from public.payments), 'Recorded for wrong member') $$,
  'the admin voids a mistaken payment with a reason');

select results_eq(
  $$ select p.voided_at is not null, f.status::text, f.payment_id
     from public.payments p, public.fines f where f.id = '40000000-0000-0000-0000-0000000000a3' $$,
  $$ values (true, 'pending', null::uuid) $$,
  'the payment is kept but marked void, and its fine is pending again');

select throws_ok($$ select public.admin_void_payment((select id from public.payments), 'again') $$,
  '22023', 'Only an active payment can be voided.', 'a voided payment cannot be voided twice');

-- ---------------------------------------------------------------------------
-- Admin: members
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.admin_update_member('00000000-0000-0000-0000-00000000000a', 'Admin', false) $$,
  '22023', 'You cannot deactivate your own admin account.', 'the admin cannot lock themselves out');

select lives_ok($$ select public.admin_update_member('00000000-0000-0000-0000-0000000000b1', 'Bikash T.', false) $$,
  'the admin renames and deactivates a member');

select is((select count(*)::int from public.audit_log), 9,
  'every admin action above wrote one audit entry');

reset role;

-- ---------------------------------------------------------------------------
-- What members see
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.audit_log), 0, 'a member cannot read the audit log');
select is((select count(*)::int from public.payments), 1, 'a member sees their own payment records');

select results_eq(
  $$ select result, original_status::text, source::text from public.my_session_history() $$,
  $$ values ('late', 'late', 'admin'), ('late', 'late', 'gps') $$,
  'member history shows admin-recorded and corrected records');

reset role;

select * from finish();
rollback;
