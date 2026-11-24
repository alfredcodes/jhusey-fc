-- Fix: saving the rules or the fee amounts failed with "UPDATE requires a WHERE clause".
-- Supabase loads pg-safeupdate for API (PostgREST) requests, which rejects any UPDATE without
-- a WHERE clause, even inside functions. club_settings has one row (id = true), so the updates
-- now say so explicitly. Behaviour is otherwise unchanged.

create or replace function public.admin_update_rules(
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
  select * into v_old from public.club_settings where id for update;

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
    where id
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

create or replace function public.admin_update_fee_amounts(p_regular_npr integer, p_partial_npr integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.club_settings;
begin
  perform public.require_admin();
  select * into v_old from public.club_settings where id for update;
  begin
    update public.club_settings
    set regular_fee_npr = p_regular_npr, partial_fee_npr = p_partial_npr,
        updated_at = now(), updated_by = (select auth.uid())
    where id;
  exception when check_violation or not_null_violation then
    raise exception 'Fee amounts must be between NPR 1 and 100,000.' using errcode = '22023';
  end;
  perform public.write_audit('fees.amounts_updated', 'club_settings', '00000000-0000-0000-0000-000000000000', null,
    jsonb_build_object(
      'from', jsonb_build_object('regular_fee_npr', v_old.regular_fee_npr, 'partial_fee_npr', v_old.partial_fee_npr),
      'to', jsonb_build_object('regular_fee_npr', p_regular_npr, 'partial_fee_npr', p_partial_npr)));
end;
$$;
