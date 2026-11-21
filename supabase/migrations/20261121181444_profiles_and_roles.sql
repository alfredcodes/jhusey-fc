-- Phase 2: member profiles, the single-admin role model and row level security.
--
-- Access model:
--   * Every auth user gets exactly one profile, created by a trigger (never by the browser).
--   * Members read and rename only their own profile. They can never change role or is_active.
--   * The admin reads all profiles. Admin member-management writes arrive later as audited RPCs.
--   * anon has no access at all.
-- RLS controls rows, and column-level GRANTs control which columns may be written.

create type public.app_role as enum ('admin', 'member');

create table public.profiles (
  -- Deleting an auth user removes the profile. Once attendance/fines reference profiles,
  -- those foreign keys block deletion, so history is preserved: deactivate instead.
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  role public.app_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per team member, linked to auth.users.';

-- Confirmed decision: one admin account initially. The database enforces it.
-- Drop this index only if multi-admin is explicitly approved.
create unique index profiles_single_admin on public.profiles ((true)) where role = 'admin';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user.
-- security definer: runs as the function owner so it can insert while the
-- inviting/signing-up session has no INSERT grant on profiles.
-- The role is always 'member'; user metadata is never trusted for the role.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions are never called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- is_admin(): used by RLS policies on this and later tables.
-- security definer avoids infinite recursion (a profiles policy that queries
-- profiles under RLS). Inactive accounts are never treated as admin.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
  );
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: Supabase gives anon/authenticated broad default table privileges.
-- Remove them and grant back only what is needed.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Members read own profile; admin reads all"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Members update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT or DELETE policies: with RLS enabled, those operations are denied.
