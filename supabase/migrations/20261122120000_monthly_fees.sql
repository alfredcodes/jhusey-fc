-- Monthly membership fees, kept separate from fines (owner decisions 2026-11-22):
--   * Two fee plans, Regular and Partial. The admin edits both amounts (defaults NPR 800 / 400)
--     and puts each member on one plan.
--   * The admin opens each month by choosing its open date. Every active member then gets a
--     fee for that month at their plan's CURRENT amount; later changes to plans or amounts
--     never change a fee that already exists (the admin can adjust one, with a reason).
--   * A fee is due within 16 days of the open date. There is no late penalty.
--   * Members may pay in instalments. A payment can never exceed the remaining balance.
--   * The admin can exempt a member for a month, with a reason the whole team can read.
--   * Mistaken payments are voided with a reason, never deleted.
--   * Team transparency: active members read every fee, its status and payments (amount, date,
--     method). Payment notes and void reasons stay with the admin.
--   * All writes go through admin RPCs that write the audit log.

-- ---------------------------------------------------------------------------
-- 1. Plans and amounts
-- ---------------------------------------------------------------------------
create type public.fee_plan as enum ('regular', 'partial');

alter table public.club_settings
  add column regular_fee_npr integer not null default 800
    constraint club_settings_regular_fee_range check (regular_fee_npr between 1 and 100000),
  add column partial_fee_npr integer not null default 400
    constraint club_settings_partial_fee_range check (partial_fee_npr between 1 and 100000);

-- Members only have UPDATE on display_name, so they cannot change their own plan.
alter table public.profiles
  add column fee_plan public.fee_plan not null default 'regular';

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table public.fee_periods (
  month date primary key
    constraint fee_periods_first_of_month check (month = date_trunc('month', month)::date),
  opened_on date not null,
  -- "Paid within 16 days of the open date."
  due_on date generated always as (opened_on + 16) stored,
  opened_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.member_fees (
  id uuid primary key default gen_random_uuid(),
  month date not null references public.fee_periods (month),
  member_id uuid not null references public.profiles (id),
  plan public.fee_plan not null,
  amount_npr integer not null constraint member_fees_amount_range check (amount_npr between 1 and 100000),
  exempt_at timestamptz,
  exempt_by uuid references public.profiles (id),
  exempt_reason text,
  created_at timestamptz not null default now(),
  constraint member_fees_one_per_month unique (month, member_id),
  constraint member_fees_exempt_fields check (
    (exempt_at is null and exempt_by is null and exempt_reason is null)
    or (exempt_at is not null and exempt_by is not null
        and char_length(btrim(exempt_reason)) between 3 and 300)
  )
);

create index member_fees_member_id_idx on public.member_fees (member_id);

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  member_fee_id uuid not null references public.member_fees (id),
  amount_npr integer not null constraint fee_payments_amount_positive check (amount_npr > 0),
  method text not null
    constraint fee_payments_method_known check (method in ('cash', 'bank_transfer', 'wallet', 'other')),
  paid_on date not null,
  note text constraint fee_payments_note_length check (note is null or char_length(note) <= 200),
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  constraint fee_payments_void_fields check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  )
);

create index fee_payments_member_fee_id_idx on public.fee_payments (member_fee_id);

-- ---------------------------------------------------------------------------
-- 3. Grants and RLS: read-only for active members, no direct writes for anyone
-- ---------------------------------------------------------------------------
revoke all on table public.fee_periods, public.member_fees, public.fee_payments from anon, authenticated;
grant select on table public.fee_periods, public.member_fees to authenticated;
-- Notes and void reasons stay with the admin (read through admin_fee_payment_notes()).
grant select (id, member_fee_id, amount_npr, method, paid_on, recorded_by, created_at, voided_at)
  on table public.fee_payments to authenticated;

alter table public.fee_periods enable row level security;
alter table public.member_fees enable row level security;
alter table public.fee_payments enable row level security;

create policy "Active members read fee months"
  on public.fee_periods for select to authenticated
  using ((select public.is_active_member()));

create policy "Active members read the team's fees"
  on public.member_fees for select to authenticated
  using ((select public.is_active_member()));

create policy "Active members read the team's fee payments"
  on public.fee_payments for select to authenticated
  using ((select public.is_active_member()));

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------
create function public.fee_paid_npr(p_member_fee_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(amount_npr), 0)::integer
  from public.fee_payments
  where member_fee_id = p_member_fee_id and voided_at is null;
