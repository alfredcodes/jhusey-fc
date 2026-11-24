# Architecture Decision Record

## Confirmed decisions
| Decision | Chosen option | Reason/status |
|---|---|---|
| Frontend | React + TypeScript + Vite | Lightweight SPA; suitable for learning and static hosting |
| Backend | Supabase | Auth + PostgreSQL + RLS without a separate API server |
| Database | PostgreSQL | Relational attendance/fines/payments and transactional rules |
| Hosting | Cloudflare Pages | Free static hosting tier and `pages.dev` project subdomain |
| Timezone | `Asia/Kathmandu` | Nepal local business rules |
| Currency | NPR | Team accounting |
| Attendance deadline | 19:15:00 default, admin-editable in `club_settings` (2026-11-22) | Applies to new punch-ins only |
| Deadline boundary | 19:15:00 inclusive On Time | Late starts 19:15:01 |
| Late fine | NPR 50 default, admin-editable (2026-11-22) | Stored amount on each fine never changes |
| Punch-in verification | GPS only | No Session PIN; location captured at punch-in |
| Location capture | On explicit Punch In only | No continuous/background tracking |
| Admin | Up to two admins (2026-11-24; was one). Set with SQL only; admins cannot deactivate each other or reset each other's password | Owner decision 2026-11-24; enforced by trigger `profiles_admin_limit` |
| Payment | Manual admin confirmation | No payment gateway in MVP |
| Domain | `jhusey-fc.com` preferred, not purchased/assumed | Free provider subdomain first |
| Sensitive operations | PostgreSQL RPC; one Edge Function `admin-users` for account creation and password reset (2026-11-22) | Creating users needs the service-role key, which must stay server-side |
| Local development DB | Supabase CLI local stack on Docker Desktop | Enables `db reset` and local pgTAP/RLS tests (2026-11-21) |
| Member onboarding | **Superseded 2026-11-22:** admin adds the member in the app with an initial password (shown once); the member must change it at first sign-in; public sign-ups disabled | Zero cost: no email service. (Was: dashboard invites + Resend SMTP.) |
| Password reset | Admin sets a temporary password from Members; must-change at next sign-in | No email; Supabase built-in email is too limited and Resend needs a paid/owned domain |
| Cost | Zero-cost only: Supabase free, Cloudflare Pages free, Google Fonts, no paid APIs | Owner requirement 2026-11-22 |
| Tooling | oxlint (Vite template default), Prettier, Vitest + Testing Library | Phase 1, 2026-11-21 |
| Server state | TanStack Query from Phase 2 | Avoids hand-rolled fetch/loading/error effects |
| Sessions | At most one per calendar date; admin generates by date range + weekdays; cancel (reversible) rather than delete once attendance exists | Phase 3, 2026-11-22 |
| Venue and session data | Entered by the admin in the app, not hard-coded | Phase 3, 2026-11-22 |
| Punch-in window | 18:30:00-21:00:00 Nepal time on the session date | Phase 4, 2026-11-22 |
| Cutoff precision | Server time truncated to whole seconds; 19:15:00.999 is On Time | Phase 4, 2026-11-22 |
| GPS accuracy limit | 50 m default, per venue, admin-editable | Phase 4, 2026-11-22 |
| Punch-in operation | punch_in() RPC: auth.uid() + now(); attendance + NPR 50 fine in one transaction; venue settings snapshotted on each attendance row | Phase 4, 2026-11-22 |
| Absence | Derived: a scheduled session after its window closes with no punch-in, counted from the member's join date, excluding inactive periods (2026-11-24: deactivation no longer piles up absences or fines). **Since 2026-11-22:** NPR 100 (editable) absence fine unless excused; created by pg_cron every 15 min after close, only for sessions on/after `absence_fines_from` | Owner decision 2026-11-22 |
| Delete member | Soft delete: profile + all history kept, login banned and renamed (username reusable), phone cleared, reason in audit. Admins may delete each other, never themselves; a deleted admin loses the role | Owner decision 2026-11-24 |
| Partial players | Confirm each game ("I'm coming", 9 PM deadline); expected only at confirmed or attended games; fee and punch-in rules unchanged | Owner decision 2026-11-24 |
| Excuses | `absence_excuses`: member notice until 9 PM Nepal time the day before the game (owner decision 2026-11-22, was midnight; can withdraw until then; `absence_notice_open()`); admin excuse any time with a reason, waiving a pending absence fine | Owner decision 2026-11-22 |
| Payments | One payment = one or more whole pending fines of one member; no partial payments; voided (never deleted) with a reason, fines return to pending | Phase 6, 2026-11-22 |
| Fee submissions | `fee_submissions` + private Storage bucket `payment-proofs` (2 MB; JPG/PNG/WebP/PDF; insert/select only in the member's own folder, admin reads all; no update/delete). `submit_fee_payment()` (own fee, balance, one pending per fee, proof exists) and `admin_review_fee_submission()` (approve → `admin_record_fee_payment()`; reject needs a reason). In-app bell notifications only | Owner request 2026-11-23 |
| Member sign-in | Username (or phone number as username) + password; stored as `<username>@members.jhusey-fc.invalid` because Supabase Auth needs an email; no email or SMS is ever sent. Admin may keep a real email login | Owner decision 2026-11-23 |
| Fine deadline | `club_settings.fine_due_days` (admin-editable, empty = no deadline, the default). A BEFORE INSERT trigger sets `fines.due_on` = Nepal date of the fine + days, so every creation path gets it and later changes never move it. Unpaid after that shows Overdue; no extra penalty | Owner decision 2026-11-23 |
| Monthly fees | Separate from fines: `fee_periods`, `member_fees`, `fee_payments`. Regular/Partial plans, amounts admin-editable (default NPR 800/400), plan per member. Admin opens each month with an open date; each active member gets a fee at the current plan amount (snapshot; single fees adjustable with a reason). Due = open date + `fee_due_days` (admin-editable, default 16, snapshotted per month as `fee_periods.due_days`, 2026-11-23); no late penalty. Instalments allowed, never above the balance; voided (never deleted) with a reason. Exempt per month with a team-visible reason. Team reads the ledger via `fee_ledger()`; payment notes and void reasons admin-only | Owner decision 2026-11-22 |
| Manual attendance | Admin records arrival time + reason; source = admin, no GPS; same 19:15 rule and NPR 50 fine | Phase 6, 2026-11-22 |
| Corrections | Evidence columns immutable (trigger); only current status changes, original_status kept; Late→On time waives the pending fine, On time→Late creates/reinstates it; blocked while the fine is paid | Phase 6, 2026-11-22 |
| Audit | Single audit_log written by every admin RPC (actor, action, entity, reason, details); admin read-only | Phase 6, 2026-11-22 |
| Team transparency | Active members read all profiles, fines, excuses (not notes), `session_roster()`, `team_payments()`, `team_report()`, `team_monthly_summary()`. GPS rows and payment notes stay own/admin | Owner decision 2026-11-22; replaces the names-only team view below |
| PWA | Installable app (manifest + hand-written service worker, no dependency). Network-first pages, cached app files, "New version → Reload" banner, offline notice. Never caches Supabase data. No push notifications | 2026-11-24 |
| UI | Google Stitch light design (Inter, blue #2563eb); one shared layout for members and admin with admin controls hidden for members | 2026-11-22 |
| ~~Team attendance view~~ (superseded) | `team_attendance()` security definer RPC returning display name + status only, for members who punched in | A `security_invoker` view would apply own-row RLS and show only the caller |

## Superseded decision
An earlier discussion proposed GPS + session PIN. The latest explicit user decision removed the PIN because it adds friction. Do not create PIN tables, PIN fields, PIN screens, PIN attempt limits or PIN-related Edge Functions.

## Provisional choices
- Default geofence radius 100m, subject to on-site testing.
- Map library Leaflet, only if map view is retained.
- Prefer an OpenStreetMap link over embedding Leaflet for showing a punch-in location.
- PWA as later enhancement, not a launch blocker.

## Unresolved
See `docs/planning/open-questions.md`. In particular, the NPR 200 communication penalty must not be implemented until its business meaning is explicit.
