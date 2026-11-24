-- Owner decision 2026-11-22: members must say "Can't come" before 9 PM (Nepal time) on the
-- day before the game, instead of midnight. Withdrawing a notice has the same deadline.
-- The admin can still excuse anyone later, with a reason (admin_excuse_absence, unchanged).

-- True while members may still give or withdraw a notice for a game on p_session_date.
-- p_now is a parameter so tests can use a fixed clock.
create function public.absence_notice_open(p_session_date date, p_now timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_now < (((p_session_date - 1) + time '21:00') at time zone 'Asia/Kathmandu');
$$;

revoke execute on function public.absence_notice_open(date, timestamptz) from public, anon, authenticated;

create or replace function public.notify_absence(p_session_id uuid, p_note text)
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
  if not public.absence_notice_open(v_session.session_date) then
    raise exception 'Absence notices close at 9 PM the day before the game. Contact the admin.'
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

create or replace function public.withdraw_absence(p_session_id uuid)
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
    and public.absence_notice_open(s.session_date);

  if not found then
    raise exception 'There is no absence notice you can withdraw for that session.'
      using errcode = '22023';
  end if;
end;
$$;
