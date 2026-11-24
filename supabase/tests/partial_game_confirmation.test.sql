-- Partial players confirm games with "I'm coming": only confirmed (or attended) games count
-- for them. Regular players are unchanged.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(19);

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
  ('00000000-0000-0000-0000-0000000000a1', 'r@test.local', '{"display_name":"Regular Ram"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'p1@test.local', '{"display_name":"Partial Pooja"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'p2@test.local', '{"display_name":"Partial Prem"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'p3@test.local', '{"display_name":"Partial Puja"}');
update public.profiles set created_at = now() - interval '60 days';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set fee_plan = 'partial' where id in
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3');

insert into public.venues (id, name, latitude, longitude) values
  ('10000000-0000-0000-0000-000000000001', 'Dhanyentari Futsal', 27.7198624, 85.3407743);
insert into public.sessions (id, session_date, venue_id, status) values
  ('20000000-0000-0000-0000-000000000001', public.nepal_today() - 5, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000002', public.nepal_today() + 3, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000003', public.nepal_today() + 4, '10000000-0000-0000-0000-000000000001', 'cancelled'),
  ('20000000-0000-0000-0000-000000000005', public.nepal_today(),     '10000000-0000-0000-0000-000000000001', 'scheduled');

-- Past game S1: Pooja had confirmed and did not come; Puja came without confirming (late);
-- Prem neither confirmed nor came; Ram (regular) and the admin did not come.
insert into public.game_commitments (member_id, session_id) values
  ('00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000001');
insert into public.attendance (member_id, session_id, venue_id, punched_in_at, status, latitude, longitude,
  accuracy_m, distance_m, venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m)
values ('00000000-0000-0000-0000-0000000000b3', '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', ((public.nepal_today() - 5) + time '19:20') at time zone 'Asia/Kathmandu', 'late',
  27.7199, 85.3408, 10, 15, 27.7198624, 85.3407743, 100, 50);

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.nepal(p_day integer, p_time time) returns timestamptz
language sql as $$ select ((public.nepal_today() + p_day) + p_time) at time zone 'Asia/Kathmandu' $$;

-- ---------------------------------------------------------------------------
-- Confirming and withdrawing
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select throws_ok($$ select public.confirm_game('20000000-0000-0000-0000-000000000002') $$,
  '22023', 'Only partial-plan players confirm games. Regular players are expected at every game.',
  'a regular player cannot confirm a game');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select lives_ok($$ select public.confirm_game('20000000-0000-0000-0000-000000000002') $$,
  'a partial player confirms a game in three days');
select throws_ok($$ select public.confirm_game('20000000-0000-0000-0000-000000000002') $$,
  '22023', 'You have already confirmed this game.', 'confirming twice is refused');
select lives_ok($$ select public.withdraw_game_confirmation('20000000-0000-0000-0000-000000000002') $$,
  'and can withdraw before the deadline');
select throws_ok($$ select public.confirm_game('20000000-0000-0000-0000-000000000003') $$,
  '22023', 'Choose a scheduled game.', 'a cancelled game cannot be confirmed');
select throws_ok($$ select public.confirm_game('20000000-0000-0000-0000-000000000005') $$,
  '22023', 'Confirmations close at 9 PM the day before the game.', 'today''s game is locked');
select throws_ok($$ insert into public.game_commitments (member_id, session_id)
  values ('00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'members cannot write confirmations directly');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
select public.notify_absence('20000000-0000-0000-0000-000000000002', null);
select throws_ok($$ select public.confirm_game('20000000-0000-0000-0000-000000000002') $$,
  '22023', 'You told the team you cannot come to this game. Withdraw that first.',
  'a can''t-come notice blocks confirming the same game');
select is((select count(*)::int from public.game_commitments), 1,
  'the team can see who is coming (Pooja''s past confirmation)');
reset role;

-- The deadline is the same instant as for absence notices: 9 PM the day before.
select ok(public.absence_notice_open(public.nepal_today() + 1, pg_temp.nepal(0, '20:59:59')),
  'confirmations are open at 8:59:59 PM the day before');
select ok(not public.absence_notice_open(public.nepal_today() + 1, pg_temp.nepal(0, '21:00:00')),
  'and locked from 9:00 PM');

-- ---------------------------------------------------------------------------
-- Absence fines for game S1 (closed by the fixed clock)
-- ---------------------------------------------------------------------------
select public._create_absence_fines(pg_temp.nepal(-4, '12:00'));
select is((select count(*)::int from public.fines where reason = 'absence'
  and member_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'a regular player who did not come is fined');
select is((select count(*)::int from public.fines where reason = 'absence'
  and member_id = '00000000-0000-0000-0000-0000000000b1'), 1,
  'a partial player who confirmed and did not come is fined');
select is((select count(*)::int from public.fines where reason = 'absence'
  and member_id = '00000000-0000-0000-0000-0000000000b2'), 0,
  'a partial player who did not confirm is not fined');
select is((select count(*)::int from public.fines where reason = 'absence'
  and member_id = '00000000-0000-0000-0000-0000000000b3'), 0,
  'a partial player who came is not absent');

-- ---------------------------------------------------------------------------
-- Reports, roster and My Record
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
select is((select row(sessions, absent) from public.team_report(public.nepal_today() - 10, public.nepal_today() - 1)
  where member_id = '00000000-0000-0000-0000-0000000000b2'), row(0, 0),
  'the team report does not count unconfirmed games for a partial player');
select is((select row(sessions, late, absent) from public.team_report(public.nepal_today() - 10, public.nepal_today() - 1)
  where member_id = '00000000-0000-0000-0000-0000000000b3'), row(1, 1, 0),
  'a partial player who came counts as attended (late as normal)');
select is((select array_agg(display_name order by display_name) from public.session_roster('20000000-0000-0000-0000-000000000001')),
  array['Admin', 'Partial Pooja', 'Partial Puja', 'Regular Ram'],
  'the roster lists regular players, confirmed and attending partial players, not the others');
select is((select count(*)::int from public.my_session_history()
  where session_id = '20000000-0000-0000-0000-000000000001'), 0,
  'My Record does not show unconfirmed games to a partial player');
reset role;

select * from finish();
rollback;
