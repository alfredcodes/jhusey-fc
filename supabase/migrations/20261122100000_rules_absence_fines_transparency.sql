-- UI round (2026-11-22), decisions by the owner:
--   * Club rules become admin-editable: punch-in window, on-time cutoff, late fine and
--     absence fine. Changes apply to punch-ins and fines created AFTER the change; every
--     stored attendance status and fine amount keeps the value it was created with.
--   * NPR 100 (default) absence fine. A member may excuse themselves in the app until
--     midnight before the session day; the admin can excuse later, with a reason. A pg_cron
--     job creates the fines after punch-in closes, only for sessions on or after
--     club_settings.absence_fines_from (never retroactively).
--   * Team transparency: every active member can READ the team's attendance results,
--     fines, payments (amounts, dates, method) and reports. Writes stay admin-only.
--     Exact GPS, accuracy and distance stay private to the member and the admin, as do
--     payment notes, phone numbers, email addresses and the audit log.
--   * Accounts are created by the admin (Edge Function `admin-users`) with an initial
--     password. member_private holds the phone number and the must-change-password flag.

-- ---------------------------------------------------------------------------
-- 1. Club settings (one row)
-- ---------------------------------------------------------------------------
create table public.club_settings (
  id boolean primary key default true constraint club_settings_single_row check (id),
  club_name text not null default 'Jhusey FC'
    constraint club_settings_name_length check (char_length(btrim(club_name)) between 1 and 60),
  punch_open time(0) not null default '18:30:00',
  on_time_cutoff time(0) not null default '19:15:00',
  punch_close time(0) not null default '21:00:00',
  late_fine_npr integer not null default 50
    constraint club_settings_late_fine_range check (late_fine_npr between 1 and 10000),
  absence_fine_npr integer not null default 100
    constraint club_settings_absence_fine_range check (absence_fine_npr between 1 and 10000),
  absence_fines_from date not null default public.nepal_today(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint club_settings_times_ordered
    check (punch_open < on_time_cutoff and on_time_cutoff < punch_close)
);

insert into public.club_settings default values;

revoke all on table public.club_settings from anon, authenticated;
grant select on table public.club_settings to authenticated;
alter table public.club_settings enable row level security;

create policy "Active members read the club rules"
  on public.club_settings for select to authenticated
  using ((select public.is_active_member()));

-- "6:30 PM" style label for messages.
create function public.time_label(p_time time)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(date '2000-01-01' + p_time, 'FMHH12:MI AM');
$$;

revoke execute on function public.time_label(time) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cutoff and window now come from club_settings
-- ---------------------------------------------------------------------------
create function public.attendance_status_for(p_at timestamptz, p_session_date date, p_cutoff time)
returns public.attendance_status
language sql
immutable
set search_path = ''
as $$
  select case
    when date_trunc('second', p_at at time zone 'Asia/Kathmandu') <= p_session_date + p_cutoff
      then 'on_time'
    else 'late'
  end::public.attendance_status;
$$;

-- The two-argument form uses the current club cutoff.
create or replace function public.attendance_status_for(p_at timestamptz, p_session_date date)
returns public.attendance_status
language sql
stable
set search_path = ''
as $$
  select public.attendance_status_for(p_at, p_session_date,
    (select on_time_cutoff from public.club_settings));
$$;

revoke execute on function public.attendance_status_for(timestamptz, date, time) from public, anon, authenticated;
revoke execute on function public.attendance_status_for(timestamptz, date) from public, anon, authenticated;

create or replace function public.session_closed(p_session_date date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_session_date < public.nepal_today()
      or (p_session_date = public.nepal_today()
          and (now() at time zone 'Asia/Kathmandu')::time
              > (select punch_close from public.club_settings));
$$;

-- ---------------------------------------------------------------------------
-- 3. Fines: absence reason and a session link for every fine
-- ---------------------------------------------------------------------------
alter table public.fines add column session_id uuid references public.sessions (id);

update public.fines f set session_id = a.session_id
from public.attendance a where a.id = f.attendance_id;

alter table public.fines
  alter column session_id set not null,
  drop constraint fines_reason_known,
  add constraint fines_reason_known check (reason in ('late', 'absence')),
  -- A late fine always points at its attendance row; an absence fine never does.
  add constraint fines_reason_source check ((reason = 'late') = (attendance_id is not null));

create index fines_session_id_idx on public.fines (session_id);
create unique index fines_one_absence_per_member_session
  on public.fines (member_id, session_id) where reason = 'absence';

-- ---------------------------------------------------------------------------
-- 4. Absence excuses
-- ---------------------------------------------------------------------------
create type public.excuse_source as enum ('member', 'admin');

create table public.absence_excuses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id),
  session_id uuid not null references public.sessions (id) on delete cascade,
  note text constraint absence_excuses_note_length check (note is null or char_length(note) <= 300),
  source public.excuse_source not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint absence_excuses_one_per_member_session unique (member_id, session_id)
);