$$;

create function public.check_fee_month(p_month date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_month is null then
    raise exception 'Choose a month.' using errcode = '22023';
  end if;
  return date_trunc('month', p_month)::date;
end;
$$;

revoke execute on function public.fee_paid_npr(uuid) from public, anon, authenticated;
revoke execute on function public.check_fee_month(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Team ledger for one month (status computed by the server)
-- ---------------------------------------------------------------------------
create function public.fee_ledger(p_month date)
returns table (
  member_fee_id uuid,
  member_id uuid,
  display_name text,
  is_active boolean,
  plan public.fee_plan,
  amount_npr integer,
  paid_npr integer,
  balance_npr integer,
  status text,
  exempt_reason text,
  due_on date,
  last_paid_on date
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
  return query
    with paid as (
      select mf.id,
        coalesce(sum(fp.amount_npr) filter (where fp.voided_at is null), 0)::integer as paid,
        max(fp.paid_on) filter (where fp.voided_at is null) as last_paid_on
      from public.member_fees mf
      left join public.fee_payments fp on fp.member_fee_id = mf.id
      where mf.month = public.check_fee_month(p_month)
      group by mf.id
    )
    select mf.id, mf.member_id, p.display_name, p.is_active, mf.plan, mf.amount_npr,
      paid.paid,
      case when mf.exempt_at is not null then 0 else mf.amount_npr - paid.paid end,
      case
        when mf.exempt_at is not null then 'exempt'
        when paid.paid >= mf.amount_npr then 'paid'
        when public.nepal_today() > fp.due_on then 'overdue'
        when paid.paid > 0 then 'partial'
        else 'due'
      end,
      mf.exempt_reason, fp.due_on, paid.last_paid_on
    from public.member_fees mf
    join paid on paid.id = mf.id
    join public.profiles p on p.id = mf.member_id
    join public.fee_periods fp on fp.month = mf.month
    order by p.display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Admin RPCs
-- ---------------------------------------------------------------------------

-- Fee amounts for future months. Existing fees keep their amount.
create function public.admin_update_fee_amounts(p_regular_npr integer, p_partial_npr integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.club_settings;
begin
  perform public.require_admin();
  select * into v_old from public.club_settings for update;
  begin
    update public.club_settings
    set regular_fee_npr = p_regular_npr, partial_fee_npr = p_partial_npr,
        updated_at = now(), updated_by = (select auth.uid());
  exception when check_violation or not_null_violation then
    raise exception 'Fee amounts must be between NPR 1 and 100,000.' using errcode = '22023';
  end;
  perform public.write_audit('fees.amounts_updated', 'club_settings', '00000000-0000-0000-0000-000000000000', null,
    jsonb_build_object(
      'from', jsonb_build_object('regular_fee_npr', v_old.regular_fee_npr, 'partial_fee_npr', v_old.partial_fee_npr),
      'to', jsonb_build_object('regular_fee_npr', p_regular_npr, 'partial_fee_npr', p_partial_npr)));
end;
$$;

-- Put a member on a plan. Applies to months opened afterwards.
create function public.admin_set_fee_plan(p_member_id uuid, p_plan public.fee_plan)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.fee_plan;
begin
  perform public.require_admin();
  if p_plan is null then
    raise exception 'Choose a plan.' using errcode = '22023';
  end if;
  select fee_plan into v_old from public.profiles where id = p_member_id for update;
  if not found then
    raise exception 'Member not found.' using errcode = '22023';
  end if;
  update public.profiles set fee_plan = p_plan where id = p_member_id;
  perform public.write_audit('member.fee_plan_set', 'profile', p_member_id, null,
    jsonb_build_object('from', v_old, 'to', p_plan));
end;
$$;

-- Open a month: one fee per active member at their plan's current amount. Running it again
-- for an opened month only adds active members who have no fee yet (e.g. new joiners).
create function public.admin_open_fee_month(p_month date, p_opened_on date)
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

  select * into v_existing from public.fee_periods where month = v_month for update;
  if found and v_existing.opened_on <> p_opened_on then
    raise exception 'This month was opened on %. Change the open date instead.',
      to_char(v_existing.opened_on, 'FMMon DD, YYYY') using errcode = '22023';
  end if;
  if not found then
    insert into public.fee_periods (month, opened_on, opened_by)
    values (v_month, p_opened_on, (select auth.uid()));
  end if;

  select * into v_rules from public.club_settings;
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
    jsonb_build_object('month', v_month, 'opened_on', p_opened_on, 'fees_created', v_count));
  return v_count;
end;
$$;

-- Correct the open date (and so the due date) of an opened month.
create function public.admin_change_fee_open_date(p_month date, p_opened_on date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := public.check_fee_month(p_month);
  v_reason text;
  v_old date;
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);
  if p_opened_on is null then
    raise exception 'Choose the open date.' using errcode = '22023';
  end if;
  select opened_on into v_old from public.fee_periods where month = v_month for update;
  if not found then
    raise exception 'This month has not been opened.' using errcode = '22023';
  end if;
  update public.fee_periods set opened_on = p_opened_on where month = v_month;
  perform public.write_audit('fees.open_date_changed', 'fee_period', '00000000-0000-0000-0000-000000000000',
    v_reason, jsonb_build_object('month', v_month, 'from', v_old, 'to', p_opened_on));
end;
$$;

-- Change one member's fee for one month (e.g. wrong plan). Never below what is already paid.
create function public.admin_adjust_member_fee(p_member_fee_id uuid, p_amount_npr integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_fee public.member_fees;
  v_paid integer;
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);
  select * into v_fee from public.member_fees where id = p_member_fee_id for update;
  if not found then
    raise exception 'Fee not found.' using errcode = '22023';
  end if;
  v_paid := public.fee_paid_npr(v_fee.id);
  if p_amount_npr is null or p_amount_npr < greatest(v_paid, 1) or p_amount_npr > 100000 then
    raise exception 'The fee must be between NPR % (already paid) and 100,000.', greatest(v_paid, 1)
      using errcode = '22023';
  end if;
  update public.member_fees set amount_npr = p_amount_npr where id = v_fee.id;
  perform public.write_audit('fee.adjusted', 'member_fee', v_fee.id, v_reason,
    jsonb_build_object('member_id', v_fee.member_id, 'month', v_fee.month,
      'from', v_fee.amount_npr, 'to', p_amount_npr));
end;
$$;

-- Record a payment (full or instalment). It may not exceed the remaining balance.
create function public.admin_record_fee_payment(
  p_member_fee_id uuid, p_amount_npr integer, p_method text, p_paid_on date, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee public.member_fees;
  v_balance integer;
  v_id uuid;
begin
  perform public.require_admin();
  -- Lock the fee so two payments cannot both fit the same balance.
  select * into v_fee from public.member_fees where id = p_member_fee_id for update;
  if not found then
    raise exception 'Fee not found.' using errcode = '22023';
  end if;
  if v_fee.exempt_at is not null then
    raise exception 'This member is exempt for this month.' using errcode = '22023';
  end if;
  v_balance := v_fee.amount_npr - public.fee_paid_npr(v_fee.id);
  if v_balance <= 0 then
    raise exception 'This fee is already paid in full.' using errcode = '22023';
  end if;
  if p_amount_npr is null or p_amount_npr < 1 or p_amount_npr > v_balance then
    raise exception 'Enter an amount between NPR 1 and NPR % (the balance).', v_balance
      using errcode = '22023';
  end if;
  if p_paid_on is null or p_paid_on > public.nepal_today() then
    raise exception 'The payment date cannot be in the future.' using errcode = '22023';
  end if;

  begin
    insert into public.fee_payments (member_fee_id, amount_npr, method, paid_on, note, recorded_by)
    values (v_fee.id, p_amount_npr, p_method, p_paid_on, nullif(btrim(p_note), ''), (select auth.uid()))
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'Choose a payment method and keep the note under 200 characters.'
      using errcode = '22023';
  end;

  perform public.write_audit('fee_payment.recorded', 'fee_payment', v_id, null,
    jsonb_build_object('member_id', v_fee.member_id, 'month', v_fee.month,
      'amount_npr', p_amount_npr, 'method', p_method, 'paid_on', p_paid_on));
  return v_id;
end;
$$;

create function public.admin_void_fee_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_payment public.fee_payments;
  v_fee public.member_fees;
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);
  select * into v_payment from public.fee_payments where id = p_payment_id for update;
  if not found or v_payment.voided_at is not null then
    raise exception 'Only an active payment can be voided.' using errcode = '22023';
  end if;
  select * into v_fee from public.member_fees where id = v_payment.member_fee_id;
  update public.fee_payments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where id = v_payment.id;
  perform public.write_audit('fee_payment.voided', 'fee_payment', v_payment.id, v_reason,
    jsonb_build_object('member_id', v_fee.member_id, 'month', v_fee.month,
      'amount_npr', v_payment.amount_npr));
end;
$$;

-- Exempt a member for a month. Void any payments first so the money trail stays clear.
create function public.admin_exempt_fee(p_member_fee_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_fee public.member_fees;
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);
  select * into v_fee from public.member_fees where id = p_member_fee_id for update;
  if not found then
    raise exception 'Fee not found.' using errcode = '22023';
  end if;
  if v_fee.exempt_at is not null then
    raise exception 'This member is already exempt for this month.' using errcode = '22023';
  end if;
  if public.fee_paid_npr(v_fee.id) > 0 then
    raise exception 'This fee has payments. Void them before exempting the member.' using errcode = '22023';
  end if;
  update public.member_fees
  set exempt_at = now(), exempt_by = (select auth.uid()), exempt_reason = v_reason
  where id = v_fee.id;
  perform public.write_audit('fee.exempted', 'member_fee', v_fee.id, v_reason,
    jsonb_build_object('member_id', v_fee.member_id, 'month', v_fee.month));
end;
$$;

create function public.admin_unexempt_fee(p_member_fee_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_fee public.member_fees;
begin
  perform public.require_admin();
  v_reason := public.require_reason(p_reason);
  select * into v_fee from public.member_fees where id = p_member_fee_id for update;
  if not found or v_fee.exempt_at is null then
    raise exception 'This member is not exempt for this month.' using errcode = '22023';
  end if;
  update public.member_fees
  set exempt_at = null, exempt_by = null, exempt_reason = null
  where id = v_fee.id;
  perform public.write_audit('fee.exemption_removed', 'member_fee', v_fee.id, v_reason,
    jsonb_build_object('member_id', v_fee.member_id, 'month', v_fee.month,
      'was', v_fee.exempt_reason));
end;
$$;

-- Payment notes and void reasons for one month (admin only).
create function public.admin_fee_payment_notes(p_month date)
returns table (payment_id uuid, note text, void_reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select fp.id, fp.note, fp.void_reason
    from public.fee_payments fp
    join public.member_fees mf on mf.id = fp.member_fee_id
    where mf.month = public.check_fee_month(p_month);
end;
$$;

revoke execute on function public.fee_ledger(date) from public, anon;
revoke execute on function public.admin_update_fee_amounts(integer, integer) from public, anon;
revoke execute on function public.admin_set_fee_plan(uuid, public.fee_plan) from public, anon;
revoke execute on function public.admin_open_fee_month(date, date) from public, anon;
revoke execute on function public.admin_change_fee_open_date(date, date, text) from public, anon;
revoke execute on function public.admin_adjust_member_fee(uuid, integer, text) from public, anon;
revoke execute on function public.admin_record_fee_payment(uuid, integer, text, date, text) from public, anon;
revoke execute on function public.admin_void_fee_payment(uuid, text) from public, anon;
revoke execute on function public.admin_exempt_fee(uuid, text) from public, anon;
revoke execute on function public.admin_unexempt_fee(uuid, text) from public, anon;
revoke execute on function public.admin_fee_payment_notes(date) from public, anon;
grant execute on function public.fee_ledger(date) to authenticated;
grant execute on function public.admin_update_fee_amounts(integer, integer) to authenticated;
grant execute on function public.admin_set_fee_plan(uuid, public.fee_plan) to authenticated;
grant execute on function public.admin_open_fee_month(date, date) to authenticated;
grant execute on function public.admin_change_fee_open_date(date, date, text) to authenticated;
grant execute on function public.admin_adjust_member_fee(uuid, integer, text) to authenticated;
grant execute on function public.admin_record_fee_payment(uuid, integer, text, date, text) to authenticated;
grant execute on function public.admin_void_fee_payment(uuid, text) to authenticated;
grant execute on function public.admin_exempt_fee(uuid, text) to authenticated;
grant execute on function public.admin_unexempt_fee(uuid, text) to authenticated;
grant execute on function public.admin_fee_payment_notes(date) to authenticated;
