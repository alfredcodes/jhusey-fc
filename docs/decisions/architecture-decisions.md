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
| Team attendance view | `security definer` RPC returning name + status only | A `security_invoker` view would apply own-row RLS and show only the caller |

## Superseded decision
An earlier discussion proposed GPS + session PIN. The latest explicit user decision removed the PIN because it adds friction. Do not create PIN tables, PIN fields, PIN screens, PIN attempt limits or PIN-related Edge Functions.

## Provisional choices
- Default geofence radius 100m, subject to on-site testing.
- Map library Leaflet, only if map view is retained.
- Prefer an OpenStreetMap link over embedding Leaflet for showing a punch-in location.
- PWA as later enhancement, not a launch blocker.

## Unresolved
See `docs/planning/open-questions.md`. In particular, the NPR 200 communication penalty must not be implemented until its business meaning is explicit.
