# Stack, Tools and Free-Tier Assessment

Research snapshot: 21 November 2026. Pricing and quotas change; verify before launch.

## Recommended stack
| Layer | Choice | Status |
|---|---|---|
| UI | React + TypeScript + Vite | Required |
| Routing | React Router | Required once multiple protected pages exist |
| Styling | Tailwind CSS | Recommended |
| Backend | Supabase Auth + PostgreSQL + RLS | Required |
| Sensitive operation | PostgreSQL RPC first; Edge Function if orchestration needs it | Required server-side boundary |
| Data fetching | Supabase JS; TanStack Query if useful | Optional |
| Forms | Native forms first; React Hook Form + Zod when complexity warrants | Optional |
| Maps | Leaflet | Optional, only for location-history map |
| Tests | Vitest + React Testing Library; Playwright for key flows | Recommended |
| Frontend hosting | Cloudflare Pages | Recommended |
| Version control | GitHub | Recommended |

## Avoid initially
Redux/Zustand, GraphQL, separate Express/Nest backend, microservices, Docker in production, payment gateway, realtime websockets unless a concrete need appears, background GPS, native app, elaborate analytics and large agent frameworks.

## Supabase Free
Official pricing currently lists:
- $0/month
- 50,000 monthly active users
- 500 MB database
- 5 GB egress and 5 GB cached egress
- 1 GB file storage
- shared CPU / 500 MB RAM
- free projects pause after one week of inactivity
- maximum two active free projects

For 24 members, usage quotas are likely ample, but one-week inactivity pausing is a material operational risk. Attendance records are important; keep independent periodic exports/backups. Free plan does not include automatic backups in the pricing comparison. Never assume zero cost or guaranteed uptime.

Source: https://supabase.com/pricing

## Cloudflare Pages Free
Cloudflare Pages currently documents a Free limit of 500 builds per month, one concurrent build, and a 20-minute build timeout. The project gets a provider subdomain under `pages.dev`; exact slug availability is checked when creating the Pages project. Custom domains can be connected later if owned.
Sources:
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/configuration/custom-domains/

## Domain recommendation
Do not assume `jhusey-fc.com` is free or purchased. `.com` is normally paid. Start with a Cloudflare Pages subdomain such as `jhusey-fc.pages.dev` if the slug is available. Alternatives: Vercel's `*.vercel.app`, Netlify's `*.netlify.app`. These are hosting subdomains, not domains the team owns.

## Local development
Supabase CLI local stack requires a container runtime such as Docker Desktop, Rancher Desktop or Podman. The CLI can be installed as a project dev dependency (`npm install supabase --save-dev`) and invoked via `npx supabase`. If Docker is too heavy for this small project, a separate non-production Supabase project is an alternative, but never use production for experiments.

## Frontend tooling
- TypeScript strict mode.
- ESLint and Prettier.
- Vitest + React Testing Library.
- Playwright for browser-based critical flows.
- Supabase CLI for migrations and DB tests.
- GitHub Actions only when a repo is ready for repeatable CI.
- Lighthouse or PageSpeed for a basic performance check.
- Bundle analyzer only if bundle size becomes a real issue.

## Dependencies
Install current compatible versions at implementation time; do not pin stale versions from this report. The package manifest does not exist yet.
