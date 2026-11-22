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
| Attendance deadline | Fixed 19:15:00 | All sessions currently use same cutoff |
| Deadline boundary | 19:15:00 inclusive On Time | Late starts 19:15:01 |
| Late fine | NPR 50 | Confirmed |
| Punch-in verification | GPS only | No Session PIN; location captured at punch-in |
| Location capture | On explicit Punch In only | No continuous/background tracking |
| Admin | One admin account initially | No multi-admin workflows for MVP |
| Payment | Manual admin confirmation | No payment gateway in MVP |
| Domain | `jhusey-fc.com` preferred, not purchased/assumed | Free provider subdomain first |
| Sensitive operations | PostgreSQL RPC, no Edge Functions | One transaction for attendance + fine; one place for business rules (2026-11-21) |
| Local development DB | Supabase CLI local stack on Docker Desktop | Enables `db reset` and local pgTAP/RLS tests (2026-11-21) |
| Member onboarding | Admin invites members from Supabase Dashboard; public sign-ups disabled | No custom user-management code; members create their own password via the invite (2026-11-21) |
| Auth email | Custom SMTP through Resend | Supabase built-in email only reaches project team addresses at a low rate limit (2026-11-21) |
| Tooling | oxlint (Vite template default), Prettier, Vitest + Testing Library | Phase 1, 2026-11-21 |
| Server state | TanStack Query from Phase 2 | Avoids hand-rolled fetch/loading/error effects |
| Sessions | At most one per calendar date; admin generates by date range + weekdays; cancel (reversible) rather than delete once attendance exists | Phase 3, 2026-11-22 |
| Venue and session data | Entered by the admin in the app, not hard-coded | Phase 3, 2026-11-22 |
| Punch-in window | 18:30:00-21:00:00 Nepal time on the session date | Phase 4, 2026-11-22 |
| Cutoff precision | Server time truncated to whole seconds; 19:15:00.999 is On Time | Phase 4, 2026-11-22 |
| GPS accuracy limit | 50 m default, per venue, admin-editable | Phase 4, 2026-11-22 |
| Punch-in operation | punch_in() RPC: auth.uid() + now(); attendance + NPR 50 fine in one transaction; venue settings snapshotted on each attendance row | Phase 4, 2026-11-22 |
| Absence | Derived, never stored: a scheduled session after its window closes (21:00) with no punch-in, counted only from the member's join date; no fine | Phase 5, 2026-11-22 |
| Payments | One payment = one or more whole pending fines of one member; no partial payments; voided (never deleted) with a reason, fines return to pending | Phase 6, 2026-11-22 |
| Manual attendance | Admin records arrival time + reason; source = admin, no GPS; same 19:15 rule and NPR 50 fine | Phase 6, 2026-11-22 |
| Corrections | Evidence columns immutable (trigger); only current status changes, original_status kept; Late→On time waives the pending fine, On time→Late creates/reinstates it; blocked while the fine is paid | Phase 6, 2026-11-22 |
| Audit | Single audit_log written by every admin RPC (actor, action, entity, reason, details); admin read-only | Phase 6, 2026-11-22 |
| Team attendance view | `team_attendance()` security definer RPC returning display name + status only, for members who punched in | A `security_invoker` view would apply own-row RLS and show only the caller |

## Superseded decision
An earlier discussion proposed GPS + session PIN. The latest explicit user decision removed the PIN because it adds friction. Do not create PIN tables, PIN fields, PIN screens, PIN attempt limits or PIN-related Edge Functions.

## Provisional choices
- Default geofence radius 100m, subject to on-site testing.
- Map library Leaflet, only if map view is retained.
- Prefer an OpenStreetMap link over embedding Leaflet for showing a punch-in location.
- PWA as later enhancement, not a launch blocker.

## Unresolved
See `docs/planning/open-questions.md`. In particular, the NPR 200 communication penalty must not be implemented until its business meaning is explicit.
