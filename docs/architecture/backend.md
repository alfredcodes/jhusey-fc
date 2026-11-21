# Backend Architecture

## Recommendation
Use Supabase Auth + PostgreSQL as the backend. Do not introduce a separate Node/Express/Nest server for this project.

## Data access
- Browser Supabase client uses only the project URL and publishable/anon key.
- RLS controls which rows authenticated members/admin can read or modify.
- Simple safe reads can use Supabase Data API.
- Sensitive punch-in and admin actions must run through a trusted PostgreSQL function (RPC) or Edge Function with authenticated identity and narrowly scoped permissions.
- Prefer a database transaction for attendance plus fine creation, so a failure cannot leave attendance without its required fine or vice versa.

## Punch-in operation responsibilities
1. Derive user identity from verified auth context; do not accept a member ID supplied by the browser as authoritative.
2. Check the account is an active member.
3. Check the session is eligible for punch-in and the member has not already punched in.
4. Read configured venue coordinates/radius from the database.
5. Validate coordinate ranges and reported accuracy.
6. Calculate distance server-side using stored venue coordinates and submitted GPS coordinates.
7. Reject outside the approved radius or unacceptable accuracy.
8. Obtain timestamp from PostgreSQL/server, not browser input.
9. Classify On Time/Late using the fixed Nepal cutoff.
10. Insert attendance and, if late, the NPR 50 fine in one transaction.
11. Return timestamp, status, distance, accuracy and a user-friendly result.

## RPC vs Edge Function
For this app, a PostgreSQL function is a good first choice when the entire transaction is database work. Use an Edge Function if orchestration, rate limiting, external services or more complex HTTP validation becomes necessary. Avoid implementing the same business rule in both places.

## Authentication
Individual member accounts. One admin account initially. No public admin signup or self-promotion. Bootstrap the admin through a controlled setup process after approval. Password reset must use verified email. Enable MFA for the admin if feasible.

## Operations
Use versioned migrations. Develop locally with Supabase CLI and a container runtime when available; otherwise use a dedicated non-production Supabase project. Do not connect to or mutate production during preparation.
