-- Partial-plan players confirm each game with "I'm coming" (owner decision 2026-11-24).
-- Partial players pay their monthly fee as before (no change to fees). They are expected at a
-- game (absence, absence fine, reports, roster, My Record) only if they confirmed it or punched
-- in. Confirm/withdraw closes at 9 PM the day before the game (same deadline as "Can't come").
-- After that the choice is locked; the admin can still excuse them with a reason.
-- Punch-in, GPS, On time / Late and the late fine are unchanged for everyone.
-- Regular members are unchanged: expected at every game, "Can't come" to be excused.
-- The five functions below change only their membership condition
-- (member_counted_on -> member_expected).

create table public.game_commitments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id),
  session_id uuid not null references public.sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint game_commitments_one_per_game unique (member_id, session_id)
);
create index game_commitments_session on public.game_commitments (session_id);

alter table public.game_commitments enable row level security;
-- Team transparency: active members see who is coming. Writes only through the RPCs below.
revoke all on public.game_commitments from public, anon, authenticated;
grant select on public.game_commitments to authenticated;
create policy game_commitments_team_read on public.game_commitments
  for select to authenticated using ((select public.is_active_member()));

-- Is the member expected at this game? Counted on that day (joined, not inactive) and either
-- on the regular plan, or a partial player who confirmed the game or punched in anyway.
create function public.member_expected(
  p_member_id uuid, p_joined_at timestamptz, p_plan public.fee_plan, p_session_id uuid, p_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.member_counted_on(p_member_id, p_joined_at, p_date)
    and (
      p_plan <> 'partial'
      or exists (select 1 from public.game_commitments c
                 where c.member_id = p_member_id and c.session_id = p_session_id)
      or exists (select 1 from public.attendance a
                 where a.member_id = p_member_id and a.session_id = p_session_id)
    )
$$;

revoke execute on function public.member_expected(uuid, timestamptz, public.fee_plan, uuid, date) from public, anon;
grant execute on function public.member_expected(uuid, timestamptz, public.fee_plan, uuid, date) to authenticated;

create function public.confirm_game(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_plan public.fee_plan;
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  select fee_plan into v_plan from public.profiles where id = (select auth.uid());
  if v_plan is distinct from 'partial' then
    raise exception 'Only partial-plan players confirm games. Regular players are expected at every game.'
      using errcode = '22023';
  end if;
  select * into v_session from public.sessions where id = p_session_id;
  if not found or v_session.status <> 'scheduled' then
    raise exception 'Choose a scheduled game.' using errcode = '22023';
  end if;
  if not public.absence_notice_open(v_session.session_date) then
    raise exception 'Confirmations close at 9 PM the day before the game.' using errcode = '22023';
  end if;
  if exists (select 1 from public.absence_excuses e
             where e.member_id = (select auth.uid()) and e.session_id = p_session_id) then
    raise exception 'You told the team you cannot come to this game. Withdraw that first.'
      using errcode = '22023';
  end if;
  begin
    insert into public.game_commitments (member_id, session_id)
    values ((select auth.uid()), p_session_id);
  exception when unique_violation then
    raise exception 'You have already confirmed this game.' using errcode = '22023';
  end;
end;
$$;

create function public.withdraw_game_confirmation(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  delete from public.game_commitments c
  using public.sessions s
  where c.session_id = p_session_id
    and s.id = c.session_id
    and c.member_id = (select auth.uid())
    and public.absence_notice_open(s.session_date);
  if not found then
    raise exception 'The confirmation for that game is locked (after 9 PM the day before) or does not exist.'
      using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.confirm_game(uuid) from public, anon;
revoke execute on function public.withdraw_game_confirmation(uuid) from public, anon;
grant execute on function public.confirm_game(uuid) to authenticated;
grant execute on function public.withdraw_game_confirmation(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.team_report(p_from date, p_to date)
 RETURNS TABLE(member_id uuid, display_name text, is_active boolean, sessions integer, on_time integer, late integer, absent integer, excused integer, attendance_percent integer, late_fines_npr integer, absence_fines_npr integer, fines_npr integer, fines_paid_npr integer, fines_waived_npr integer, fines_outstanding_npr integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  perform public.check_report_range(p_from, p_to);

  return query
  with counted as (
    select p.id as member_id, a.id as attendance_id, a.status, e.id as excuse_id
    from public.profiles p
    join public.sessions s
      on s.session_date between p_from and p_to
     and public.member_expected(p.id, p.created_at, p.fee_plan, s.id, s.session_date)
     and s.status = 'scheduled'
    left join public.attendance a on a.session_id = s.id and a.member_id = p.id
    left join public.absence_excuses e on e.session_id = s.id and e.member_id = p.id
    where public.session_closed(s.session_date) or a.id is not null
  ),
  att as (
    select
      member_id,
      count(*)::integer as sessions,
      (count(*) filter (where status = 'on_time'))::integer as on_time,
      (count(*) filter (where status = 'late'))::integer as late,
      (count(*) filter (where attendance_id is null and excuse_id is null))::integer as absent,
      (count(*) filter (where attendance_id is null and excuse_id is not null))::integer as excused
    from counted
    group by member_id
  ),
  money as (
    select
      f.member_id,
      coalesce(sum(f.amount_npr) filter (where f.status <> 'waived' and f.reason = 'late'), 0)::integer as late_npr,
      coalesce(sum(f.amount_npr) filter (where f.status <> 'waived' and f.reason = 'absence'), 0)::integer as absence_npr,
      coalesce(sum(f.amount_npr) filter (where f.status <> 'waived'), 0)::integer as assigned,
      coalesce(sum(f.amount_npr) filter (where f.status = 'paid'), 0)::integer as paid,
      coalesce(sum(f.amount_npr) filter (where f.status = 'waived'), 0)::integer as waived,
      coalesce(sum(f.amount_npr) filter (where f.status = 'pending'), 0)::integer as outstanding
    from public.fines f
    join public.sessions s on s.id = f.session_id
    where s.session_date between p_from and p_to
    group by f.member_id
  )
  select
    p.id,
    p.display_name,
    p.is_active,
    coalesce(att.sessions, 0),
    coalesce(att.on_time, 0),
    coalesce(att.late, 0),
    coalesce(att.absent, 0),
    coalesce(att.excused, 0),
    case when coalesce(att.sessions, 0) = 0 then null
         else round(100.0 * (att.on_time + att.late) / att.sessions)::integer end,
    coalesce(money.late_npr, 0),
    coalesce(money.absence_npr, 0),
    coalesce(money.assigned, 0),
    coalesce(money.paid, 0),
    coalesce(money.waived, 0),
    coalesce(money.outstanding, 0)
  from public.profiles p
  left join att on att.member_id = p.id
  left join money on money.member_id = p.id
  where p.is_active or att.member_id is not null or money.member_id is not null
  order by p.display_name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.team_monthly_summary(p_from date, p_to date)
 RETURNS TABLE(month date, sessions integer, member_sessions integer, attended integer, late integer, absent integer, excused integer, fines_npr integer, late_fines_npr integer, absence_fines_npr integer, collected_npr integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  perform public.check_report_range(p_from, p_to);

  return query
  with months as (
    select generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month')::date as month
  ),
  counted as (
    select date_trunc('month', s.session_date)::date as month, s.id as session_id,
      a.id as attendance_id, a.status, e.id as excuse_id
    from public.profiles p
    join public.sessions s
      on s.session_date between p_from and p_to
     and public.member_expected(p.id, p.created_at, p.fee_plan, s.id, s.session_date)
     and s.status = 'scheduled'
    left join public.attendance a on a.session_id = s.id and a.member_id = p.id
    left join public.absence_excuses e on e.session_id = s.id and e.member_id = p.id
    where public.session_closed(s.session_date) or a.id is not null
  ),
  att as (
    select month,
      count(distinct session_id)::integer as sessions,
      count(*)::integer as member_sessions,
      (count(*) filter (where attendance_id is not null))::integer as attended,
      (count(*) filter (where status = 'late'))::integer as late,
      (count(*) filter (where attendance_id is null and excuse_id is null))::integer as absent,
      (count(*) filter (where attendance_id is null and excuse_id is not null))::integer as excused
    from counted
    group by month
  ),
  money as (
    select date_trunc('month', s.session_date)::date as month,
      coalesce(sum(f.amount_npr) filter (where f.status <> 'waived'), 0)::integer as assigned,
      coalesce(sum(f.amount_npr) filter (where f.status <> 'waived' and f.reason = 'late'), 0)::integer as late_npr,
      coalesce(sum(f.amount_npr) filter (where f.status <> 'waived' and f.reason = 'absence'), 0)::integer as absence_npr
    from public.fines f
    join public.sessions s on s.id = f.session_id
    where s.session_date between p_from and p_to
    group by 1
  ),
  paid as (
    select date_trunc('month', pay.created_at at time zone 'Asia/Kathmandu')::date as month,
      sum(pay.amount_npr)::integer as collected
    from public.payments pay
    where pay.voided_at is null
      and (pay.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    group by 1
  )
  select m.month,
    coalesce(att.sessions, 0), coalesce(att.member_sessions, 0), coalesce(att.attended, 0),
    coalesce(att.late, 0), coalesce(att.absent, 0), coalesce(att.excused, 0),
    coalesce(money.assigned, 0), coalesce(money.late_npr, 0), coalesce(money.absence_npr, 0),
    coalesce(paid.collected, 0)
  from months m
  left join att on att.month = m.month
  left join money on money.month = m.month
  left join paid on paid.month = m.month
  order by m.month;
end;
$function$;

CREATE OR REPLACE FUNCTION public.my_session_history()
 RETURNS TABLE(session_id uuid, session_date date, venue_name text, result text, original_status attendance_status, source attendance_source, punched_in_at timestamp with time zone, latitude double precision, longitude double precision, accuracy_m double precision, distance_m double precision, fine_npr integer, fine_status fine_status, fine_reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    s.id,
    s.session_date,
    v.name,
    case
      when a.id is not null then a.status::text
      when e.id is not null then 'excused'
      when public.session_closed(s.session_date) then 'absent'
      else 'open'
    end,
    a.original_status,
    a.source,
    a.punched_in_at,
    a.latitude,
    a.longitude,
    a.accuracy_m,
    a.distance_m,
    f.amount_npr,
    f.status,
    f.reason
  from public.profiles p
  join public.sessions s
    on public.member_expected(p.id, p.created_at, p.fee_plan, s.id, s.session_date)
   and s.session_date <= public.nepal_today()
  join public.venues v on v.id = s.venue_id
  left join public.attendance a on a.session_id = s.id and a.member_id = p.id
  left join public.absence_excuses e on e.session_id = s.id and e.member_id = p.id
  left join lateral (
    select fi.amount_npr, fi.status, fi.reason from public.fines fi
    where fi.member_id = p.id and fi.session_id = s.id
    order by (fi.status <> 'waived') desc, fi.created_at desc
    limit 1
  ) f on true
  where p.id = (select auth.uid())
    and (s.status = 'scheduled' or a.id is not null)
  order by s.session_date desc;
$function$;

CREATE OR REPLACE FUNCTION public._create_absence_fines(p_now timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_local timestamp := p_now at time zone 'Asia/Kathmandu';
  v_rules public.club_settings;
  v_count integer;
begin
  select * into v_rules from public.club_settings;

  insert into public.fines (member_id, session_id, reason, amount_npr)
  select p.id, s.id, 'absence', v_rules.absence_fine_npr
  from public.sessions s
  join public.profiles p
    on p.is_active
   and public.member_expected(p.id, p.created_at, p.fee_plan, s.id, s.session_date)
  where s.status = 'scheduled'
    and s.session_date >= v_rules.absence_fines_from
    and (s.session_date < v_local::date
         or (s.session_date = v_local::date and v_local::time > v_rules.punch_close))
    and not exists (select 1 from public.attendance a where a.member_id = p.id and a.session_id = s.id)
    and not exists (select 1 from public.absence_excuses e where e.member_id = p.id and e.session_id = s.id)
  on conflict (member_id, session_id) where reason = 'absence' do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.session_roster(p_session_id uuid)
 RETURNS TABLE(member_id uuid, display_name text, is_active boolean, attendance_id uuid, punched_in_at timestamp with time zone, result text, original_status attendance_status, source attendance_source, distance_m double precision, accuracy_m double precision, excuse_source excuse_source, excuse_note text, fine_id uuid, fine_reason text, fine_amount_npr integer, fine_status fine_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_session public.sessions;
  v_me uuid := (select auth.uid());
  v_admin boolean := public.is_admin();
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  select * into v_session from public.sessions where id = p_session_id;
  if not found then
    return;
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.is_active,
    a.id,
    a.punched_in_at,
    case
      when a.id is not null then a.status::text
      when e.id is not null then 'excused'
      when v_session.status = 'cancelled' then 'cancelled'
      when public.session_closed(v_session.session_date) then 'absent'
      else 'open'
    end,
    a.original_status,
    a.source,
    case when v_admin or p.id = v_me then a.distance_m end,
    case when v_admin or p.id = v_me then a.accuracy_m end,
    e.source,
    case when v_admin or p.id = v_me then e.note end,
    f.id,
    f.reason,
    f.amount_npr,
    f.status
  from public.profiles p
  left join public.attendance a on a.member_id = p.id and a.session_id = v_session.id
  left join public.absence_excuses e on e.member_id = p.id and e.session_id = v_session.id
  left join lateral public.session_fine(p.id, v_session.id) f on true
  where a.id is not null
     or e.id is not null
     or f.id is not null
     or public.member_expected(p.id, p.created_at, p.fee_plan, v_session.id, v_session.session_date)
  order by p.display_name;
end;
$function$;