create index absence_excuses_session_id_idx on public.absence_excuses (session_id);

revoke all on table public.absence_excuses from anon, authenticated;
-- The note can be personal: members read it only through the roster function (own/admin).
grant select (id, member_id, session_id, source, created_at) on table public.absence_excuses to authenticated;
alter table public.absence_excuses enable row level security;

create policy "Active members read excuses"
  on public.absence_excuses for select to authenticated
  using ((select public.is_active_member()));

-- ---------------------------------------------------------------------------
-- 5. Private member data (phone, must-change-password flag)
-- ---------------------------------------------------------------------------
create table public.member_private (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  phone text constraint member_private_phone_format
    check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  must_change_password boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger member_private_set_updated_at
  before update on public.member_private
  for each row execute function public.set_updated_at();

insert into public.member_private (member_id) select id from public.profiles;

-- New auth users get a private row too (the Edge Function then fills it in).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  insert into public.member_private (member_id) values (new.id);
  return new;
end;
$$;

revoke all on table public.member_private from anon, authenticated;
grant select on table public.member_private to authenticated;
alter table public.member_private enable row level security;

create policy "Members read own private row; admin reads all"
  on public.member_private for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 6. Transparency: members read the whole team's profiles and fines
-- ---------------------------------------------------------------------------
drop policy "Members read own profile; admin reads all" on public.profiles;
create policy "Members read own profile; active members read the team"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_active_member()));

drop policy "Members read own fines; admin reads all" on public.fines;
create policy "Members read own fines; active members read the team's"
  on public.fines for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_active_member()));

-- attendance (GPS) and payments (notes) keep their own-or-admin policies.
-- The team sees them through session_roster() and team_payments() below.

