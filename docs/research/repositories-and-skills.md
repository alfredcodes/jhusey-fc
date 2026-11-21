# Claude Code Repository and Skill Research

Research snapshot: 21 November 2026. Public repository metadata and documentation can change; recheck before installing.

## Repository review

### 1. everything-claude-code
Source: https://github.com/affaan-m/everything-claude-code
- Useful patterns: research-first workflow, selective skill installation, scoped rules, hooks for deterministic guardrails, context/token optimisation, security review.
- Why not copy wholesale: broad multi-framework toolset and installation machinery are excessive for one small app. The research result surfaced a fork/renamed mirror during indexing; confirm upstream owner/repository identity, license and current install docs directly before using any installer.
- Recommendation: read selected workflow ideas only; do not install the full toolkit.

### 2. ghalex/skills
Source: https://github.com/ghalex/skills
- Useful skills listed: `react-architect`, `react-rules`, `commit`, `grill-me-technical`, `handoff`, `create-a-prd`.
- The `react-setup` skill scaffolds a heavier default stack (Redux Toolkit, RTK Query, Docker/nginx and other choices) than this project needs. Do not use it as a blind scaffold.
- Recommendation: optionally install `react-architect` and `react-rules` only after inspecting their full SKILL.md and license. Better to start with the project-specific rules in this pack.

### 3. seancdavis/agent-skills
Source: https://github.com/seancdavis/agent-skills
- Repository contains skills, hooks, output styles and statusline configuration.
- Repository listing showed a small public collection and limited stars at time of search; it was not clearly a stronger React/Supabase fit than the other options.
- Recommendation: no installation required for Jhusey FC.

### 4. BrainfyAI/claude-code-saas-template
Source: https://github.com/BrainfyAI/claude-code-saas-template
- Useful patterns: separate frontend/database/backend/testing agent instructions, RLS documentation, handoff convention and templates.
- Stack overlaps Vite + React + Supabase, but includes Stripe, email integrations, multi-agent orchestration and SaaS-specific structures.
- License advertised as MIT in repository README.
- Recommendation: reuse the RLS inventory and focused handoff idea. Do not copy Stripe/email/agent scaffold.

### 5. travisjneuman/.claude
Source: https://github.com/travisjneuman/.claude
- Useful patterns: progressive disclosure, index-driven skill discovery, scoped rules, concise always-loaded CLAUDE.md, token-aware hooks.
- The repo is a global personal toolkit, not a project starter. It advertises many skills/agents/hooks and contains broad automation, including powerful permission/autonomy choices.
- Recommendation: borrow the principle of loading detailed procedures on demand. Do not clone into the project or copy global settings.

## Additional primary sources
- Agent Skills open format: https://github.com/agentskills/agentskills
- Anthropic Skills docs: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Anthropic guidance on CLAUDE.md, skills, hooks and subagents: https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more

## Skills recommendation
Start with three small project-level skills created in this pack:
- `plan-feature`: plan a vertical slice and list acceptance criteria before coding.
- `database-migration`: design/review migrations and RLS tests; never apply to production without approval.
- `qa-check`: run focused typecheck/lint/tests and report actual results.

Optional external skill source:
- Supabase Agent Skills: https://github.com/supabase/agent-skills
- Official Supabase React quickstart shows `npx skills add supabase/agent-skills`. Inspect the installed skill set and install only the relevant Supabase skills at project scope; do not install globally.
- Do not install the whole `ghalex/skills` collection. Its own repo lists a targeted install syntax such as `npx skills add ghalex/skills --skill react-architect`; inspect actual skill contents and licensing before adopting.

## License and maintenance caveat
A repository's README is not a substitute for checking its LICENSE file and latest commit. The research snapshot did not establish the exact license/maintenance state of every requested repository. Treat unverified license/status as unverified and inspect the repository's `LICENSE`, releases and commit history before copying code or running installation scripts.
