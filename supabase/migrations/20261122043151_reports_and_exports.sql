-- Phase 7A: admin reports and CSV export sources. Read-only, admin-only.
-- Date ranges are Nepal calendar dates (inclusive), at most 366 days.
-- Sessions are counted the same way as the member's own stats:
-- scheduled, on/after the member joined, and either closed or attended.

create function public.check_report_range(p_from date, p_to date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose a valid date range.' using errcode = '22023';
  end if;
  if p_to - p_from > 366 then
    raise exception 'Choose a range of at most one year.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.check_report_range(date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-member attendance and fines for a date range
-- ---------------------------------------------------------------------------
create function public.admin_attendance_report(p_from date, p_to date)
returns table (
  member_id uuid,
  display_name text,
  is_active boolean,
  sessions integer,
  on_time integer,
  late integer,
  absent integer,
  attendance_percent integer,
  fines_npr integer,
  fines_paid_npr integer,
  fines_waived_npr integer,
  fines_outstanding_npr integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  perform public.check_report_range(p_from, p_to);

  return query
  with counted as (
    select p.id as member_id, a.id as attendance_id, a.status
    from public.profiles p
    join public.sessions s
      on s.session_date between p_from and p_to
     and s.session_date >= (p.created_at at time zone 'Asia/Kathmandu')::date
     and s.status = 'scheduled'
    left join public.attendance a on a.session_id = s.id and a.member_id = p.id
    where public.session_closed(s.session_date) or a.id is not null
  ),
  att as (
    select
      member_id,
      count(*)::integer as sessions,
      (count(*) filter (where status = 'on_time'))::integer as on_time,
      (count(*) filter (where status = 'late'))::integer as late,
      (count(*) filter (where attendance_id is null))::integer as absent
    from counted
    group by member_id
  ),
  money as (
    select
      f.member_id,
      coalesce(sum(f.amount_npr) filter (where f.status <> 'waived'), 0)::integer as assigned,
      coalesce(sum(f.amount_npr) filter (where f.status = 'paid'), 0)::integer as paid,
      coalesce(sum(f.amount_npr) filter (where f.status = 'waived'), 0)::integer as waived,
      coalesce(sum(f.amount_npr) filter (where f.status = 'pending'), 0)::integer as outstanding
    from public.fines f
    join public.attendance a on a.id = f.attendance_id
    join public.sessions s on s.id = a.session_id
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
    case when coalesce(att.sessions, 0) = 0 then null
         else round(100.0 * (att.on_time + att.late) / att.sessions)::integer end,
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
$$;

-- ---------------------------------------------------------------------------
-- Flat rows for CSV export (backups). Times are given in Nepal time as text.
-- ---------------------------------------------------------------------------
create function public.admin_export_attendance(p_from date, p_to date)
returns table (
  session_date date,
  member text,
  punched_in_nepal text,
  status text,
  original_status text,
  source text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  distance_m double precision,
  venue text,
  admin_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.check_report_range(p_from, p_to);
  return query
  select s.session_date, p.display_name,
    to_char(a.punched_in_at at time zone 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI:SS'),
    a.status::text, a.original_status::text, a.source::text,
    a.latitude, a.longitude, a.accuracy_m, a.distance_m, v.name, a.manual_reason
  from public.attendance a
  join public.sessions s on s.id = a.session_id
  join public.profiles p on p.id = a.member_id
  join public.venues v on v.id = a.venue_id
  where s.session_date between p_from and p_to
  order by s.session_date, p.display_name;
end;
$$;

create function public.admin_export_fines(p_from date, p_to date)
returns table (
  session_date date,
  member text,
  reason text,
  amount_npr integer,
  status text,
  created_nepal text,
  payment_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.check_report_range(p_from, p_to);
  return query
  select s.session_date, p.display_name, f.reason, f.amount_npr, f.status::text,
    to_char(f.created_at at time zone 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI:SS'), f.payment_id
  from public.fines f
  join public.attendance a on a.id = f.attendance_id
  join public.sessions s on s.id = a.session_id
  join public.profiles p on p.id = f.member_id
  where s.session_date between p_from and p_to
  order by s.session_date, p.display_name;
end;
$$;

-- Payments by the Nepal date they were recorded.
create function public.admin_export_payments(p_from date, p_to date)
returns table (
  payment_id uuid,
  recorded_nepal text,
  member text,
  amount_npr integer,
  method text,
  note text,
  fines_count integer,
  voided_nepal text,
  void_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.check_report_range(p_from, p_to);
  return query
  select pay.id,
    to_char(pay.created_at at time zone 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI:SS'),
    p.display_name, pay.amount_npr, pay.method, pay.note,
    -- Voided payments no longer own their fines; the audit log keeps the original list.
    (select count(*)::integer from public.fines f where f.payment_id = pay.id),
    to_char(pay.voided_at at time zone 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI:SS'),
    pay.void_reason
  from public.payments pay
  join public.profiles p on p.id = pay.member_id
  where (pay.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
  order by pay.created_at;
end;
$$;

revoke execute on function public.admin_attendance_report(date, date) from public, anon;
revoke execute on function public.admin_export_attendance(date, date) from public, anon;
revoke execute on function public.admin_export_fines(date, date) from public, anon;
revoke execute on function public.admin_export_payments(date, date) from public, anon;
grant execute on function public.admin_attendance_report(date, date) to authenticated;
grant execute on function public.admin_export_attendance(date, date) to authenticated;
grant execute on function public.admin_export_fines(date, date) to authenticated;
grant execute on function public.admin_export_payments(date, date) to authenticated;
