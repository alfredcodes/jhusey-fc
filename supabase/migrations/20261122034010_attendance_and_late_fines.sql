-- Phase 4: GPS punch-in, attendance evidence and automatic late fines.
--
-- Confirmed rules (docs/business-rules/attendance.md, fines.md, open questions 13-14):
--   * Official time = database clock, truncated to whole seconds, in Asia/Kathmandu.
--   * Up to 19:15:00(.999) is On Time; from 19:15:01 it is Late with an NPR 50 fine.
--   * Punch-in is accepted from 18:30:00 to 21:00:00 on the session's date.
--   * GPS only: reject if the phone's reported accuracy is worse than the venue limit
--     (default 50 m) or the server-calculated distance exceeds the venue radius.
--   * Attendance and its fine are written in ONE transaction by punch_in().
--   * Members can only read their own rows; nobody writes these tables directly.

-- ---------------------------------------------------------------------------
-- Venue accuracy limit (admin-editable, like the radius)
-- ---------------------------------------------------------------------------
alter table public.venues
  add column max_accuracy_m integer not null default 50
    constraint venues_max_accuracy_range check (max_accuracy_m between 10 and 500);

-- ---------------------------------------------------------------------------
-- Pure helpers (kept separate so they can be tested directly)
-- ---------------------------------------------------------------------------

-- Great-circle (haversine) distance in metres. No PostGIS needed.
create function public.distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

create type public.attendance_status as enum ('on_time', 'late');

-- On Time / Late for an instant and a session date, using whole seconds in Nepal time.
create function public.attendance_status_for(p_at timestamptz, p_session_date date)
returns public.attendance_status
language sql
immutable
set search_path = ''
as $$
  select case
    when date_trunc('second', p_at at time zone 'Asia/Kathmandu')
         <= p_session_date + time '19:15:00'
      then 'on_time'
    else 'late'
  end::public.attendance_status;
$$;

-- ---------------------------------------------------------------------------
-- Attendance: one immutable evidence row per member per session
-- ---------------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id),
  session_id uuid not null references public.sessions (id),
  venue_id uuid not null references public.venues (id),
  punched_in_at timestamptz not null,
  status public.attendance_status not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision not null,
  distance_m double precision not null,
  -- Snapshot of the venue settings used, so later venue edits never change history.
  venue_latitude double precision not null,
  venue_longitude double precision not null,
  venue_radius_m integer not null,
  venue_max_accuracy_m integer not null,
  created_at timestamptz not null default now(),
  constraint attendance_one_per_member_session unique (member_id, session_id)
);

create index attendance_session_id_idx on public.attendance (session_id);

comment on table public.attendance is
  'Punch-in evidence. Written only by punch_in(); never edited. Corrections (Phase 6) are separate audited records.';

-- ---------------------------------------------------------------------------
-- Fines (only the confirmed late rule exists; NPR 200 rule is unresolved)
-- ---------------------------------------------------------------------------
create type public.fine_status as enum ('pending', 'paid', 'waived');

create table public.fines (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id),
  attendance_id uuid references public.attendance (id)
    constraint fines_one_per_attendance unique,
  reason text not null
    constraint fines_reason_known check (reason in ('late')),
  amount_npr integer not null
    constraint fines_amount_positive check (amount_npr > 0),
  status public.fine_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fines_member_status_idx on public.fines (member_id, status);

create trigger fines_set_updated_at
  before update on public.fines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants and RLS: read-only for clients
-- ---------------------------------------------------------------------------
revoke all on table public.attendance, public.fines from anon, authenticated;
grant select on table public.attendance, public.fines to authenticated;

alter table public.attendance enable row level security;
alter table public.fines enable row level security;

create policy "Members read own attendance; admin reads all"
  on public.attendance for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));

create policy "Members read own fines; admin reads all"
  on public.fines for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Punch-in.
