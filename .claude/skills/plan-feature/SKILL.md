---
name: plan-feature
description: Plan a Jhusey FC feature as a small vertical slice with acceptance criteria, affected files, data access, RLS and tests. Use before implementing any new feature or changing business logic.
---

# Plan Feature

1. Read `CLAUDE.md` and the relevant business-rule and architecture docs.
2. Inspect only the files directly related to the request.
3. Identify user roles, data read/write paths, RLS implications and server-side operations.
4. State assumptions and unresolved decisions; never invent business rules.
5. Propose the smallest vertical slice and list files expected to change.
6. Define acceptance criteria and negative/security tests.
7. Identify migration, backup or deployment risks.
8. Stop and ask for approval before implementation when the task requires it.
