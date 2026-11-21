# Jhusey FC - Architecture & Claude Code Preparation Pack

This pack prepares the architecture and Claude Code workflow. It does **not** contain the application itself.

## Start here
1. Read `CLAUDE.md`.
2. Read `docs/architecture/overview.md`.
3. Read `docs/decisions/architecture-decisions.md`.
4. Read `docs/planning/implementation-roadmap.md` and `docs/planning/open-questions.md`.
5. Use `docs/handover/initial-claude-prompt.md` in Claude Code only after placing this pack in the actual project directory.
6. Do not start feature implementation until the user approves the Phase 1 plan.

## Project decisions
- GPS-only punch-in; no Session PIN.
- Capture GPS only on explicit punch-in; no continuous tracking.
- Server-generated time; cutoff 19:15:00 Asia/Kathmandu inclusive; late from 19:15:01; NPR 50 fine.
- One admin account initially.
- NPR 200 communication penalty remains unresolved.

## Recommended architecture
React + TypeScript + Vite frontend; Supabase Auth/PostgreSQL/RLS backend; trusted server-side punch-in operation; Cloudflare Pages static hosting. See architecture docs for trade-offs and caveats.

## Important cost caveat
"Free" is not the same as guaranteed forever or production-grade backup. Supabase Free currently has finite database/egress/storage quotas and pauses projects after one week of inactivity. Keep independent backups of important attendance and financial data. Review current pricing before launch.

## Directory map
- `docs/architecture/` - system design and technical boundaries
- `docs/database/` - proposed schema and security policy approach
- `docs/business-rules/` - attendance, geolocation, fines and payments
- `docs/security/` - security checklist
- `docs/planning/` - roadmap and unresolved decisions
- `docs/decisions/` - confirmed choices and rationale
- `docs/research/` - repository, skills, MCP and cost research
- `docs/handover/` - initial Claude Code prompt and install commands
- `.claude/skills/` - small project-level repeatable workflows

## Status
Architecture preparation only. No React app, database migrations, Supabase project, deployment or credentials are included.
