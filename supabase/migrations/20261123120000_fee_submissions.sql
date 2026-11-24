-- Members submit their monthly fee payment for the admin to approve (owner request 2026-11-23).
--   * Online (bank transfer / wallet): the member uploads a screenshot or receipt (max 2 MB,
--     JPEG/PNG/WebP/PDF) to the private `payment-proofs` bucket, in a folder named after them.
--   * Cash: the member says they paid cash; no file.
--   * Nothing is paid until the admin approves. Approval records an ordinary fee payment through
--     admin_record_fee_payment() (same balance checks and audit log); rejection needs a reason.
--   * One pending submission per member fee at a time; none for a paid or exempt fee.
--   * Proofs and submissions are visible to the member and the admin only. Teammates keep seeing
--     amounts and statuses through the fee ledger.
-- Uses Supabase Storage on the free tier; no paid service.

-- ---------------------------------------------------------------------------
-- 1. Private bucket for proofs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 2 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Members upload only into their own folder (<user id>/...). Nobody can overwrite or delete
-- through the API (no UPDATE/DELETE policies): a proof is evidence.
create policy "Active members upload their own payment proofs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_member())
  );

create policy "Members read their own payment proofs; the admin reads all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

-- ---------------------------------------------------------------------------
-- 2. Submissions
-- ---------------------------------------------------------------------------
create table public.fee_submissions (
  id uuid primary key default gen_random_uuid(),
  member_fee_id uuid not null references public.member_fees (id),
  member_id uuid not null references public.profiles (id),
  amount_npr integer not null constraint fee_submissions_amount_positive check (amount_npr > 0),
  method text not null
    constraint fee_submissions_method_known check (method in ('cash', 'bank_transfer', 'wallet')),
  proof_path text,
  status text not null default 'pending'
    constraint fee_submissions_status_known check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  review_note text constraint fee_submissions_review_note_length
    check (review_note is null or char_length(review_note) <= 300),
  fee_payment_id uuid references public.fee_payments (id),
  constraint fee_submissions_proof_for_online check ((method = 'cash') = (proof_path is null)),
  constraint fee_submissions_review_fields
    check ((status = 'pending') = (reviewed_at is null and reviewed_by is null)),
  constraint fee_submissions_approved_has_payment
    check ((status = 'approved') = (fee_payment_id is not null)),
  constraint fee_submissions_rejected_has_reason
    check (status <> 'rejected' or char_length(btrim(review_note)) >= 3)
);

-- No duplicates: one submission waiting for approval per member fee.
create unique index fee_submissions_one_pending
  on public.fee_submissions (member_fee_id) where status = 'pending';
create index fee_submissions_member_id_idx on public.fee_submissions (member_id);
create index fee_submissions_status_idx on public.fee_submissions (status);

revoke all on table public.fee_submissions from anon, authenticated;
grant select on table public.fee_submissions to authenticated;
alter table public.fee_submissions enable row level security;

create policy "Members read their own submissions; the admin reads all"
  on public.fee_submissions for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 3. Member: submit a payment for one of their own fees
