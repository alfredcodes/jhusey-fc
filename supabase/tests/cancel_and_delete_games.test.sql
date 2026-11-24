-- Cancelling a game waives its unpaid absence fines; a game created by mistake can be deleted
-- with its automatic absence fines, unless someone punched in or a fine was paid.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

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

update public.club_settings
set punch_open = '18:30', on_time_cutoff = '19:15', punch_close = '21:00',
  late_fine_npr = 50, absence_fine_npr = 100, absence_fines_from = public.nepal_today() - 40
where id;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', '{"display_name":"Asha"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local', '{"display_name":"Bikash"}');
update public.profiles set created_at = now() - interval '60 days';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);
insert into public.sessions (id, session_date, venue_id, status) values
  ('20000000-0000-0000-0000-000000000001', public.nepal_today() - 1, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000002', public.nepal_today() - 2, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000003', public.nepal_today() - 3, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000004', public.nepal_today() - 4, '10000000-0000-0000-0000-000000000001', 'scheduled');

-- G1 and G4: only automatic absence fines. G2: one of them paid. G3: someone punched in.
select public._create_absence_fines(now());
insert into public.payments (id, member_id, amount_npr, method, recorded_by) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 100, 'cash',
   '00000000-0000-0000-0000-00000000000a');
update public.fines set status = 'paid', payment_id = '40000000-0000-0000-0000-000000000001'
where session_id = '20000000-0000-0000-0000-000000000002' and member_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.attendance (member_id, session_id, venue_id, punched_in_at, status, latitude, longitude,
  accuracy_m, distance_m, venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m)
values ('00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001', ((public.nepal_today() - 3) + time '19:00') at time zone 'Asia/Kathmandu',
  'on_time', 27.7199, 85.3408, 10, 15, 27.7198624, 85.3407743, 100, 50);

select is((select count(*)::int from public.fines where session_id = '20000000-0000-0000-0000-000000000001'), 3,
  'game 1 got three automatic absence fines');

-- ---------------------------------------------------------------------------
-- Cancelling waives the unpaid absence fines (audited); restoring does not bring them back
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
update public.sessions set status = 'cancelled' where id = '20000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.fines where session_id = '20000000-0000-0000-0000-000000000001'
  and status = 'waived'), 3, 'cancelling the game waives its absence fines');
select is((select count(*)::int from public.audit_log where action = 'fine.waived' and reason = 'Game cancelled'
  and actor_id = '00000000-0000-0000-0000-00000000000a'), 3, 'each waiver is in the audit log, by the admin');
update public.sessions set status = 'scheduled' where id = '20000000-0000-0000-0000-000000000001';
select is(public._create_absence_fines(now()), 0, 'restoring the game does not re-create the fines');

-- ---------------------------------------------------------------------------
-- Deleting a game created by mistake
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_delete_session('20000000-0000-0000-0000-000000000001', 'Created by mistake') $$,
  '42501', 'Only the admin can do this.', 'a member cannot delete a game');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_delete_session('20000000-0000-0000-0000-000000000001', '') $$,
  '22023', null, 'a reason is required');
select throws_ok($$ select public.admin_delete_session('20000000-0000-0000-0000-000000000002', 'Created by mistake') $$,
  '22023', 'A fine for this game was already paid. Cancel the game instead.', 'a game with a paid fine cannot be deleted');
select throws_ok($$ select public.admin_delete_session('20000000-0000-0000-0000-000000000003', 'Created by mistake') $$,
  '22023', 'Someone punched in for this game, so it is part of the history. Cancel it instead.',
  'a game someone punched in for cannot be deleted');
select lives_ok($$ select public.admin_delete_session('20000000-0000-0000-0000-000000000001', 'Created by mistake') $$,
  'a cancelled game created by mistake is deleted (its waived absence fines with it)');
select lives_ok($$ select public.admin_delete_session('20000000-0000-0000-0000-000000000004', 'Created by mistake') $$,
  'a scheduled game created by mistake is deleted (its unpaid absence fines with it)');
reset role;

select is((select count(*)::int from public.sessions where id in
  ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004')), 0, 'both games are gone');
select is((select count(*)::int from public.fines where session_id in
  ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004')), 0, 'and their absence fines');
select is((select count(*)::int from public.fines where session_id = '20000000-0000-0000-0000-000000000002'), 3,
  'other games keep their fines');
select is((select (details ->> 'absence_fines_removed')::int from public.audit_log where action = 'session.deleted'
  and entity_id = '20000000-0000-0000-0000-000000000004'), 3, 'the deletion is audited with what was removed');

select * from finish();
rollback;
