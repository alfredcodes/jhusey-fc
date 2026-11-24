-- Delete a member account, keeping all history (owner decision 2026-11-24).
-- "Deleted" = the person can never sign in again and leaves the team, but every record stays:
-- attendance and punch-ins, fines, fine payments, monthly fees and fee payments, notices,
-- confirmations and the audit log. The profile row (name) stays so history still shows who it was.
-- The admin-users Edge Function calls admin_delete_member() as the admin (checks + audit), then
-- locks the login (banned) and renames it so the username can be reused.
-- Admins may delete each other (not themselves); a deleted admin loses the admin role.

alter table public.profiles
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id),
  add constraint profiles_deleted_inactive check (deleted_at is null or not is_active);

create function public.admin_delete_member(p_member_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_old public.profiles;
begin
  perform public.require_admin();
  if char_length(v_reason) < 3 or char_length(v_reason) > 300 then
    raise exception 'Give a reason (3 to 300 characters).' using errcode = '22023';
  end if;
  if p_member_id = (select auth.uid()) then
    raise exception 'You cannot delete your own account.' using errcode = '22023';
  end if;
  select * into v_old from public.profiles where id = p_member_id for update;
  if not found then
    raise exception 'Member not found.' using errcode = '22023';
  end if;
  if v_old.deleted_at is not null then
    raise exception 'This member is already deleted.' using errcode = '22023';
  end if;

  update public.profiles
  set is_active = false, role = 'member', deleted_at = now(), deleted_by = (select auth.uid())
  where id = p_member_id;

  -- Not counted for any game from today (no absences, no absence fines), like a deactivation.
  insert into public.member_inactive_periods (member_id, from_date, created_by)
  values (p_member_id, public.nepal_today(), (select auth.uid()))
  on conflict (member_id) where to_date is null do nothing;

  -- Personal contact data is not needed for history.
  update public.member_private set phone = null, must_change_password = false
  where member_id = p_member_id;

  perform public.write_audit('member.deleted', 'profile', p_member_id, v_reason,
    jsonb_build_object('display_name', v_old.display_name, 'was_admin', v_old.role = 'admin'));
end;
$$;

revoke execute on function public.admin_delete_member(uuid, text) from public, anon;
grant execute on function public.admin_delete_member(uuid, text) to authenticated;

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
  if v_old.deleted_at is not null then
    raise exception 'This member was deleted. Their history is kept, but the account cannot be changed.'
      using errcode = '22023';
  end if;
  if p_member_id = (select auth.uid()) and not p_is_active then
    raise exception 'You cannot deactivate your own admin account.' using errcode = '22023';
  end if;
  -- Admins cannot deactivate each other (two admins since 2026-11-24). Remove the admin
  -- role first (SQL in the Supabase dashboard), then deactivate.
  if v_old.role = 'admin' and v_old.is_active and not p_is_active then
    raise exception 'An admin account cannot be deactivated. Remove the admin role first.' using errcode = '22023';
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