-- ---------------------------------------------------------------------------
create function public.submit_fee_payment(
  p_member_fee_id uuid, p_amount_npr integer, p_method text, p_proof_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_fee public.member_fees;
  v_balance integer;
  v_proof text := nullif(btrim(p_proof_path), '');
  v_id uuid;
begin
  if not public.is_active_member() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  -- Lock the fee so a submission and an admin payment cannot race.
  select * into v_fee from public.member_fees where id = p_member_fee_id for update;
  if not found or v_fee.member_id <> v_uid then
    raise exception 'Choose one of your own monthly fees.' using errcode = '22023';
  end if;
  if v_fee.exempt_at is not null then
    raise exception 'You are exempt for this month; there is nothing to pay.' using errcode = '22023';
  end if;
  v_balance := v_fee.amount_npr - public.fee_paid_npr(v_fee.id);
  if v_balance <= 0 then
    raise exception 'This month is already paid in full.' using errcode = '22023';
  end if;
  if exists (select 1 from public.fee_submissions
             where member_fee_id = v_fee.id and status = 'pending') then
    raise exception 'You already have a payment waiting for approval for this month.'
      using errcode = '22023';
  end if;
  if p_amount_npr is null or p_amount_npr < 1 or p_amount_npr > v_balance then
    raise exception 'Enter an amount between NPR 1 and NPR % (your balance).', v_balance
      using errcode = '22023';
  end if;

  if p_method = 'cash' then
    v_proof := null;
  elsif p_method in ('bank_transfer', 'wallet') then
    if v_proof is null then
      raise exception 'Attach a screenshot or receipt of the payment.' using errcode = '22023';
    end if;
    -- The file must be one this member uploaded to their own folder.
    if split_part(v_proof, '/', 1) <> v_uid::text
       or not exists (select 1 from storage.objects
                      where bucket_id = 'payment-proofs' and name = v_proof) then
      raise exception 'Upload the receipt again, then submit.' using errcode = '22023';
    end if;
  else
    raise exception 'Choose cash, bank transfer or wallet.' using errcode = '22023';
  end if;

  begin
    insert into public.fee_submissions (member_fee_id, member_id, amount_npr, method, proof_path)
    values (v_fee.id, v_uid, p_amount_npr, p_method, v_proof)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You already have a payment waiting for approval for this month.'
      using errcode = '22023';
  end;

  perform public.write_audit('fee_submission.created', 'fee_submission', v_id, null,
    jsonb_build_object('member_id', v_uid, 'month', v_fee.month,
      'amount_npr', p_amount_npr, 'method', p_method));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Admin: approve (records the payment) or reject (with a reason)
-- ---------------------------------------------------------------------------
create function public.admin_review_fee_submission(p_submission_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.fee_submissions;
  v_note text;
  v_payment_id uuid;
begin
  perform public.require_admin();
  select * into v_sub from public.fee_submissions where id = p_submission_id for update;
  if not found or v_sub.status <> 'pending' then
    raise exception 'Only a submission waiting for approval can be reviewed.' using errcode = '22023';
  end if;

  if p_approve then
    v_note := nullif(btrim(p_note), '');
    -- Same rules as a payment the admin records by hand (balance, exemption, audit log).
    v_payment_id := public.admin_record_fee_payment(
      v_sub.member_fee_id, v_sub.amount_npr, v_sub.method,
      (v_sub.created_at at time zone 'Asia/Kathmandu')::date,
      left(concat_ws(' · ', 'Submitted by member', v_note), 200));
    update public.fee_submissions
    set status = 'approved', reviewed_at = now(), reviewed_by = (select auth.uid()),
        review_note = v_note, fee_payment_id = v_payment_id
    where id = v_sub.id;
  else
    v_note := public.require_reason(p_note);
    update public.fee_submissions
    set status = 'rejected', reviewed_at = now(), reviewed_by = (select auth.uid()),
        review_note = v_note
    where id = v_sub.id;
  end if;

  perform public.write_audit(
    case when p_approve then 'fee_submission.approved' else 'fee_submission.rejected' end,
    'fee_submission', v_sub.id, case when p_approve then null else v_note end,
    jsonb_build_object('member_id', v_sub.member_id, 'amount_npr', v_sub.amount_npr,
      'method', v_sub.method, 'fee_payment_id', v_payment_id));
end;
$$;

revoke execute on function public.submit_fee_payment(uuid, integer, text, text) from public, anon;
revoke execute on function public.admin_review_fee_submission(uuid, boolean, text) from public, anon;
grant execute on function public.submit_fee_payment(uuid, integer, text, text) to authenticated;
grant execute on function public.admin_review_fee_submission(uuid, boolean, text) to authenticated;
