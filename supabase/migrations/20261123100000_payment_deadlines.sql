-- Owner decision 2026-11-23: the admin edits payment deadlines in Settings -> Rules.
--   * Monthly fee: due within N days of the month's open date (default 16, was fixed at 16).
--   * Fines: pay within N days of the fine (new; empty = no deadline, as before).
-- Like every other rule, a change applies only to months opened / fines created afterwards:
-- each fee month and each fine keeps the deadline it was created with. Overdue is shown only;
-- there is no extra penalty.

alter table public.club_settings
  add column fee_due_days integer not null default 16
    constraint club_settings_fee_due_days_range check (fee_due_days between 1 and 90),
  add column fine_due_days integer
    constraint club_settings_fine_due_days_range check (fine_due_days is null or fine_due_days between 1 and 90);

-- ---------------------------------------------------------------------------
-- Fee months: keep the number of days each month was opened with
-- ---------------------------------------------------------------------------
-- due_on was "opened_on + 16"; a generated expression cannot be altered, so it is rebuilt.
-- Existing months get 16 days, which is what they were opened with.
alter table public.fee_periods drop column due_on;
alter table public.fee_periods
  add column due_days integer not null default 16
    constraint fee_periods_due_days_range check (due_days between 1 and 90);
alter table public.fee_periods alter column due_days drop default;
alter table public.fee_periods
  add column due_on date generated always as (opened_on + due_days) stored;

create or replace function public.admin_open_fee_month(p_month date, p_opened_on date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := public.check_fee_month(p_month);
  v_existing public.fee_periods;
  v_rules public.club_settings;
  v_count integer;
begin
  perform public.require_admin();
  if p_opened_on is null then
    raise exception 'Choose the open date.' using errcode = '22023';
  end if;

  select * into v_rules from public.club_settings where id;
  select * into v_existing from public.fee_periods where month = v_month for update;
  if found and v_existing.opened_on <> p_opened_on then
    raise exception 'This month was opened on %. Change the open date instead.',
      to_char(v_existing.opened_on, 'FMMon DD, YYYY') using errcode = '22023';
  end if;
  if v_existing.month is null then
    insert into public.fee_periods (month, opened_on, due_days, opened_by)
    values (v_month, p_opened_on, v_rules.fee_due_days, (select auth.uid()));
  end if;

  insert into public.member_fees (month, member_id, plan, amount_npr)
  select v_month, p.id, p.fee_plan,
    case p.fee_plan when 'partial' then v_rules.partial_fee_npr else v_rules.regular_fee_npr end
  from public.profiles p
  where p.is_active
  on conflict (month, member_id) do nothing;
  get diagnostics v_count = row_count;

  perform public.write_audit(
    case when v_existing.month is null then 'fees.month_opened' else 'fees.members_added' end,
    'fee_period', '00000000-0000-0000-0000-000000000000', null,
    jsonb_build_object('month', v_month, 'opened_on', p_opened_on,
      'due_days', coalesce(v_existing.due_days, v_rules.fee_due_days), 'fees_created', v_count));
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fines: a due date, set when the fine is created (every creation path goes through here)
-- ---------------------------------------------------------------------------
alter table public.fines add column due_on date;

create function public.fines_set_due_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.due_on is null then
    select (coalesce(new.created_at, now()) at time zone 'Asia/Kathmandu')::date + s.fine_due_days
    into new.due_on
    from public.club_settings s
    where s.id and s.fine_due_days is not null;
  end if;
  return new;
end;
$$;

revoke execute on function public.fines_set_due_on() from public, anon, authenticated;

create trigger fines_set_due_on
  before insert on public.fines
  for each row execute function public.fines_set_due_on();

-- ---------------------------------------------------------------------------
-- One admin RPC for fee amounts and both deadlines (replaces admin_update_fee_amounts)
-- ---------------------------------------------------------------------------
drop function public.admin_update_fee_amounts(integer, integer);

create function public.admin_update_payment_settings(
  p_regular_npr integer,
  p_partial_npr integer,
  p_fee_due_days integer,
  p_fine_due_days integer
)
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
    -- pg-safeupdate (loaded for API requests) needs the WHERE clause.
    update public.club_settings
    set regular_fee_npr = p_regular_npr, partial_fee_npr = p_partial_npr,
        fee_due_days = p_fee_due_days, fine_due_days = p_fine_due_days,
        updated_at = now(), updated_by = (select auth.uid())
    where id;
  exception when check_violation or not_null_violation then
    raise exception 'Fees must be NPR 1 to 100,000 and deadlines 1 to 90 days.' using errcode = '22023';
  end;
  perform public.write_audit('payments.settings_updated', 'club_settings',
    '00000000-0000-0000-0000-000000000000', null,
    jsonb_build_object(
      'from', jsonb_build_object('regular_fee_npr', v_old.regular_fee_npr,
        'partial_fee_npr', v_old.partial_fee_npr, 'fee_due_days', v_old.fee_due_days,
        'fine_due_days', v_old.fine_due_days),
      'to', jsonb_build_object('regular_fee_npr', p_regular_npr, 'partial_fee_npr', p_partial_npr,
        'fee_due_days', p_fee_due_days, 'fine_due_days', p_fine_due_days)));
end;
$$;

revoke execute on function public.admin_update_payment_settings(integer, integer, integer, integer) from public, anon;
grant execute on function public.admin_update_payment_settings(integer, integer, integer, integer) to authenticated;
