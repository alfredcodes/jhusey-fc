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

## Superseded decision
An earlier discussion proposed GPS + session PIN. The latest explicit user decision removed the PIN because it adds friction. Do not create PIN tables, PIN fields, PIN screens, PIN attempt limits or PIN-related Edge Functions.

## Provisional choices
- Default geofence radius 100m, subject to on-site testing.
- Map library Leaflet, only if map view is retained.
- TanStack Query only if server-state needs justify it.
- PWA as later enhancement, not a launch blocker.

## Unresolved
See `docs/planning/open-questions.md`. In particular, the NPR 200 communication penalty must not be implemented until its business meaning is explicit.
