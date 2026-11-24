-- Member payment submissions: ownership, duplicates, proofs, admin approval and privacy.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

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
delete from public.game_commitments;
delete from public.member_inactive_periods;
delete from auth.users;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', '{"display_name":"Asha"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', '{"display_name":"Bikash"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- November is open: everyone owes NPR 800.
insert into public.fee_periods (month, opened_on, due_days, opened_by)
values ('2026-11-01', '2026-11-01', 16, '00000000-0000-0000-0000-00000000000a');
insert into public.member_fees (id, month, member_id, plan, amount_npr) values
  ('50000000-0000-0000-0000-0000000000a1', '2026-11-01', '00000000-0000-0000-0000-0000000000a1', 'regular', 800),
  ('50000000-0000-0000-0000-0000000000b1', '2026-11-01', '00000000-0000-0000-0000-0000000000b1', 'regular', 800);

-- Proof files as the storage API would store them (one in each member's own folder).
insert into storage.objects (bucket_id, name) values
  ('payment-proofs', '00000000-0000-0000-0000-0000000000a1/nov.png'),
  ('payment-proofs', '00000000-0000-0000-0000-0000000000b1/nov.png');

select ok((select not public and file_size_limit = 2097152 from storage.buckets where id = 'payment-proofs'),
  'the proof bucket is private and limited to 2 MB');

-- ---------------------------------------------------------------------------
-- Asha submits
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000b1', 800, 'cash', null) $$,
  '22023', 'Choose one of your own monthly fees.', 'a member cannot submit for someone else''s fee');
select throws_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000a1', 900, 'cash', null) $$,
  '22023', 'Enter an amount between NPR 1 and NPR 800 (your balance).', 'a submission cannot exceed the balance');
select throws_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000a1', 800, 'wallet', null) $$,
  '22023', 'Attach a screenshot or receipt of the payment.', 'an online payment needs a proof');
select throws_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000a1', 800, 'wallet',
    '00000000-0000-0000-0000-0000000000b1/nov.png') $$,
  '22023', 'Upload the receipt again, then submit.', 'a member cannot use someone else''s file as proof');
select throws_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000a1', 800, 'wallet',
    '00000000-0000-0000-0000-0000000000a1/missing.png') $$,
  '22023', 'Upload the receipt again, then submit.', 'the proof must exist in storage');

select lives_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000a1', 300, 'cash', null) $$,
  'Asha says she paid NPR 300 in cash');
select throws_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000a1', 500, 'cash', null) $$,
  '22023', 'You already have a payment waiting for approval for this month.', 'no duplicate pending submission');
select is((select status from public.fee_submissions), 'pending', 'the submission waits for the admin');
select is((select paid_npr from public.fee_ledger('2026-11-01') where display_name = 'Asha'), 0,
  'nothing counts as paid before approval');
select throws_ok($$ select public.admin_review_fee_submission((select id from public.fee_submissions), true, null) $$,
  '42501', 'Only the admin can do this.', 'a member cannot approve their own submission');
select throws_ok($$ insert into public.fee_submissions (member_fee_id, member_id, amount_npr, method)
    values ('50000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 800, 'cash') $$,
  '42501', null, 'members cannot write submissions directly');
select is((select count(*)::integer from storage.objects where bucket_id = 'payment-proofs'), 1,
  'a member sees only their own proof files');
reset role;

-- Bikash cannot see Asha's submission.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.fee_submissions), 0, 'teammates do not see other submissions');
select lives_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000b1', 800, 'bank_transfer',
    '00000000-0000-0000-0000-0000000000b1/nov.png') $$, 'Bikash submits a bank transfer with his receipt');
reset role;

-- ---------------------------------------------------------------------------
-- The admin reviews
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::integer from public.fee_submissions where status = 'pending'), 2,
  'the admin sees every pending submission');
select is((select count(*)::integer from storage.objects where bucket_id = 'payment-proofs'
    and name like '00000000-0000-0000-0000-0000000000%'), 2,
  'the admin can open every proof');
select lives_ok($$ select public.admin_review_fee_submission(
    (select id from public.fee_submissions where member_id = '00000000-0000-0000-0000-0000000000a1'), true, null) $$,
  'the admin approves Asha''s cash payment');
select is((select paid_npr from public.fee_ledger('2026-11-01') where display_name = 'Asha'), 300,
  'approval records the payment');
select ok((select fee_payment_id is not null and status = 'approved' from public.fee_submissions
  where member_id = '00000000-0000-0000-0000-0000000000a1'), 'the submission links to its payment');
select throws_ok($$ select public.admin_review_fee_submission(
    (select id from public.fee_submissions where member_id = '00000000-0000-0000-0000-0000000000b1'), false, '') $$,
  '22023', 'Give a reason (at least 3 characters).', 'a rejection needs a reason');
select lives_ok($$ select public.admin_review_fee_submission(
    (select id from public.fee_submissions where member_id = '00000000-0000-0000-0000-0000000000b1'), false,
    'Receipt shows a different amount') $$, 'the admin rejects Bikash''s submission');
select is((select paid_npr from public.fee_ledger('2026-11-01') where display_name = 'Bikash'), 0,
  'a rejected submission pays nothing');
reset role;

-- After review, the member may submit again (e.g. Asha's remaining NPR 500).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.submit_fee_payment('50000000-0000-0000-0000-0000000000a1', 500, 'cash', null) $$,
  'after approval the member can submit the rest');
select is((select review_note from public.fee_submissions where status = 'rejected'), null::text,
  'a member never sees another member''s rejection reason');
reset role;

select * from finish();
rollback;
