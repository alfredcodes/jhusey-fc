# Installation and Validation Commands

These commands are guidance for the actual project directory. Run only after reviewing/approving the plan. Do not run global installs or modify global Claude Code configuration without approval.

## Phase 1 (done 2026-11-21)
The Vite template was scaffolded into a temporary folder and selected files copied in, because scaffolding into this non-empty directory would overwrite `README.md`. The template already includes TypeScript and oxlint.
```bash
npm install react-router
npm install -D tailwindcss @tailwindcss/vite prettier vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Phase 2
```bash
npm install @supabase/supabase-js @tanstack/react-query
```

## Recommended local Supabase CLI
```bash
npm install -D supabase
npx supabase --version
npx supabase init
```
A local Supabase stack requires Docker Desktop or another Docker-compatible runtime. `supabase start` should be run only after the local configuration is approved. It does not create or modify a production project.

## Optional
```bash
# Only if server-state caching becomes useful
npm install @tanstack/react-query

# Forms only when needed
npm install react-hook-form zod @hookform/resolvers

# Maps only when the location-history map is implemented
npm install leaflet react-leaflet
npm install -D @types/leaflet

# Browser E2E only when the app has a runnable route
npm install -D @playwright/test
npx playwright install
```

## Optional external skills
Inspect before install; prefer project-local installation:
```bash
# Supabase's official agent skill collection; inspect what it installs and keep only relevant skills
npx skills add supabase/agent-skills

# Example of targeted install syntax from ghalex/skills; review SKILL.md and LICENSE first
npx skills add ghalex/skills --skill react-architect
```
Do not use `-g`. Do not install the whole ghalex collection.

## Optional Context7
Only with approval because it changes Claude Code configuration and uses OAuth:
```bash
npx ctx7 setup --claude
```

## GitHub Actions
Add a workflow only after package scripts are stable. The CI should run the project's exact `lint`, `typecheck`, `test` and `build` scripts. Do not invent script names before `package.json` exists.

## Initial validation
```bash
node --version
npm --version
git --version
claude --version
claude doctor
```
The Claude Code diagnostic command may vary by installed version; if `claude doctor` is not recognized, use `/doctor` from inside Claude Code and follow the installed version's help.

## Not approved / do not run
- Global skill installs.
- Global Claude Code settings edits.
- Production Supabase linking or migration pushes.
- Deployment commands.
- Payment gateway setup.
- Any destructive cleanup command.
