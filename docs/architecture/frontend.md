# Frontend Architecture

## Stack
- React + TypeScript + Vite
- React Router for page navigation
- Tailwind CSS for styling
- Supabase JS client for Auth and permitted data access
- TanStack Query is optional; adopt if caching/refetching becomes non-trivial, not automatically
- React Hook Form + Zod only where forms justify them
- Recharts only if the admin reports need charts
- Leaflet for viewing stored punch-in locations on a map; load map UI only on pages that need it
- Vitest + React Testing Library for component/unit tests; Playwright for critical user journeys

## Proposed structure
```text
src/
  app/                 # app bootstrap, providers, route definitions
  components/
    ui/                # small reusable primitives
    shared/            # common app-level components
  features/
    auth/
    dashboard/
    attendance/
    sessions/
    fines/
    payments/
    members/
    announcements/
    reports/
  layouts/              # member/admin layouts
  lib/                  # Supabase client, date/time, validation helpers
  hooks/                # shared hooks only
  types/
  styles/
```

Keep feature-specific components, hooks and service functions inside their feature folder. Do not create empty layers. Avoid a generic repository abstraction over every Supabase query unless repeated complexity proves it useful.

## Routes
Member: dashboard, punch-in, attendance history/detail, fines/payments, team attendance, profile and announcements.

Admin: dashboard, members, sessions, attendance corrections, fines, payment confirmation, reports, venue/settings, announcements and audit history.

Use route guards for UX only. RLS and server-side checks remain authoritative.

## State
Use React state for local UI state. Use TanStack Query if server data caching, invalidation and refetch coordination warrant it. Do not add Redux/Zustand at the start.

## Punch-in UX
1. Show session, venue, Nepal clock with seconds and cutoff countdown.
2. Request browser location only after explicit Punch In action.
3. Display permission state, GPS accuracy and progress.
4. Submit coordinates and accuracy to trusted backend.
5. Display server-returned timestamp/status/result.
6. If permission is denied, GPS unavailable or accuracy rejected, explain the issue and allow retry. Do not fabricate coordinates or silently fall back to IP location.

The browser clock is display-only. Attendance status must come from the server response.

## Accessibility and responsive UI
Mobile-first; accessible labels, keyboard focus, sufficient contrast, meaningful errors, loading/empty states, and no color-only status communication. Map should have a text alternative listing time, venue, accuracy and distance.
