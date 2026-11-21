# Architecture Overview

## Recommendation
Build one responsive React SPA backed by Supabase. Host the static Vite build on Cloudflare Pages. Keep all application data in one PostgreSQL database. Do not add a separate Express/Nest API server.

```text
Member/Admin browser
  └─ React + TypeScript + Vite
       ├─ Supabase Auth (user session)
       ├─ Supabase Data API + RLS (permitted reads and simple writes)
       └─ Trusted punch-in operation
            └─ PostgreSQL transaction / RPC or Supabase Edge Function
                 ├─ validate authenticated member
                 ├─ load session and venue
                 ├─ use server timestamp in Asia/Kathmandu rules
                 ├─ calculate distance from stored venue coordinates
                 ├─ insert immutable attendance evidence
                 └─ create NPR 50 late fine atomically when applicable

Cloudflare Pages serves the frontend. Supabase hosts Auth and PostgreSQL.
```

## Main responsibilities
- **React:** presentation, route protection for user experience, forms, live clock/countdown, requesting browser geolocation after a user action, displaying member/admin data.
- **Supabase Auth:** sign-in, password reset and session identity.
- **PostgreSQL/RLS:** durable data, relational constraints and row-level access control.
- **Trusted backend operation:** punch-in validation, server timestamp, geofence calculation, attendance classification and automatic fine creation.
- **Cloudflare Pages:** static frontend hosting and HTTPS delivery.

## Why this fits
Approximately 24 users and a private internal workflow do not justify a distributed backend. Supabase provides PostgreSQL, authentication and RLS in one service. React/Vite is straightforward for a developer learning React and produces a static frontend suitable for Pages.

## Important limitations
- GPS is not tamper-proof. Browser coordinates can be inaccurate or spoofed. Record accuracy and distance and describe them as evidence, not proof.
- Supabase Free can pause after a week of inactivity and has finite quotas. A low-activity sports team may encounter this exact inactivity rule.
- A single admin account creates a recovery/single-person dependency. Document recovery and protect the account.
- Do not treat client-side route guards as security; database permissions must enforce access.

## Deployment boundary
Use a development Supabase project/local stack first. Never link or push migrations to production until the user explicitly approves. Cloudflare Pages can deploy from Git integration after the repository and project are approved. The initial `pages.dev` project subdomain is provider-assigned and its exact slug availability is not guaranteed.

## Non-goals for initial release
No session PIN, QR code, payment gateway, real-time chat, microservices, native mobile app, continuous location tracking, complex notification pipeline or elaborate multi-agent orchestration.
