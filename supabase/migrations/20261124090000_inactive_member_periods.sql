-- Inactive members: stop counting games while a member is deactivated (2026-11-24).
-- Before: reports, rosters and My Record counted every game since the join date, so a
-- deactivated member piled up absences; after a reactivation the absence-fine job would also
-- fine every game missed while inactive. Now each deactivation opens an inactive period
-- (closed on reactivation) and one helper decides whether a member counts on a game day.
-- Only the membership condition changes in the functions below; their bodies are otherwise
-- identical to the current definitions.

create table public.member_inactive_periods (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id),
  from_date date not null,
  -- null = still inactive. Reactivating on the deactivation day gives to_date = from_date - 1
  -- (an empty period).
  to_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint member_inactive_periods_dates check (to_date is null or to_date >= from_date - 1)
);

create unique index member_inactive_periods_one_open
  on public.member_inactive_periods (member_id) where to_date is null;
create index member_inactive_periods_member on public.member_inactive_periods (member_id);

alter table public.member_inactive_periods enable row level security;
-- Written only by admin_update_member (security definer). The admin may read it; members
-- learn whether someone counts only through the report functions.
revoke all on public.member_inactive_periods from public, anon, authenticated;
grant select on public.member_inactive_periods to authenticated;
create policy member_inactive_periods_admin_read on public.member_inactive_periods
  for select to authenticated using ((select public.is_admin()));

-- Backfill: members inactive today get a period from the day they were deactivated
-- (audit log), or from their last profile change if there is no audit row.
insert into public.member_inactive_periods (member_id, from_date, created_by, created_at)
select p.id,
  coalesce(
    (select (a.created_at at time zone 'Asia/Kathmandu')::date from public.audit_log a
      where a.action = 'member.updated' and a.entity_id = p.id
        and (a.details -> 'to' ->> 'is_active') = 'false'
      order by a.created_at desc limit 1),
    (p.updated_at at time zone 'Asia/Kathmandu')::date),
  null, now()
from public.profiles p
where not p.is_active;

-- Is the member counted on this game day? Joined on or before it, and not inactive then.
create function public.member_counted_on(p_member_id uuid, p_joined_at timestamptz, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_joined_at at time zone 'Asia/Kathmandu')::date <= p_date
    and not exists (
      select 1 from public.member_inactive_periods i
      where i.member_id = p_member_id
        and p_date >= i.from_date
        and (i.to_date is null or p_date <= i.to_date)
    )
$$;

revoke execute on function public.member_counted_on(uuid, timestamptz, date) from public, anon;
grant execute on function public.member_counted_on(uuid, timestamptz, date) to authenticated;

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
     and public.member_counted_on(p.id, p.created_at, s.session_date)
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
     and public.member_counted_on(p.id, p.created_at, s.session_date)
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
    on public.member_counted_on(p.id, p.created_at, s.session_date)
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
     or public.member_counted_on(p.id, p.created_at, v_session.session_date)
  order by p.display_name;
end;
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
   and public.member_counted_on(p.id, p.created_at, s.session_date)
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

CREATE OR REPLACE FUNCTION public.admin_update_member(p_member_id uuid, p_display_name text, p_is_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old public.profiles;
begin
  perform public.require_admin();

  select * into v_old from public.profiles where id = p_member_id for update;
  if not found then
    raise exception 'Member not found.' using errcode = '22023';
  end if;
  if p_member_id = (select auth.uid()) and not p_is_active then
    raise exception 'You cannot deactivate your own admin account.' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = btrim(p_display_name), is_active = p_is_active
  where id = p_member_id;

  -- Inactive periods: games from the deactivation day until the day before reactivation
  -- are not counted (no absence, no absence fine).
  if v_old.is_active and not p_is_active then
    insert into public.member_inactive_periods (member_id, from_date, created_by)
    values (p_member_id, public.nepal_today(), (select auth.uid()))
    on conflict (member_id) where to_date is null do nothing;
  elsif not v_old.is_active and p_is_active then
    update public.member_inactive_periods
    set to_date = public.nepal_today() - 1
    where member_id = p_member_id and to_date is null;
  end if;

  perform public.write_audit('member.updated', 'profile', p_member_id, null,
    jsonb_build_object(
      'from', jsonb_build_object('display_name', v_old.display_name, 'is_active', v_old.is_active),
      'to', jsonb_build_object('display_name', btrim(p_display_name), 'is_active', p_is_active)));
end;
$function$;
