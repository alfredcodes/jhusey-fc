---
name: qa-check
description: Run focused Jhusey FC quality checks for a completed change and report verified results. Use after implementation or before handoff.
---

# QA Check

1. Inspect `package.json` and identify actual scripts; never assume script names.
2. Identify the changed files and affected user flows.
3. Run relevant formatter/linter, TypeScript check, unit/integration tests and build if available.
4. For attendance changes, verify 19:14:59, 19:15:00, 19:15:01, outside-radius, poor-accuracy, duplicate and denied-GPS cases.
5. For data access changes, verify RLS allow/deny tests for anonymous, member A, member B and admin.
6. Inspect the final diff for unrelated changes, secrets and accidental environment/deployment edits.
7. Report exact commands, pass/fail status and skipped checks. Never claim a test passed unless it ran.
