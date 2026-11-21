# Jhusey FC - Project Instructions

## Purpose
Jhusey FC is a private futsal team management app for approximately 24 members in Nepal simple code not complexibility, not heavy code. It manages member accounts, recurring sessions, GPS punch-in, attendance, fines, manual payment records, announcements and reports.

## Stack
- React + TypeScript + Vite
- Supabase Auth + PostgreSQL + Row Level Security
- Supabase Edge Functions or PostgreSQL RPC for sensitive server-side operations
- Tailwind CSS; use a small accessible component layer only where it saves work
- React Router
- TanStack Query only for server-state caching if justified by the first implementation
- Vitest + React Testing Library; Playwright for critical end-to-end flows
- Cloudflare Pages for static frontend hosting

## Source of truth
Read the relevant files under `docs/` before implementing. `docs/decisions/architecture-decisions.md` records confirmed decisions. Do not silently change them.

## Non-negotiable business rules
- Timezone: `Asia/Kathmandu`; currency: NPR.
- Fixed attendance cutoff: 7:15:00 PM Nepal time for every session.
- A server timestamp at or before 19:15:00 is On Time. 19:15:01 or later is Late.
- Late fine: NPR 50.
- Punch-in uses GPS only. There is no session PIN, QR code, manual code or second verification step.
- Capture location only when the member taps Punch In. No background or continuous tracking.
- Store server-generated punch-in time, received coordinates, accuracy, configured venue and server-calculated distance. Do not trust the browser clock or client-calculated attendance status/distance.
- Members can inspect their own complete punch-in history. Members must not edit attendance, timestamps, GPS, fines or payment records.
- Members may see team attendance status, but not other members' precise GPS coordinates, private contact details or payment evidence.
- One admin account initially. No public admin registration. Do not build multi-admin workflows unless explicitly approved.
- NPR 200 communication-related penalty is unresolved. Do not implement it until its trigger, evidence, deadline and waiver rules are confirmed.
- Admin corrections must preserve original attendance evidence and record who changed what, when and why.

## Security rules
- Never expose Supabase secret/service-role keys in browser code, Vite variables or committed files.
- Enable RLS for every exposed table and write explicit grants/policies for each operation.
- Enforce role permissions in PostgreSQL/RLS and trusted server code, not only route guards.
- Sensitive punch-in processing must use trusted server time and server-side venue-distance calculation.
- Validate inputs with schemas; rate-limit or otherwise protect sensitive endpoints where appropriate.
- Treat GPS as useful evidence, not proof against spoofing. Do not claim it prevents all cheating.
- Keep secrets in local environment variables or Supabase project secrets. Commit only `.env.example`.
- Never mutate production data, link a production Supabase project, deploy, or change billing without explicit approval.

## Development rules
- Inspect the existing repository and relevant files before editing.
- Do not scaffold or implement features until the user approves the Phase 1 plan.
- Keep the architecture proportionate to a 24-member private team. No microservices, Redux by default, GraphQL, Docker production stack, payment gateway or unnecessary abstraction.
- Use migrations for database changes. Do not rely on dashboard-only schema edits.
- Prefer feature-oriented folders and simple service boundaries.
- Do not add a dependency unless it solves a concrete requirement.
- Do not run destructive commands, overwrite existing work, or change global Claude Code settings without approval.
- Run and report actual typecheck, lint, tests and build commands relevant to changes. Never claim a check passed unless it ran successfully.
- Use conventional, specific commit messages when asked to commit.

## Documentation
- Keep this file concise. Load detailed docs only when relevant.
- Update the relevant architecture/business-rule document when an approved decision changes.
- Keep unresolved questions explicit in `docs/planning/open-questions.md`.
- At handoff, report changed files, checks actually run, remaining risks and next step.
