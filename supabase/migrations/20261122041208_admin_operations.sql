-- Phase 6: admin operations with an audit trail.
--
-- Confirmed 2026-11-22:
--   * One payment covers one or more WHOLE pending fines; no partial payments.
--   * The admin may record attendance for a member (e.g. dead phone): marked
--     source = 'admin', with a reason and no GPS. Same 19:15 rule and NPR 50 fine.
-- Design:
--   * Punch-in evidence is immutable (trigger). Only the current status may change,
--     through admin_correct_attendance(); original_status keeps the first result.
--   * Every admin action writes public.audit_log (who, what, when, why).
--   * Payment mistakes are voided with a reason, never deleted.
--   * All writes go through security definer RPCs that start with require_admin().

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do this.' using errcode = '42501';
  end if;
end;
$$;

create function public.require_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'Give a reason (at least 3 characters).' using errcode = '22023';
  end if;
  if char_length(p_reason) > 300 then
    raise exception 'Keep the reason under 300 characters.' using errcode = '22023';
  end if;
  return btrim(p_reason);
end;
$$;

revoke execute on function public.require_admin() from public, anon, authenticated;
revoke execute on function public.require_reason(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit log (admin-readable, written only by the RPCs below)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id uuid not null,
  reason text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

create function public.write_audit(
  p_action text, p_entity text, p_entity_id uuid, p_reason text, p_details jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, reason, details)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, p_reason, coalesce(p_details, '{}'));
$$;

revoke execute on function public.write_audit(text, text, uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Attendance: admin-recorded rows, original status, immutable evidence
-- ---------------------------------------------------------------------------
create type public.attendance_source as enum ('gps', 'admin');

alter table public.attendance
  alter column latitude drop not null,
  alter column longitude drop not null,
  alter column accuracy_m drop not null,
  alter column distance_m drop not null,
  add column source public.attendance_source not null default 'gps',
  add column recorded_by uuid references public.profiles (id),
  add column manual_reason text,
  add column original_status public.attendance_status;

update public.attendance set original_status = status;
alter table public.attendance alter column original_status set not null;

alter table public.attendance add constraint attendance_source_fields check (
  (source = 'gps'
    and latitude is not null and longitude is not null
    and accuracy_m is not null and distance_m is not null
    and recorded_by is null and manual_reason is null)
  or
  (source = 'admin'
    and latitude is null and longitude is null
    and accuracy_m is null and distance_m is null
    and recorded_by is not null
    and char_length(btrim(manual_reason)) between 3 and 300)
);

-- The first result is kept forever, whoever inserts the row.
create function public.attendance_set_original_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.original_status := new.status;
  return new;
end;
$$;

create trigger attendance_original_status
  before insert on public.attendance
  for each row execute function public.attendance_set_original_status();

-- Evidence never changes after insert; only the current status may (via correction).
create function public.attendance_protect_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.id, new.member_id, new.session_id, new.venue_id, new.punched_in_at,
         new.latitude, new.longitude, new.accuracy_m, new.distance_m,
         new.venue_latitude, new.venue_longitude, new.venue_radius_m, new.venue_max_accuracy_m,
         new.source, new.recorded_by, new.manual_reason, new.original_status, new.created_at)
     is distinct from
     row(old.id, old.member_id, old.session_id, old.venue_id, old.punched_in_at,
         old.latitude, old.longitude, old.accuracy_m, old.distance_m,
         old.venue_latitude, old.venue_longitude, old.venue_radius_m, old.venue_max_accuracy_m,
         old.source, old.recorded_by, old.manual_reason, old.original_status, old.created_at)
  then
    raise exception 'Attendance evidence cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger attendance_evidence_immutable
  before update on public.attendance
  for each row execute function public.attendance_protect_evidence();

revoke execute on function public.attendance_set_original_status() from public, anon, authenticated;
revoke execute on function public.attendance_protect_evidence() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id),
  amount_npr integer not null constraint payments_amount_positive check (amount_npr > 0),
  method text not null
    constraint payments_method_known check (method in ('cash', 'bank_transfer', 'wallet', 'other')),
  note text constraint payments_note_length check (note is null or char_length(note) <= 200),
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  constraint payments_void_fields check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  )
);

create index payments_member_id_idx on public.payments (member_id);

alter table public.fines
  add column payment_id uuid references public.payments (id),
  add constraint fines_paid_has_payment check ((status = 'paid') = (payment_id is not null));

create index fines_payment_id_idx on public.fines (payment_id);

revoke all on table public.payments, public.audit_log from anon, authenticated;
grant select on table public.payments, public.audit_log to authenticated;

alter table public.payments enable row level security;
alter table public.audit_log enable row level security;

create policy "Members read own payments; admin reads all"
  on public.payments for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admin reads the audit log"
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

