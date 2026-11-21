# Claude Code Workflow, MCP, Agents and Token Efficiency

## Recommended baseline
- Root `CLAUDE.md` with concise project facts and hard rules.
- Project-local `.claude/skills/` for the three repeatable workflows included in this pack.
- No custom agents initially.
- No hooks initially; add deterministic checks after scripts exist.
- No project MCP config initially.
- Optional Context7 setup after user approval for up-to-date library documentation.
- Do not connect Supabase MCP to any real project during preparation.

## MCP assessment
### Context7
Useful when Claude needs current docs for React/Vite/Supabase/Tailwind package APIs. Optional; it does not replace official documentation review. Current setup guide: `npx ctx7 setup --claude` (OAuth flow) or the official Claude Code plugin route. This modifies Claude Code client configuration, so ask approval before running.
https://context7.com/docs/clients/claude-code

### Supabase MCP
Can inspect and operate Supabase projects, which is powerful and risky. Defer until a development Supabase project exists and the user approves exact project access and permissions. Never connect to production by default.

### GitHub MCP
Optional for issues/PR/CI/repo operations. Not needed for local file editing or public repository research. Use Git CLI for normal local commits.

## Subagents
Do not create five permanent agents. For a 24-person app, the main Claude session plus occasional isolated security review or test review is enough. Add a subagent only when there is a recurring, independent task whose intermediate context should not pollute the main session.

## Hooks
Do not add hooks before the package scripts exist. Later, a cheap PostToolUse hook may run formatting on changed files, or a guard may block edits to protected environment files. Avoid expensive full test/build runs after every file edit; run focused checks at task completion.

## Token-saving practices that work
- Keep root CLAUDE.md concise and always relevant.
- Move procedures into skills; skill metadata is lightweight and full instructions load on invocation.
- Scope rules by file paths.
- Ask Claude to inspect relevant files, not repeatedly print the whole repository.
- Keep `docs/decisions` and `docs/planning/open-questions` current.
- Use scripts for deterministic checks and return summaries, not entire logs.
- Work one vertical slice at a time.
- Use a short handoff note before ending a session.
- Avoid unnecessary MCP servers and broad agents that add descriptions/context.
- Do not sacrifice RLS tests or attendance boundary tests to save tokens.

## Session workflow
1. State one feature and its acceptance criteria.
2. Ask Claude to inspect only related files and identify assumptions.
3. Ask for a plan; approve it.
4. Implement one vertical slice.
5. Run targeted tests, typecheck and lint.
6. Review diff and security implications.
7. Update docs and commit with a precise message.
8. Record next step and unresolved questions.
