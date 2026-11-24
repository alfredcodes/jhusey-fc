# Proposed Database Schema

This is a design proposal, not an executed migration.

## Review notes (2026-11-21) - apply when the relevant phase is planned
- `profiles.phone`: RLS is row-level, so a phone in a team-readable row is readable by teammates. Drop it or move it to an admin-only table (open question 18).
- `profiles.role`: members must have no UPDATE grant on it; grant column-level updates only (e.g. `display_name`) if needed.
- `fines.rule_code` should reference `fine_rules(code)`; store money as whole-rupee `integer`.
- Merge `attendance_corrections` into a single `audit_log` (actor, action, entity, old/new `jsonb`, reason) written only by admin RPCs. A Late→On Time correction must waive the fine in the same transaction.
- `location_verified` is redundant while outside-radius punch-ins are rejected; keep only if manual admin attendance is approved (open question 15).
- `payments.fine_id not null` allows only one fine per payment; see open question 17.
- Snapshot venue coordinates/radius on attendance, or never edit a venue in place, so stored distances remain explainable.

## Relationships
```text
auth.users 1---1 profiles
venues 1---many sessions
profiles 1---many attendance
sessions 1---many attendance
attendance 1---0..1 fines (late incident)
profiles 1---many fines
fines 1---many payments
profiles(admin) 1---many attendance_corrections
profiles(admin) 1---many audit_logs
```

## Table outline
### profiles
- `id uuid primary key references auth.users(id)`
- `display_name text not null`
- `phone text null` (private)
- `role text not null check (role in ('admin','member'))`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

### venues
- `id uuid primary key`
- `name text not null`
- `latitude double precision not null`
- `longitude double precision not null`
- `geofence_radius_m integer not null default 100`
- `is_active boolean not null default true`

The 100m radius is a provisional starting value inherited from the planning discussion; validate at the actual venue and make configurable.

### sessions
- `id uuid primary key`
- `session_date date not null`
- `venue_id uuid not null references venues(id)`
- `status text not null`
- `created_at timestamptz not null default now()`

If the schedule includes start/end display times, store them separately. Attendance cutoff remains fixed at 19:15:00 Nepal time and is not an editable per-session field.

### attendance
- `id uuid primary key`
- `member_id uuid not null references profiles(id)`
- `session_id uuid not null references sessions(id)`
- `venue_id uuid not null references venues(id)`
- `punched_in_at timestamptz not null default now()`
- `latitude double precision not null`
- `longitude double precision not null`
- `accuracy_m double precision not null`
- `distance_m double precision not null`
- `location_verified boolean not null`
- `attendance_status text not null check (attendance_status in ('on_time','late'))`
- `created_at timestamptz not null default now()`
- unique (`member_id`, `session_id`)

The trusted punch-in function must supply validated values. Do not allow members to write this table directly.

### attendance_corrections
- `id uuid primary key`
- `attendance_id uuid not null references attendance(id)`
- `admin_id uuid not null references profiles(id)`
- `reason text not null`
- `old_values jsonb not null`
- `new_values jsonb not null`
- `created_at timestamptz not null default now()`

### fine_rules
- `id uuid primary key`
- `code text unique not null`
- `description text not null`
- `amount_npr numeric(10,2) not null`
- `is_active boolean not null default true`

### fines
- `id uuid primary key`
- `member_id uuid not null references profiles(id)`
- `attendance_id uuid null references attendance(id)`
- `rule_code text not null`
- `amount_npr numeric(10,2) not null`
- `status text not null check (status in ('pending','paid','waived'))`
- `created_at timestamptz not null default now()`
- unique where appropriate to prevent duplicate fine per attendance incident.

### payments
- `id uuid primary key`
- `fine_id uuid not null references fines(id)`
- `amount_npr numeric(10,2) not null`
- `payment_method text null`
- `reference text null`
- `evidence_path text null`
- `recorded_by uuid not null references profiles(id)`
- `confirmed_at timestamptz null`
- `created_at timestamptz not null default now()`

### member_inactive_periods (2026-11-24)
- `member_id`, `from_date` (deactivation day), `to_date` (day before reactivation; null = still inactive)
- One open period per member. Written only by `admin_update_member`; admin read-only via RLS.
- `member_counted_on(member, joined_at, date)` is used by team_report, team_monthly_summary,
  session_roster, my_session_history and the absence-fine job.

### Remaining tables
Add `absence_notifications`, `announcements`, `notifications` and `audit_logs` only when their first-release workflows are defined. Avoid speculative tables with no implemented use case.

## Indexes
Index foreign keys and common filters: attendance `(member_id, session_id)`, `(session_id, attendance_status)`, fines `(member_id, status)`, payments `(fine_id)`, sessions `(session_date)`.
