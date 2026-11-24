-- Games created by mistake / cancelled games (owner request 2026-11-24).
-- 1. Cancelling a game waives its unpaid automatic absence fines (a cancelled game has no
--    absentees). Each waiver is in the audit log, like a manual Waive. Restoring the game does
--    not bring them back and the absence-fine job will not re-create them.
-- 2. admin_delete_session(): delete a game created by mistake, with a reason. Its automatic
--    absence fines (unpaid or waived) go with it. Refused if anyone punched in or any fine of
--    that game was paid: then the game is real history and must be cancelled instead.
-- 3. One-off: games already cancelled get the same waiver now.

-- Who to record in the audit log: the signed-in admin, or the first admin for automatic work.
create function public.audit_actor()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()),
    (select id from public.profiles where role = 'admin' order by created_at limit 1)
  )
$$;
revoke execute on function public.audit_actor() from public, anon, authenticated;

create function public.waive_absence_fines_of_session(p_session_id uuid, p_reason text, p_automatic boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fine public.fines;
  v_count integer := 0;
begin
  for v_fine in
    update public.fines set status = 'waived'
    where session_id = p_session_id and reason = 'absence' and status = 'pending'
    returning *
  loop
    insert into public.audit_log (actor_id, action, entity, entity_id, reason, details)
    values (public.audit_actor(), 'fine.waived', 'fine', v_fine.id, p_reason,
      jsonb_build_object('member_id', v_fine.member_id, 'amount_npr', v_fine.amount_npr,
        'session_id', p_session_id, 'automatic', p_automatic));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.waive_absence_fines_of_session(uuid, text, boolean) from public, anon, authenticated;

create function public.sessions_cancel_waives_absences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.waive_absence_fines_of_session(new.id, 'Game cancelled', true);
  end if;
  return new;
end;
$$;
revoke execute on function public.sessions_cancel_waives_absences() from public, anon, authenticated;

create trigger sessions_cancel_waives_absences
  after update of status on public.sessions
  for each row execute function public.sessions_cancel_waives_absences();

create function public.admin_delete_session(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_session public.sessions;
  v_removed integer;
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Game not found.' using errcode = '22023';
  end if;
  if exists (select 1 from public.attendance where session_id = p_session_id) then
    raise exception 'Someone punched in for this game, so it is part of the history. Cancel it instead.'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.fines where session_id = p_session_id
             and (reason <> 'absence' or status = 'paid')) then
    raise exception 'A fine for this game was already paid. Cancel the game instead.'
      using errcode = '22023';
  end if;

  delete from public.fines where session_id = p_session_id and reason = 'absence';
  get diagnostics v_removed = row_count;
  -- Notices ("Can't come") and partial-player confirmations go with the game (on delete cascade).
  delete from public.sessions where id = p_session_id;

  perform public.write_audit('session.deleted', 'session', p_session_id, v_reason,
    jsonb_build_object('session_date', v_session.session_date, 'status', v_session.status,
      'absence_fines_removed', v_removed));
end;
$$;
revoke execute on function public.admin_delete_session(uuid, text) from public, anon;
grant execute on function public.admin_delete_session(uuid, text) to authenticated;

-- One-off: games that are already cancelled.
select public.waive_absence_fines_of_session(id, 'Game cancelled', true)
from public.sessions where status = 'cancelled';
