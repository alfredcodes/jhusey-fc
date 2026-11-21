---
name: database-migration
description: Design and review Jhusey FC PostgreSQL/Supabase migrations, constraints, RLS policies and database tests. Use whenever schema, policies, RPCs or database permissions change.
---

# Database Migration Workflow

1. Read `CLAUDE.md`, `docs/architecture/database.md`, `docs/database/schema.md` and `docs/database/security-policies.md`.
2. Inspect current migrations and schema before proposing changes.
3. Make migrations additive and repeatable where possible; never edit an already-applied migration without an explicit recovery plan.
4. Include constraints, indexes, grants and RLS policies in the design.
5. Test access as anonymous, two different members and admin.
6. Ensure members cannot edit attendance, timestamp, GPS, fine or payment confirmation.
7. For punch-in, ensure server timestamp, server-side distance and attendance/fine writes are atomic.
8. Do not create session PIN tables or fields.
9. Run database tests against local/non-production only.
10. Never link, push or mutate production without explicit approval.
