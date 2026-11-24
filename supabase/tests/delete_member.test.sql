-- Deleting a member keeps all history; admins may delete each other but not themselves.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(17);

delete from public.audit_log;
delete from public.fines;
delete from public.payments;
delete from public.absence_excuses;
delete from public.attendance;
delete from public.game_commitments;
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
update public.profiles set created_at = now() - interval '60 days';
update public.profiles set role = 'admin'
where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
update public.member_private set phone = '9800000000' where member_id = '00000000-0000-0000-0000-0000000000c1';

-- Chandra's history: a late punch-in with a paid fine, an unpaid absence fine, a fee payment, a notice.
insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);
insert into public.sessions (id, session_date, venue_id, status) values
  ('20000000-0000-0000-0000-000000000001', public.nepal_today() - 10, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000002', public.nepal_today() - 5,  '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000003', public.nepal_today() + 3,  '10000000-0000-0000-0000-000000000001', 'scheduled');
insert into public.attendance (id, member_id, session_id, venue_id, punched_in_at, status, latitude, longitude,
  accuracy_m, distance_m, venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1',
  '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  ((public.nepal_today() - 10) + time '19:20') at time zone 'Asia/Kathmandu', 'late',
  27.7199, 85.3408, 10, 15, 27.7198624, 85.3407743, 100, 50);
insert into public.payments (id, member_id, amount_npr, method, recorded_by) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 50, 'cash',
   '00000000-0000-0000-0000-00000000000a');
insert into public.fines (member_id, attendance_id, session_id, reason, amount_npr, status, payment_id) values
  ('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'late', 50, 'paid', '40000000-0000-0000-0000-000000000001');
insert into public.fines (member_id, session_id, reason, amount_npr) values
  ('00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000002', 'absence', 100);
insert into public.fee_periods (month, opened_on, opened_by, due_days)
  values (date_trunc('month', public.nepal_today())::date, public.nepal_today() - 3, '00000000-0000-0000-0000-00000000000a', 16);
insert into public.member_fees (id, month, member_id, plan, amount_npr) values
  ('50000000-0000-0000-0000-000000000001', date_trunc('month', public.nepal_today())::date,
   '00000000-0000-0000-0000-0000000000c1', 'regular', 800);
insert into public.fee_payments (member_fee_id, amount_npr, method, paid_on, recorded_by) values
  ('50000000-0000-0000-0000-000000000001', 400, 'cash', public.nepal_today() - 1, '00000000-0000-0000-0000-00000000000a');

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.history(p_id uuid) returns text language sql as $$
  select concat_ws(',',
    (select count(*) from public.attendance where member_id = p_id),
    (select count(*) from public.fines where member_id = p_id),
    (select count(*) from public.payments where member_id = p_id),
    (select count(*) from public.member_fees where member_id = p_id),
    (select count(*) from public.fee_payments fp join public.member_fees mf on mf.id = fp.member_fee_id
      where mf.member_id = p_id))
$$;
select is(pg_temp.history('00000000-0000-0000-0000-0000000000c1'), '1,2,1,1,1', 'Chandra has history before');

-- A member cannot delete anyone.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
set local role authenticated;
select throws_ok($$ select public.admin_delete_member('00000000-0000-0000-0000-0000000000c1', 'left the team') $$,
  '42501', 'Only the admin can do this.', 'a member cannot delete anyone');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok($$ select public.admin_delete_member('00000000-0000-0000-0000-00000000000a', 'testing self') $$,
  '22023', 'You cannot delete your own account.', 'an admin cannot delete themselves');
select throws_ok($$ select public.admin_delete_member('00000000-0000-0000-0000-0000000000c1', 'x') $$,
  '22023', 'Give a reason (3 to 300 characters).', 'a reason is required');
select lives_ok($$ select public.admin_delete_member('00000000-0000-0000-0000-0000000000c1', 'Left the team') $$,
  'the admin deletes a member');
select throws_ok($$ select public.admin_delete_member('00000000-0000-0000-0000-0000000000c1', 'Left the team') $$,
  '22023', 'This member is already deleted.', 'deleting twice is refused');
select throws_ok($$ select public.admin_update_member('00000000-0000-0000-0000-0000000000c1', 'Chandra', true) $$,
  '22023', 'This member was deleted. Their history is kept, but the account cannot be changed.',
  'a deleted member cannot be reactivated by mistake');
reset role;

select is((select row(is_active, role::text, deleted_by) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  row(false, 'member'::text, '00000000-0000-0000-0000-00000000000a'::uuid), 'the account is inactive and marked deleted by the admin');
select ok((select deleted_at is not null from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'the deletion time is stored');
select is(pg_temp.history('00000000-0000-0000-0000-0000000000c1'), '1,2,1,1,1',
  'all history is kept: punch-in, fines, payment, monthly fee and fee payment');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 'Chandra',
  'the name stays for old records');
select is((select phone from public.member_private where member_id = '00000000-0000-0000-0000-0000000000c1'), null,
  'the phone number is cleared');
select is((select count(*)::int from public.member_inactive_periods
  where member_id = '00000000-0000-0000-0000-0000000000c1' and to_date is null), 1,
  'no games are counted for them from today (no absences or absence fines)');
select is((select reason from public.audit_log where action = 'member.deleted'
  and entity_id = '00000000-0000-0000-0000-0000000000c1'), 'Left the team', 'the deletion is in the audit log with its reason');

-- Admins may delete each other; the slot is freed.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select lives_ok($$ select public.admin_delete_member('00000000-0000-0000-0000-00000000000b', 'Stepped down') $$,
  'an admin can delete the other admin');
reset role;
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'member',
  'a deleted admin loses the admin role');
select lives_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'which frees the second admin slot');

select * from finish();
rollback;