-- _punch_in() holds the logic and takes the member and clock as parameters so
-- the tests can check exact boundaries. Clients cannot call it.
-- punch_in() is the only client entry point: it supplies auth.uid() and now().
-- ---------------------------------------------------------------------------
create function public._punch_in(
  p_member_id uuid,
  p_now timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := date_trunc('second', p_now at time zone 'Asia/Kathmandu');
  v_session public.sessions;
  v_venue public.venues;
  v_distance double precision;
  v_status public.attendance_status;
  v_attendance public.attendance;
  v_fine integer;
begin
  if p_member_id is null
     or not exists (select 1 from public.profiles where id = p_member_id and is_active) then
    raise exception 'Your account is not active. Contact the team admin.' using errcode = '22023';
  end if;

  -- NaN and infinity fail these range checks too.
  if p_latitude is null or p_longitude is null or p_accuracy_m is null
     or not (p_latitude between -90 and 90)
     or not (p_longitude between -180 and 180)
     or not (p_accuracy_m between 0 and 100000) then
    raise exception 'The location from your phone was not valid. Please try again.'
      using errcode = '22023';
  end if;

  select * into v_session from public.sessions where session_date = v_local::date;
  if not found then
    raise exception 'There is no session today.' using errcode = '22023';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'Today''s session is cancelled.' using errcode = '22023';
  end if;

  if v_local::time < time '18:30:00' then
    raise exception 'Punch-in opens at 6:30 PM.' using errcode = '22023';
  end if;
  if v_local::time > time '21:00:00' then
    raise exception 'Punch-in closed at 9:00 PM.' using errcode = '22023';
  end if;

  if exists (select 1 from public.attendance
             where member_id = p_member_id and session_id = v_session.id) then
    raise exception 'You have already punched in for today''s session.' using errcode = '22023';
  end if;

  select * into v_venue from public.venues where id = v_session.venue_id;

  if p_accuracy_m > v_venue.max_accuracy_m then
    raise exception 'Your location is too uncertain (±% m; ±% m or better is needed). Go outside or wait a few seconds, then try again.',
      round(p_accuracy_m), v_venue.max_accuracy_m
      using errcode = '22023';
  end if;

  v_distance := public.distance_m(v_venue.latitude, v_venue.longitude, p_latitude, p_longitude);
  if v_distance > v_venue.geofence_radius_m then
    raise exception 'You are % m from %. Punch in within % m of the venue.',
      round(v_distance), v_venue.name, v_venue.geofence_radius_m
      using errcode = '22023';
  end if;

  v_status := public.attendance_status_for(p_now, v_session.session_date);

  begin
    insert into public.attendance (
      member_id, session_id, venue_id, punched_in_at, status,
      latitude, longitude, accuracy_m, distance_m,
      venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m
    ) values (
      p_member_id, v_session.id, v_venue.id, p_now, v_status,
      p_latitude, p_longitude, p_accuracy_m, v_distance,
      v_venue.latitude, v_venue.longitude, v_venue.geofence_radius_m, v_venue.max_accuracy_m
    )
    returning * into v_attendance;
  exception when unique_violation then
    -- Two taps at the same moment: the second waits, then lands here.
    raise exception 'You have already punched in for today''s session.' using errcode = '22023';
  end;

  if v_status = 'late' then
    v_fine := 50;
    insert into public.fines (member_id, attendance_id, reason, amount_npr)
    values (p_member_id, v_attendance.id, 'late', v_fine);
  end if;

  return jsonb_build_object(
    'punched_in_at', v_attendance.punched_in_at,
    'status', v_status,
    'distance_m', round(v_distance),
    'accuracy_m', round(p_accuracy_m),
    'venue_name', v_venue.name,
    'fine_npr', v_fine
  );
end;
$$;

create function public.punch_in(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public._punch_in((select auth.uid()), now(), p_latitude, p_longitude, p_accuracy_m);
$$;

revoke execute on function public.distance_m(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.attendance_status_for(timestamptz, date) from public, anon, authenticated;
revoke execute on function public._punch_in(uuid, timestamptz, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.punch_in(double precision, double precision, double precision) from public, anon;
grant execute on function public.punch_in(double precision, double precision, double precision) to authenticated;
