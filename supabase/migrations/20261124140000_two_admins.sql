-- Up to two admins (owner decision 2026-11-24; was: one admin).
-- The unique index allowed exactly one admin. A trigger now allows at most two, with an advisory
-- lock so two promotions at the same moment cannot both pass. Admins are still made with SQL in
-- the Supabase dashboard; nothing in the app can promote anyone. One admin cannot deactivate
-- the other (below) or reset the other's password (admin-users Edge Function).

drop index public.profiles_single_admin;

create function public.profiles_admin_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'admin' and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
    perform pg_advisory_xact_lock(hashtext('jhusey.profiles_admin_limit'));
    if (select count(*) from public.profiles where role = 'admin' and id <> new.id) >= 2 then
      raise exception 'There can be at most two admins.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_admin_limit() from public, anon, authenticated;

create trigger profiles_admin_limit
  before insert or update of role on public.profiles
  for each row execute function public.profiles_admin_limit();

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