-- ---------------------------------------------------------------------------
-- 7. Punch-in and admin attendance functions use the club rules
-- ---------------------------------------------------------------------------
create or replace function public._punch_in(
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
  v_rules public.club_settings;
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

  if p_latitude is null or p_longitude is null or p_accuracy_m is null
     or not (p_latitude between -90 and 90)
     or not (p_longitude between -180 and 180)
     or not (p_accuracy_m between 0 and 100000) then
    raise exception 'The location from your phone was not valid. Please try again.'
      using errcode = '22023';
  end if;

  select * into v_rules from public.club_settings;

  select * into v_session from public.sessions where session_date = v_local::date;
  if not found then
    raise exception 'There is no session today.' using errcode = '22023';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'Today''s session is cancelled.' using errcode = '22023';
  end if;

  if v_local::time < v_rules.punch_open then
    raise exception 'Punch-in opens at %.', public.time_label(v_rules.punch_open) using errcode = '22023';
  end if;
  if v_local::time > v_rules.punch_close then
    raise exception 'Punch-in closed at %.', public.time_label(v_rules.punch_close) using errcode = '22023';
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

  v_status := public.attendance_status_for(p_now, v_session.session_date, v_rules.on_time_cutoff);

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
    raise exception 'You have already punched in for today''s session.' using errcode = '22023';
  end;

  if v_status = 'late' then
    v_fine := v_rules.late_fine_npr;
    insert into public.fines (member_id, attendance_id, session_id, reason, amount_npr)
    values (p_member_id, v_attendance.id, v_session.id, 'late', v_fine);
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

create or replace function public.admin_correct_attendance(
  p_attendance_id uuid, p_new_status public.attendance_status, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_row public.attendance;
  v_fine public.fines;
  v_fine_action text := 'none';
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);

  select * into v_row from public.attendance where id = p_attendance_id for update;
  if not found then
    raise exception 'Attendance record not found.' using errcode = '22023';
  end if;
  if v_row.status = p_new_status then
    raise exception 'The attendance already has that status.' using errcode = '22023';
  end if;

  select * into v_fine from public.fines where attendance_id = v_row.id for update;

  if p_new_status = 'on_time' then
    if v_fine.status = 'paid' then
      raise exception 'The late fine is already paid. Void the payment first, then correct.'
        using errcode = '22023';
    end if;
    if v_fine.status = 'pending' then
      update public.fines set status = 'waived' where id = v_fine.id;
      v_fine_action := 'waived';
    end if;
  else
    if v_fine.id is null then
      insert into public.fines (member_id, attendance_id, session_id, reason, amount_npr)
      values (v_row.member_id, v_row.id, v_row.session_id, 'late',
              (select late_fine_npr from public.club_settings));
      v_fine_action := 'created';
    elsif v_fine.status = 'waived' then
      update public.fines set status = 'pending' where id = v_fine.id;
      v_fine_action := 'reinstated';
    end if;
  end if;

  update public.attendance set status = p_new_status where id = v_row.id;

  perform public.write_audit('attendance.corrected', 'attendance', v_row.id, v_reason,
    jsonb_build_object('member_id', v_row.member_id, 'session_id', v_row.session_id,
      'from', v_row.status, 'to', p_new_status, 'fine', v_fine_action));
end;
$$;

-- Recording attendance for a member who has an absence fine waives that fine
-- (they were there after all). A paid absence fine must be voided first.
create or replace function public.admin_record_attendance(
  p_member_id uuid, p_session_id uuid, p_arrived_at time, p_reason text
)
returns public.attendance_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_session public.sessions;
  v_venue public.venues;
  v_at timestamptz;
  v_status public.attendance_status;
  v_attendance public.attendance;
  v_absence public.fines;
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);

  if p_arrived_at is null then
    raise exception 'Enter the arrival time.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_member_id and is_active) then
    raise exception 'Choose an active member.' using errcode = '22023';
  end if;

  select * into v_session from public.sessions where id = p_session_id;
  if not found or v_session.status <> 'scheduled' then
    raise exception 'Choose a scheduled session.' using errcode = '22023';
  end if;
  if v_session.session_date > public.nepal_today() then
    raise exception 'Attendance cannot be recorded for a future session.' using errcode = '22023';
  end if;

  select * into v_absence from public.fines
  where member_id = p_member_id and session_id = v_session.id and reason = 'absence'
  for update;
  if v_absence.status = 'paid' then
    raise exception 'This member''s absence fine is already paid. Void the payment first.'
      using errcode = '22023';
  end if;

  select * into v_venue from public.venues where id = v_session.venue_id;
  v_at := (v_session.session_date + p_arrived_at) at time zone 'Asia/Kathmandu';
  v_status := public.attendance_status_for(v_at, v_session.session_date);

  begin
    insert into public.attendance (
      member_id, session_id, venue_id, punched_in_at, status, source, recorded_by, manual_reason,
      venue_latitude, venue_longitude, venue_radius_m, venue_max_accuracy_m
    ) values (
      p_member_id, v_session.id, v_venue.id, v_at, v_status, 'admin', (select auth.uid()), v_reason,
      v_venue.latitude, v_venue.longitude, v_venue.geofence_radius_m, v_venue.max_accuracy_m
    )
    returning * into v_attendance;
  exception when unique_violation then
    raise exception 'This member already has attendance for that session. Use a correction instead.'
      using errcode = '22023';
  end;

  if v_status = 'late' then
    insert into public.fines (member_id, attendance_id, session_id, reason, amount_npr)
    values (p_member_id, v_attendance.id, v_session.id, 'late',
            (select late_fine_npr from public.club_settings));
  end if;

  if v_absence.status = 'pending' then
    update public.fines set status = 'waived' where id = v_absence.id;
  end if;

  perform public.write_audit('attendance.recorded', 'attendance', v_attendance.id, v_reason,
    jsonb_build_object('member_id', p_member_id, 'session_id', v_session.id,
      'arrived_at', p_arrived_at, 'status', v_status,
      'absence_fine_waived', v_absence.status = 'pending'));
  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Excuses and absence fines
