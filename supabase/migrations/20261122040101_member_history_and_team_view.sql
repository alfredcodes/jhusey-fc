-- Phase 5: member history, derived absences and a privacy-safe team view.
--
-- * A session is "closed" once its punch-in window has ended (after 21:00:00 Nepal time).
-- * Absent = a scheduled, closed session since the member joined, with no punch-in.
--   Absence is derived, never stored, and never creates a fine (no approved rule).
-- * Team view returns display name + On Time/Late only: no GPS, no times, no fines.
--   It lists only members who punched in (open question 10, privacy-safe default).

create function public.session_closed(p_session_date date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_session_date < public.nepal_today()
      or (p_session_date = public.nepal_today()
          and (now() at time zone 'Asia/Kathmandu')::time > time '21:00:00');
$$;

revoke execute on function public.session_closed(date) from public, anon;
grant execute on function public.session_closed(date) to authenticated;

-- ---------------------------------------------------------------------------
-- The caller's own session-by-session history (newest first).
-- security invoker: RLS still applies, and the explicit member filter keeps the
-- admin's own history to their own rows too.
-- result: 'on_time' | 'late' | 'absent' | 'open' (today, window not closed, no punch-in yet)
-- ---------------------------------------------------------------------------
create function public.my_session_history()
returns table (
  session_id uuid,
  session_date date,
  venue_name text,
  result text,
  punched_in_at timestamptz,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  distance_m double precision,
  fine_npr integer,
  fine_status public.fine_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.session_date,
    v.name,
    case
      when a.id is not null then a.status::text
      when public.session_closed(s.session_date) then 'absent'
      else 'open'
    end,
    a.punched_in_at,
    a.latitude,
    a.longitude,
    a.accuracy_m,
    a.distance_m,
    f.amount_npr,
    f.status
  from public.profiles p
  join public.sessions s
    on s.session_date >= (p.created_at at time zone 'Asia/Kathmandu')::date
   and s.session_date <= public.nepal_today()
  join public.venues v on v.id = s.venue_id
  left join public.attendance a on a.session_id = s.id and a.member_id = p.id
  left join public.fines f on f.attendance_id = a.id
  where p.id = (select auth.uid())
    -- A cancelled session only appears if the member somehow punched in for it.
    and (s.status = 'scheduled' or a.id is not null)
  order by s.session_date desc;
$$;

revoke execute on function public.my_session_history() from public, anon;
grant execute on function public.my_session_history() to authenticated;

-- ---------------------------------------------------------------------------
-- Team attendance for one session: names and status only.
-- security definer because members cannot read each other's attendance rows;
-- this function deliberately exposes just these two columns.
-- ---------------------------------------------------------------------------
create function public.team_attendance(p_session_id uuid)
returns table (display_name text, status public.attendance_status)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  return query
    select p.display_name, a.status
    from public.attendance a
    join public.profiles p on p.id = a.member_id
    where a.session_id = p_session_id
    order by p.display_name;
end;
$$;

revoke execute on function public.team_attendance(uuid) from public, anon;
grant execute on function public.team_attendance(uuid) to authenticated;
