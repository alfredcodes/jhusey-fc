# Initial Claude Code Prompt - Architecture Validation Only

You are the technical lead for Jhusey FC. Do not start application implementation.

First read:
1. `CLAUDE.md`
2. `README.md`
3. `docs/architecture/overview.md`
4. All relevant files under `docs/architecture/`, `docs/database/`, `docs/business-rules/`, `docs/security/`, `docs/decisions/`, and `docs/planning/`.
5. `docs/research/` for the rationale and source links.

Then do the following:

1. Summarise the confirmed architecture and business rules. Explicitly state that punch-in uses GPS only and there is no Session PIN.
2. Inspect the current repository and local environment without modifying files. Identify whether this is an empty folder, existing project or existing Git repository.
3. Check installed Node, npm, Git and Claude Code versions. Do not install or upgrade anything.
4. Validate that proposed package choices and commands remain compatible with current official documentation. Do not invent package APIs or commands.
5. Review the database proposal for relational integrity, RLS, member privacy, duplicate punch-in prevention and atomic attendance/fine creation.
6. Review the attendance cutoff boundaries: 19:14:59 and 19:15:00 are On Time; 19:15:01 is Late with NPR 50.
7. Review the GPS-only workflow and identify the practical limitations of browser geolocation, accuracy and spoofing. Do not add PIN/QR/second factor.
8. Identify unresolved business decisions from `docs/planning/open-questions.md`. Do not silently decide them.
9. Identify missing prerequisites and any contradictions between the docs.
10. Present a Phase 1 implementation plan with scope, files to be created, dependencies, acceptance criteria, risks and checks.
11. Wait for explicit user approval before creating application files, installing dependencies, initializing Supabase, changing Claude settings, connecting MCP, creating a database or deploying.

Strictly prohibited in this task:
- No application components, routes or feature code.
- No `npm create vite`, package installation or scaffolding.
- No Supabase project creation, linking, migration push or production access.
- No deployment, DNS or domain purchase.
- No global Claude Code configuration changes.
- No secrets or credentials.

Finish with:
- repository/environment findings
- proposed Phase 1 plan
- unresolved decisions
- commands that would be run after approval
- explicit statement: "No application implementation has started."