-- ---------------------------------------------------------------------------

-- A member says they cannot come. Allowed until midnight before the session day.
create function public.notify_absence(p_session_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  select * into v_session from public.sessions where id = p_session_id;
  if not found or v_session.status <> 'scheduled' then
    raise exception 'Choose a scheduled session.' using errcode = '22023';
  end if;
  if v_session.session_date <= public.nepal_today() then
    raise exception 'Absence notices close at midnight before the session day. Contact the admin.'
      using errcode = '22023';
  end if;

  begin
    insert into public.absence_excuses (member_id, session_id, note, source, created_by)
    values ((select auth.uid()), p_session_id, nullif(btrim(p_note), ''), 'member', (select auth.uid()));
  exception
    when unique_violation then
      raise exception 'You have already told the team you cannot come.' using errcode = '22023';
    when check_violation then
      raise exception 'Keep the note under 300 characters.' using errcode = '22023';
  end;
end;
$$;

-- A member changes their mind (same deadline). Admin excuses cannot be withdrawn here.
create function public.withdraw_absence(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  delete from public.absence_excuses e
  using public.sessions s
  where e.session_id = p_session_id
    and s.id = e.session_id
    and e.member_id = (select auth.uid())
    and e.source = 'member'
    and s.session_date > public.nepal_today();

  if not found then
    raise exception 'There is no absence notice you can withdraw for that session.'
      using errcode = '22023';
  end if;
end;
$$;

-- The admin excuses a member at any time. A pending absence fine is waived.
create function public.admin_excuse_absence(p_member_id uuid, p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_fine public.fines;
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);

  if not exists (select 1 from public.profiles where id = p_member_id) then
    raise exception 'Member not found.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sessions where id = p_session_id) then
    raise exception 'Session not found.' using errcode = '22023';
  end if;
  if exists (select 1 from public.attendance where member_id = p_member_id and session_id = p_session_id) then
    raise exception 'This member punched in for that session; there is no absence to excuse.'
      using errcode = '22023';
  end if;

  select * into v_fine from public.fines
  where member_id = p_member_id and session_id = p_session_id and reason = 'absence'
  for update;
  if v_fine.status = 'paid' then
    raise exception 'The absence fine is already paid. Void the payment first, then excuse.'
      using errcode = '22023';
  end if;

  begin
    insert into public.absence_excuses (member_id, session_id, note, source, created_by)
    values (p_member_id, p_session_id, v_reason, 'admin', (select auth.uid()));
  exception when unique_violation then
    raise exception 'This member is already excused for that session.' using errcode = '22023';
  end;

  if v_fine.status = 'pending' then
    update public.fines set status = 'waived' where id = v_fine.id;
  end if;

  perform public.write_audit('absence.excused', 'session', p_session_id, v_reason,
    jsonb_build_object('member_id', p_member_id,
      'fine', case when v_fine.status = 'pending' then 'waived' else 'none' end));
end;
$$;

-- Creates the absence fines for every closed session since absence_fines_from.
-- Idempotent: run by pg_cron every 15 minutes; tests call it with a fixed clock.
create function public._create_absence_fines(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
   and (p.created_at at time zone 'Asia/Kathmandu')::date <= s.session_date
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
$$;

revoke execute on function public._create_absence_fines(timestamptz) from public, anon, authenticated;
revoke execute on function public.notify_absence(uuid, text) from public, anon;
revoke execute on function public.withdraw_absence(uuid) from public, anon;
revoke execute on function public.admin_excuse_absence(uuid, uuid, text) from public, anon;
grant execute on function public.notify_absence(uuid, text) to authenticated;
grant execute on function public.withdraw_absence(uuid) to authenticated;
grant execute on function public.admin_excuse_absence(uuid, uuid, text) to authenticated;

-- pg_cron ships with Supabase (free tier included).
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'jhusey-absence-fines',
  '*/15 * * * *',
  $$select public._create_absence_fines(now())$$
);

-- ---------------------------------------------------------------------------
-- 9. Rules editing (admin)
-- ---------------------------------------------------------------------------
create function public.admin_update_rules(
  p_club_name text,
  p_punch_open time,
  p_on_time_cutoff time,
  p_punch_close time,
  p_late_fine_npr integer,
  p_absence_fine_npr integer,
  p_absence_fines_from date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.club_settings;
  v_new public.club_settings;
begin
  perform public.require_admin();
  select * into v_old from public.club_settings for update;

  if p_absence_fines_from is distinct from v_old.absence_fines_from
     and p_absence_fines_from < public.nepal_today() then
    raise exception 'Absence fines cannot start in the past.' using errcode = '22023';
  end if;

  begin
    update public.club_settings set
      club_name = btrim(p_club_name),
      punch_open = date_trunc('second', p_punch_open::interval)::time,
      on_time_cutoff = date_trunc('second', p_on_time_cutoff::interval)::time,
      punch_close = date_trunc('second', p_punch_close::interval)::time,
      late_fine_npr = p_late_fine_npr,
      absence_fine_npr = p_absence_fine_npr,
      absence_fines_from = p_absence_fines_from,
      updated_at = now(),
      updated_by = (select auth.uid())
    returning * into v_new;
  exception when check_violation or not_null_violation then
    raise exception 'Check the rules: opening time < on-time cutoff < closing time, and fines between NPR 1 and 10,000.'
      using errcode = '22023';
  end;

  perform public.write_audit('rules.updated', 'club_settings', '00000000-0000-0000-0000-000000000000', null,
    jsonb_build_object(
      'from', to_jsonb(v_old) - 'id' - 'updated_at' - 'updated_by',
      'to', to_jsonb(v_new) - 'id' - 'updated_at' - 'updated_by'));
end;
$$;

revoke execute on function public.admin_update_rules(text, time, time, time, integer, integer, date) from public, anon;
grant execute on function public.admin_update_rules(text, time, time, time, integer, integer, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Private member data RPCs
-- ---------------------------------------------------------------------------
create function public.update_my_phone(p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  begin
    update public.member_private set phone = nullif(btrim(p_phone), '')
    where member_id = (select auth.uid());
  exception when check_violation then
    raise exception 'Enter a phone number of 7 to 20 digits.' using errcode = '22023';
  end;
end;
$$;

-- Called by the app after the member has set a new password.
create function public.mark_password_changed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.member_private set must_change_password = false
  where member_id = (select auth.uid());
$$;

create function public.admin_set_member_phone(p_member_id uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  begin
    update public.member_private set phone = nullif(btrim(p_phone), '')
    where member_id = p_member_id;
  exception when check_violation then
    raise exception 'Enter a phone number of 7 to 20 digits.' using errcode = '22023';
  end;
  if not found then
    raise exception 'Member not found.' using errcode = '22023';
  end if;
  perform public.write_audit('member.phone_updated', 'profile', p_member_id, null, '{}');
end;
$$;

-- Login emails and last sign-in come from auth.users, which only this function reads.
create function public.admin_member_accounts()
returns table (
  member_id uuid,
  email text,
  phone text,
  must_change_password boolean,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select p.id, u.email::text, mp.phone, mp.must_change_password, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.member_private mp on mp.member_id = p.id;
end;
$$;

revoke execute on function public.update_my_phone(text) from public, anon;
revoke execute on function public.mark_password_changed() from public, anon;
revoke execute on function public.admin_set_member_phone(uuid, text) from public, anon;
revoke execute on function public.admin_member_accounts() from public, anon;
grant execute on function public.update_my_phone(text) to authenticated;
grant execute on function public.mark_password_changed() to authenticated;
grant execute on function public.admin_set_member_phone(uuid, text) to authenticated;
grant execute on function public.admin_member_accounts() to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Team views (read-only for every active member)
-- ---------------------------------------------------------------------------

-- The most relevant fine of a member for a session: a non-waived one first.
create function public.session_fine(p_member_id uuid, p_session_id uuid)
returns public.fines
language sql
stable
set search_path = ''
as $$
  select * from public.fines
  where member_id = p_member_id and session_id = p_session_id
  order by (status <> 'waived') desc, created_at desc
  limit 1;
$$;

revoke execute on function public.session_fine(uuid, uuid) from public, anon, authenticated;

-- Everyone expected at a session, with their result. Distance, accuracy and excuse
-- notes are returned only for the caller's own row, or to the admin.
-- result: on_time | late | excused | absent | open | cancelled
create function public.session_roster(p_session_id uuid)
returns table (
  member_id uuid,
  display_name text,
  is_active boolean,
  attendance_id uuid,
  punched_in_at timestamptz,
  result text,
  original_status public.attendance_status,
  source public.attendance_source,
  distance_m double precision,
  accuracy_m double precision,
  excuse_source public.excuse_source,
  excuse_note text,
  fine_id uuid,
  fine_reason text,
  fine_amount_npr integer,
  fine_status public.fine_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
     or (p.is_active and (p.created_at at time zone 'Asia/Kathmandu')::date <= v_session.session_date)
  order by p.display_name;
end;
$$;

revoke execute on function public.session_roster(uuid) from public, anon;
grant execute on function public.session_roster(uuid) to authenticated;

-- The old names-and-status-only team view is replaced by session_roster().
drop function public.team_attendance(uuid);

-- Payments for the team: amounts, dates and method. Notes and void reasons stay admin-only.
create function public.team_payments(p_from date, p_to date)
returns table (
  payment_id uuid,
  member_id uuid,
  display_name text,
  amount_npr integer,
  method text,
  created_at timestamptz,
  voided boolean,
  fines_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  perform public.check_report_range(p_from, p_to);
  return query
    select pay.id, pay.member_id, p.display_name, pay.amount_npr, pay.method, pay.created_at,
      pay.voided_at is not null,
      (select count(*)::integer from public.fines f where f.payment_id = pay.id)
    from public.payments pay
    join public.profiles p on p.id = pay.member_id
    where (pay.created_at at time zone 'Asia/Kathmandu')::date between p_from and p_to
    order by pay.created_at desc;
end;
$$;

revoke execute on function public.team_payments(date, date) from public, anon;
grant execute on function public.team_payments(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Member history: excused results and absence fines
-- ---------------------------------------------------------------------------
drop function public.my_session_history();

create function public.my_session_history()
returns table (
  session_id uuid,
  session_date date,
  venue_name text,
  result text,
  original_status public.attendance_status,
  source public.attendance_source,
  punched_in_at timestamptz,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  distance_m double precision,
  fine_npr integer,
  fine_status public.fine_status,
  fine_reason text
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
    on s.session_date >= (p.created_at at time zone 'Asia/Kathmandu')::date
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
$$;

revoke execute on function public.my_session_history() from public, anon;
grant execute on function public.my_session_history() to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Team report (replaces admin_attendance_report; readable by every active member)
-- Attendance % = attended / counted sessions (excused absences still count as sessions).
-- ---------------------------------------------------------------------------
drop function public.admin_attendance_report(date, date);

create function public.team_report(p_from date, p_to date)
returns table (
  member_id uuid,
  display_name text,
  is_active boolean,
  sessions integer,
  on_time integer,
  late integer,
  absent integer,
  excused integer,
  attendance_percent integer,
  late_fines_npr integer,
  absence_fines_npr integer,
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
     and s.session_date >= (p.created_at at time zone 'Asia/Kathmandu')::date
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
$$;

revoke execute on function public.team_report(date, date) from public, anon;
grant execute on function public.team_report(date, date) to authenticated;

-- Fines export now includes absence fines (joined through the session, not attendance).
create or replace function public.admin_export_fines(p_from date, p_to date)
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
  join public.sessions s on s.id = f.session_id
  join public.profiles p on p.id = f.member_id
  where s.session_date between p_from and p_to
  order by s.session_date, p.display_name;
end;
$$;
