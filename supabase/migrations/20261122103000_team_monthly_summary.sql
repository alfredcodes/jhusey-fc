-- Month-by-month team totals for the Reports page trend chart. Read-only and
-- visible to every active member (team transparency). Counting rules match team_report().
create function public.team_monthly_summary(p_from date, p_to date)
returns table (
  month date,
  sessions integer,
  member_sessions integer,
  attended integer,
  late integer,
  absent integer,
  excused integer,
  fines_npr integer,
  late_fines_npr integer,
  absence_fines_npr integer,
  collected_npr integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
     and s.session_date >= (p.created_at at time zone 'Asia/Kathmandu')::date
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
$$;

revoke execute on function public.team_monthly_summary(date, date) from public, anon;
grant execute on function public.team_monthly_summary(date, date) to authenticated;
