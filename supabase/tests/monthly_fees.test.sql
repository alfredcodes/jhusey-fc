-- Monthly fees: plans, opening a month, instalments, exemptions, voids and access.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(47);

delete from public.audit_log;
delete from public.fee_submissions;
delete from public.fee_payments;
delete from public.member_fees;
delete from public.fee_periods;
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
delete from public.member_inactive_periods;
delete from auth.users;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', '{"display_name":"Asha"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', '{"display_name":"Bikash"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.local', '{"display_name":"Chirag"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000c1';
-- Known settings for the test (the real row is restored by the rollback).
update public.club_settings
set regular_fee_npr = 800, partial_fee_npr = 400, fee_due_days = 16, fine_due_days = null
where id;

-- ---------------------------------------------------------------------------
-- Members cannot write anything
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.admin_open_fee_month('2026-11-01', '2026-11-01') $$,
  '42501', 'Only the admin can do this.', 'a member cannot open a fee month');
select throws_ok($$ select public.admin_set_fee_plan('00000000-0000-0000-0000-0000000000a1', 'partial') $$,
  '42501', 'Only the admin can do this.', 'a member cannot change their own plan');
select throws_ok($$ select public.admin_update_payment_settings(1, 1, 1, 1) $$,
  '42501', 'Only the admin can do this.', 'a member cannot change fee amounts or deadlines');
select throws_ok($$ update public.profiles set fee_plan = 'partial' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'a member cannot update their plan directly');
select throws_ok($$ insert into public.fee_periods (month, opened_on, opened_by)
  values ('2026-11-01', '2026-11-01', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'a member cannot insert a fee month');
select throws_ok($$ select public.admin_fee_payment_notes('2026-11-01') $$,
  '42501', 'Only the admin can do this.', 'a member cannot read payment notes');
reset role;

set local role anon;
select throws_ok($$ select * from public.fee_ledger('2026-11-01') $$,
  '42501', null, 'anonymous users cannot read the ledger');
reset role;

-- ---------------------------------------------------------------------------
-- Admin: plans, amounts, opening a month
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.admin_set_fee_plan('00000000-0000-0000-0000-0000000000b1', 'partial') $$,
  'the admin puts Bikash on the partial plan');
select throws_ok($$ select public.admin_update_payment_settings(0, 400, 16, null) $$,
  '22023', 'Fees must be NPR 1 to 100,000 and deadlines 1 to 90 days.', 'fee amounts are validated');
select throws_ok($$ select public.admin_update_payment_settings(800, 400, 0, null) $$,
  '22023', 'Fees must be NPR 1 to 100,000 and deadlines 1 to 90 days.', 'deadlines are validated');

select is(public.admin_open_fee_month('2026-11-15', '2026-11-05'), 3,
  'opening a month creates one fee per ACTIVE member (inactive Chirag excluded)');
select is((select due_on from public.fee_periods where month = '2026-11-01'), '2026-11-21'::date,
  'the month is stored as its first day and is due 16 days after opening');
select is((select amount_npr from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000b1'),
  400, 'a partial member gets the partial amount');
select is((select amount_npr from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'),
  800, 'a regular member gets the regular amount');

select is(public.admin_open_fee_month('2026-11-01', '2026-11-05'), 0,
  'opening the same month again charges nobody twice');
select throws_ok($$ select public.admin_open_fee_month('2026-11-01', '2026-11-09') $$,
  '22023', null, 'a different open date for an opened month is refused');

select lives_ok($$ select public.admin_update_payment_settings(1000, 500, 10, 7) $$,
  'the admin raises fee amounts and sets deadlines (fees 10 days, fines 7 days)');
select is((select due_on from public.fee_periods where month = '2026-11-01'), '2026-11-21'::date,
  'an open month keeps the deadline it was opened with');
select is((select amount_npr from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'),
  800, 'raising the amount does not change existing fees');

reset role;
update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;
select is(public.admin_open_fee_month('2026-11-01', '2026-11-05'), 1,
  're-running open adds a member who became active, at the new amount');
select is((select amount_npr from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000c1'),
  1000, 'the late joiner gets the current regular amount');

-- ---------------------------------------------------------------------------
-- Payments in instalments
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.admin_record_fee_payment(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'),
    900, 'cash', public.nepal_today(), null) $$,
  '22023', 'Enter an amount between NPR 1 and NPR 800 (the balance).', 'a payment cannot exceed the balance');
select throws_ok($$ select public.admin_record_fee_payment(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'),
    100, 'cash', public.nepal_today() + 1, null) $$,
  '22023', 'The payment date cannot be in the future.', 'a payment date cannot be in the future');
select lives_ok($$ select public.admin_record_fee_payment(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'),
    300, 'cash', public.nepal_today(), 'first half-ish') $$, 'the admin records an instalment');
select lives_ok($$ select public.admin_record_fee_payment(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'),
    500, 'wallet', public.nepal_today(), null) $$, 'the admin records the rest');
select is((select status from public.fee_ledger('2026-11-01') where display_name = 'Asha'), 'paid',
  'two instalments that add up to the fee mark it paid');
select throws_ok($$ select public.admin_record_fee_payment(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'),
    1, 'cash', public.nepal_today(), null) $$,
  '22023', 'This fee is already paid in full.', 'a paid fee takes no more payments');
select throws_ok($$ select public.admin_adjust_member_fee(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'), 700, 'wrong plan') $$,
  '22023', null, 'a fee cannot be adjusted below what is already paid');

select lives_ok($$ select public.admin_void_fee_payment(
    (select id from public.fee_payments where amount_npr = 500), 'Recorded twice') $$, 'the admin voids a payment');
select is((select paid_npr from public.fee_ledger('2026-11-01') where display_name = 'Asha'), 300,
  'a voided payment no longer counts');
select is((select count(*)::integer from public.fee_payments), 2, 'the voided payment is kept, not deleted');

-- ---------------------------------------------------------------------------
-- Exemptions and open-date changes
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.admin_exempt_fee(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000a1'), 'Injured') $$,
  '22023', 'This fee has payments. Void them before exempting the member.', 'a fee with payments cannot be exempted');
select throws_ok($$ select public.admin_exempt_fee(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000b1'), '') $$,
  '22023', 'Give a reason (at least 3 characters).', 'an exemption needs a reason');
select lives_ok($$ select public.admin_exempt_fee(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000b1'), 'Injured knee') $$,
  'the admin exempts Bikash for the month');
select throws_ok($$ select public.admin_record_fee_payment(
    (select id from public.member_fees where member_id = '00000000-0000-0000-0000-0000000000b1'),
    100, 'cash', public.nepal_today(), null) $$,
  '22023', 'This member is exempt for this month.', 'an exempt fee takes no payments');
select lives_ok($$ select public.admin_change_fee_open_date('2026-11-01', '2026-11-10', 'Opened late') $$,
  'the admin changes the open date with a reason');
select is((select due_on from public.fee_periods where month = '2026-11-01'), '2026-11-26'::date,
  'the due date follows the open date');
select ok((select count(*) from public.audit_log where action like 'fee%') >= 8, 'every fee action is audited');
reset role;

-- ---------------------------------------------------------------------------
-- Team transparency: members read the ledger and the exemption reason, not notes
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::integer from public.fee_ledger('2026-11-01')), 4,
  'a member sees the whole team''s fees');
select is((select exempt_reason from public.fee_ledger('2026-11-01') where display_name = 'Bikash'), 'Injured knee',
  'a member sees why a teammate is exempt');
select is((select count(*)::integer from public.fee_payments), 2, 'a member reads the team''s fee payments');
select throws_ok($$ select note from public.fee_payments $$,
  '42501', null, 'a member cannot read payment notes');
reset role;

-- The API runs with pg-safeupdate, which rejects UPDATE without WHERE (it cannot be loaded here).
select is(
  (select count(*)::integer from pg_proc
   where proname in ('admin_update_rules', 'admin_update_payment_settings')
     and prosrc ~* 'update public[.]club_settings[^;]*[[:space:]]where id[[:space:];]'),
  2, 'settings updates have a WHERE clause (pg-safeupdate refuses them otherwise)');

-- A month opened after the deadline change (admin again; fee_due_days is now 10).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is(public.admin_open_fee_month('2026-12-01', '2026-12-01'), 4, 'the admin opens December');
select is((select due_on from public.fee_periods where month = '2026-12-01'), '2026-12-11'::date,
  'a month opened after the change uses the new number of days');
reset role;

-- ---------------------------------------------------------------------------
-- Fine deadlines (set when the fine is created; fine_due_days is now 7)
-- ---------------------------------------------------------------------------
insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);
insert into public.sessions (id, session_date, venue_id) values
  ('20000000-0000-0000-0000-000000000001', '2026-11-20', '10000000-0000-0000-0000-000000000001');
insert into public.fines (id, member_id, session_id, reason, amount_npr, created_at) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
   '20000000-0000-0000-0000-000000000001', 'absence', 100, '2026-11-20 15:30:00+00');
select is((select due_on from public.fines where id = '40000000-0000-0000-0000-000000000001'), '2026-11-27'::date,
  'a new fine is due 7 days after the Nepal date it was given');
update public.club_settings set fine_due_days = null where id;
insert into public.fines (id, member_id, session_id, reason, amount_npr) values
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1',
   '20000000-0000-0000-0000-000000000001', 'absence', 100);
select is((select due_on from public.fines where id = '40000000-0000-0000-0000-000000000002'), null::date,
  'with no fine deadline set, a fine has no due date');

select * from finish();
rollback;