-- Rename / activate / deactivate a member. History is kept; nothing is deleted.
create function public.admin_update_member(
  p_member_id uuid, p_display_name text, p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

  perform public.write_audit('member.updated', 'profile', p_member_id, null,
    jsonb_build_object(
      'from', jsonb_build_object('display_name', v_old.display_name, 'is_active', v_old.is_active),
      'to', jsonb_build_object('display_name', btrim(p_display_name), 'is_active', p_is_active)));
end;
$$;

-- Change the current On Time/Late status. Late -> On Time waives the pending fine;
-- On Time -> Late creates (or reinstates) the NPR 50 fine. Evidence is untouched.
create function public.admin_correct_attendance(
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
      insert into public.fines (member_id, attendance_id, reason, amount_npr)
      values (v_row.member_id, v_row.id, 'late', 50);
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

-- Record attendance without GPS (e.g. a member's phone died at the venue).
-- p_arrived_at is the Nepal wall-clock arrival time on the session date.
create function public.admin_record_attendance(
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
    insert into public.fines (member_id, attendance_id, reason, amount_npr)
    values (p_member_id, v_attendance.id, 'late', 50);
  end if;

  perform public.write_audit('attendance.recorded', 'attendance', v_attendance.id, v_reason,
    jsonb_build_object('member_id', p_member_id, 'session_id', v_session.id,
      'arrived_at', p_arrived_at, 'status', v_status));
  return v_status;
end;
$$;

create function public.admin_waive_fine(p_fine_id uuid, p_reason text)
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

  select * into v_fine from public.fines where id = p_fine_id for update;
  if not found or v_fine.status <> 'pending' then
    raise exception 'Only a pending fine can be waived.' using errcode = '22023';
  end if;

  update public.fines set status = 'waived' where id = v_fine.id;
  perform public.write_audit('fine.waived', 'fine', v_fine.id, v_reason,
    jsonb_build_object('member_id', v_fine.member_id, 'amount_npr', v_fine.amount_npr));
end;
$$;

-- One payment for one or more whole pending fines of one member. Amount = their total.
create function public.admin_record_payment(
  p_member_id uuid, p_fine_ids uuid[], p_method text, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_total integer;
  v_payment_id uuid;
begin
  perform public.require_admin();

  if p_fine_ids is null or cardinality(p_fine_ids) = 0 then
    raise exception 'Choose at least one fine.' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(p_fine_ids) x) <> cardinality(p_fine_ids) then
    raise exception 'A fine was selected twice.' using errcode = '22023';
  end if;

  -- Lock the fines so two payments cannot claim the same fine at once.
  perform 1 from public.fines where id = any (p_fine_ids) for update;

  select count(*), coalesce(sum(amount_npr), 0) into v_count, v_total
  from public.fines
  where id = any (p_fine_ids) and member_id = p_member_id and status = 'pending';

  if v_count <> cardinality(p_fine_ids) then
    raise exception 'Every selected fine must be pending and belong to this member.'
      using errcode = '22023';
  end if;

  begin
    insert into public.payments (member_id, amount_npr, method, note, recorded_by)
    values (p_member_id, v_total, p_method, nullif(btrim(p_note), ''), (select auth.uid()))
    returning id into v_payment_id;
  exception when check_violation then
    raise exception 'Choose a payment method and keep the note under 200 characters.'
      using errcode = '22023';
  end;

  update public.fines set status = 'paid', payment_id = v_payment_id where id = any (p_fine_ids);

  perform public.write_audit('payment.recorded', 'payment', v_payment_id, null,
    jsonb_build_object('member_id', p_member_id, 'amount_npr', v_total,
      'method', p_method, 'fine_ids', to_jsonb(p_fine_ids)));
  return v_payment_id;
end;
$$;

-- Undo a mistaken payment: the record stays (marked void) and its fines become pending.
create function public.admin_void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_payment public.payments;
  v_fine_ids uuid[];
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.voided_at is not null then
    raise exception 'Only an active payment can be voided.' using errcode = '22023';
  end if;

  select array_agg(id) into v_fine_ids from public.fines where payment_id = v_payment.id;
  update public.fines set status = 'pending', payment_id = null where payment_id = v_payment.id;
  update public.payments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where id = v_payment.id;

  perform public.write_audit('payment.voided', 'payment', v_payment.id, v_reason,
    jsonb_build_object('member_id', v_payment.member_id, 'amount_npr', v_payment.amount_npr,
      'fine_ids', to_jsonb(v_fine_ids)));
end;
$$;

revoke execute on function public.admin_update_member(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_correct_attendance(uuid, public.attendance_status, text) from public, anon;
revoke execute on function public.admin_record_attendance(uuid, uuid, time, text) from public, anon;
revoke execute on function public.admin_waive_fine(uuid, text) from public, anon;
revoke execute on function public.admin_record_payment(uuid, uuid[], text, text) from public, anon;
revoke execute on function public.admin_void_payment(uuid, text) from public, anon;
grant execute on function public.admin_update_member(uuid, text, boolean) to authenticated;
grant execute on function public.admin_correct_attendance(uuid, public.attendance_status, text) to authenticated;
grant execute on function public.admin_record_attendance(uuid, uuid, time, text) to authenticated;
grant execute on function public.admin_waive_fine(uuid, text) to authenticated;
grant execute on function public.admin_record_payment(uuid, uuid[], text, text) to authenticated;
grant execute on function public.admin_void_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Member history now also says how each record was made and whether it was corrected.
-- (Return type changes, so the function is recreated.)
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
    a.original_status,
    a.source,
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
    and (s.status = 'scheduled' or a.id is not null)
  order by s.session_date desc;
$$;

revoke execute on function public.my_session_history() from public, anon;
grant execute on function public.my_session_history() to authenticated;
