-- Phase 3: venues and the session calendar.
--
-- Access model:
--   * Active members (including the admin) read venues and sessions.
--   * Only the admin creates or changes them. Inactive accounts and anon see nothing.
--   * The 19:15:00 Asia/Kathmandu cutoff is a fixed business rule, so it is NOT stored per session.
--   * At most one session per calendar date.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Today's date in Nepal, from the database clock. Phase 4 punch-in uses the same function.
create function public.nepal_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kathmandu')::date;
$$;

-- True when the caller has an active profile. security definer for the same
-- reason as is_admin(): it reads profiles from inside other tables' policies.
create function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active
  );
$$;

revoke execute on function public.nepal_today() from public, anon;
grant execute on function public.nepal_today() to authenticated;
revoke execute on function public.is_active_member() from public, anon;
grant execute on function public.is_active_member() to authenticated;

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint venues_name_length check (char_length(btrim(name)) between 1 and 80),
  latitude double precision not null
    constraint venues_latitude_range check (latitude between -90 and 90),
  longitude double precision not null
    constraint venues_longitude_range check (longitude between -180 and 180),
  -- 100 m is provisional (open question 3); bounds stop obvious typos.
  geofence_radius_m integer not null default 100
    constraint venues_radius_range check (geofence_radius_m between 20 and 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.venues is
  'Futsal venues. Coordinates may be edited; Phase 4 attendance rows snapshot the values they used.';

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create type public.session_status as enum ('scheduled', 'cancelled');

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null
    constraint sessions_one_per_date unique,
  venue_id uuid not null references public.venues (id),
  status public.session_status not null default 'scheduled',
  note text
    constraint sessions_note_length check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_venue_id_idx on public.sessions (venue_id);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants (remove Supabase's broad defaults, then grant only what RLS will filter)
-- ---------------------------------------------------------------------------
revoke all on table public.venues, public.sessions from anon, authenticated;
grant select, insert, update on table public.venues to authenticated;
grant select, insert, update, delete on table public.sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.venues enable row level security;
alter table public.sessions enable row level security;

create policy "Active members read venues"
  on public.venues for select to authenticated
  using ((select public.is_active_member()));

create policy "Admin creates venues"
  on public.venues for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admin updates venues"
  on public.venues for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Active members read sessions"
  on public.sessions for select to authenticated
  using ((select public.is_active_member()));

create policy "Admin creates sessions"
  on public.sessions for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admin updates sessions"
  on public.sessions for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Once attendance references a session (Phase 4), its foreign key blocks deletion;
-- the admin should cancel instead.
create policy "Admin deletes sessions"
  on public.sessions for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Session generator: create a session on each chosen weekday in a date range.
-- security invoker: runs with the caller's rights, so the RLS insert policy
-- still applies. The explicit admin check just gives a clearer error.
-- Weekdays use PostgreSQL numbering: 0 = Sunday ... 6 = Saturday.
-- Existing dates are skipped, so running it twice is harmless.
-- ---------------------------------------------------------------------------
create function public.admin_create_sessions(
  p_venue_id uuid,
  p_from date,
  p_to date,
  p_weekdays integer[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_created integer;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can create sessions.' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose a valid date range.' using errcode = '22023';
  end if;

  if p_from < public.nepal_today() then
    raise exception 'Sessions cannot start in the past.' using errcode = '22023';
  end if;

  if p_to - p_from > 180 then
    raise exception 'Create at most 180 days of sessions at a time.' using errcode = '22023';
  end if;

  if p_weekdays is null
     or cardinality(p_weekdays) = 0
     or not (p_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]) then
    raise exception 'Choose at least one weekday.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.venues where id = p_venue_id and is_active) then
    raise exception 'Choose an active venue.' using errcode = '22023';
  end if;

  insert into public.sessions (session_date, venue_id)
  select day::date, p_venue_id
  from generate_series(p_from, p_to, interval '1 day') as day
  where extract(dow from day)::integer = any (p_weekdays)
  on conflict (session_date) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke execute on function public.admin_create_sessions(uuid, date, date, integer[]) from public, anon;
grant execute on function public.admin_create_sessions(uuid, date, date, integer[]) to authenticated;
