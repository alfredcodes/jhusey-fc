# Implementation Roadmap

No implementation starts until the user approves Phase 1.

## Status
- Phase 1 foundation: done 2026-11-21
- Phase 2 Supabase auth and permissions: done 2026-11-22
- Phase 3 sessions and venue: done 2026-11-22
- Phase 4 punch-in and late fines: done 2026-11-22
- Phases 5-7: not started

## Phase 0 - Preparation (this pack)
- Confirm architecture and business rules.
- Resolve open questions.
- Set up repository and local developer tools after approval.

## Phase 1 - Foundation
- Create Vite React TypeScript project.
- Add formatting/lint/typecheck/test scripts.
- Establish routes, layouts, design tokens and environment example.
- No production credentials or deployment.

## Phase 2 - Supabase foundation and authentication
- Initialize local Supabase configuration/migrations.
- Create profiles and role model.
- Implement member login, password reset and controlled single-admin bootstrap.
- Add and test RLS before exposing data.

## Phase 3 - Sessions and venue
- Venue settings with coordinates and radius.
- Recurring session generation/management.
- Fixed 19:15 Nepal cutoff; not editable per session.

## Phase 4 - Attendance engine
- GPS permission request on explicit Punch In.
- Server-side coordinate/accuracy validation and distance calculation.
- Server timestamp and On Time/Late classification.
- Unique attendance constraint.
- NPR 50 late fine in same transaction.
- Boundary, GPS and concurrency tests.

## Phase 5 - Member experience
- Personal dashboard from database records.
- Punch-in history and map details.
- Fine/payment history.
- Team attendance summary with GPS privacy.

## Phase 6 - Admin operations
- Member management.
- Session and venue management.
- Attendance view and audited corrections.
- Fine waiver and manual payment confirmation.
- Announcements and basic notifications if approved.

## Phase 7 - Reports and launch readiness
- Attendance and financial summaries.
- RLS/security regression suite.
- Mobile browser QA at venue.
- Backup/export and recovery test.
- Deploy static frontend to Cloudflare Pages after explicit approval.

## Suggested commit sequence
- `chore: initialise React TypeScript Vite project`
- `feat: configure Supabase authentication`
- `feat: implement member and admin permissions`
- `feat: implement futsal session management`
- `feat: implement GPS punch-in validation`
- `feat: implement secure attendance processing`
- `feat: implement personal attendance history`
- `feat: implement automatic late fines`
- `feat: implement manual payment management`
- `feat: implement admin reporting`
- `test: add attendance and RLS regression coverage`
- `chore: configure production deployment`
