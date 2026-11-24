-- Inactive periods: a deactivated member is not counted (no absence, no absence fine) for games
-- while inactive, also after being reactivated. Their earlier games still count.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

delete from public.audit_log;
delete from public.fines;
delete from public.payments;
delete from public.absence_excuses;
delete from public.attendance;
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
  ('20000000-0000-0000-0000-000000000001', public.nepal_today() - 30, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000002', public.nepal_today() - 20, '10000000-0000-0000-0000-000000000001', 'scheduled'),
  ('20000000-0000-0000-0000-000000000003', public.nepal_today() - 10, '10000000-0000-0000-0000-000000000001', 'scheduled');

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true)
$$;

-- The admin deactivates Asha. The period starts today; move it back to 25 days ago, as if
-- she had been deactivated then (between games 1 and 2).
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select lives_ok($$ select public.admin_update_member('00000000-0000-0000-0000-0000000000a1', 'Asha', false) $$,
  'the admin can deactivate a member');
reset role;
select is((select count(*)::int from public.member_inactive_periods
  where member_id = '00000000-0000-0000-0000-0000000000a1' and to_date is null and from_date = public.nepal_today()),
  1, 'deactivating opens an inactive period from today');
update public.member_inactive_periods set from_date = public.nepal_today() - 25
where member_id = '00000000-0000-0000-0000-0000000000a1';

-- Reports: only game 1 counts for Asha.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select is((select sessions from public.team_report(public.nepal_today() - 35, public.nepal_today())
  where member_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'team report counts only the game before the deactivation');
select is((select absent from public.team_report(public.nepal_today() - 35, public.nepal_today())
  where member_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'and only that game as an absence');
select is((select sessions from public.team_report(public.nepal_today() - 35, public.nepal_today())
  where member_id = '00000000-0000-0000-0000-0000000000b1'), 3,
  'an active member still counts every game');
select is((select sum(member_sessions)::int from public.team_monthly_summary(public.nepal_today() - 35, public.nepal_today())),
  3 + 3 + 1, 'the monthly summary leaves out the inactive games (admin 3, Bikash 3, Asha 1)');
select ok(exists(select 1 from public.session_roster('20000000-0000-0000-0000-000000000001')
  where member_id = '00000000-0000-0000-0000-0000000000a1'), 'the roster of a game before the deactivation lists her');
select ok(not exists(select 1 from public.session_roster('20000000-0000-0000-0000-000000000002')
  where member_id = '00000000-0000-0000-0000-0000000000a1'), 'the roster of a game while inactive does not');
select is((select count(*)::int from public.member_inactive_periods), 0,
  'members cannot read inactive periods');
select throws_ok($$ insert into public.member_inactive_periods (member_id, from_date)
  values ('00000000-0000-0000-0000-0000000000b1', current_date) $$, '42501', null,
  'members cannot write inactive periods');
reset role;

-- Absence fines: none while inactive.
select public._create_absence_fines(now());
select is((select count(*)::int from public.fines where member_id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'no absence fines while the member is inactive');

-- Reactivated today: the period closes yesterday; the job then fines only game 1.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select lives_ok($$ select public.admin_update_member('00000000-0000-0000-0000-0000000000a1', 'Asha', true) $$,
  'the admin can reactivate her');
select is((select count(*)::int from public.member_inactive_periods
  where member_id = '00000000-0000-0000-0000-0000000000a1' and to_date = public.nepal_today() - 1), 1,
  'the admin sees the period closed on the day before reactivation');
reset role;
select public._create_absence_fines(now());
select is((select array_agg(session_id order by session_id) from public.fines
  where member_id = '00000000-0000-0000-0000-0000000000a1'),
  array['20000000-0000-0000-0000-000000000001'::uuid],
  'after reactivation she is fined only for the game before the inactive period');

-- Her own history after reactivation: game 1 only.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select is((select count(*)::int from public.my_session_history()), 1,
  'My Record shows only games she was counted for');
reset role;

-- Deactivate and reactivate on the same day: an empty period; today's games still count.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.admin_update_member('00000000-0000-0000-0000-0000000000b1', 'Bikash', false);
select public.admin_update_member('00000000-0000-0000-0000-0000000000b1', 'Bikash', true);
reset role;
select ok(public.member_counted_on('00000000-0000-0000-0000-0000000000b1', now() - interval '60 days', public.nepal_today()),
  'a same-day deactivate + reactivate leaves today counted');
select ok(public.member_counted_on('00000000-0000-0000-0000-0000000000b1', now() - interval '60 days', public.nepal_today() - 10),
  'and earlier games counted');
select ok(not public.member_counted_on('00000000-0000-0000-0000-0000000000b1', now(), public.nepal_today() - 1),
  'a game before the join date is never counted');

select * from finish();
rollback;
