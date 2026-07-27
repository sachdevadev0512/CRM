# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Middha Ventures Investment CRM — a production CRM for managing startup deal flow. Two front ends share one Supabase backend:

- **Public form** (`/`) — `FormPortal.tsx` — anonymous founders submit startup applications, including a pitch deck upload, protected by Cloudflare Turnstile.
- **Admin CRM** (`/admin/*`) — `AdminCRM.tsx` — authenticated admins review the pipeline, manage notes, export data, view audit logs, and manage other admins. Lazy-loaded so its code never ships to anonymous visitors.

## Commands

```bash
npm run dev      # tsx server.ts — Express + Vite middleware dev server (default http://localhost:3000)
npm run build    # vite build (client -> dist/public) + esbuild bundles server.ts -> dist/server.cjs
npm run start    # node dist/server.cjs — run the production build
npm run lint     # tsc --noEmit — type-check only, no test suite exists in this repo
npm run clean    # rm -rf dist server.js
```

There is no test runner configured — `lint` (type-checking) is the only automated check. Verify UI changes by running `npm run dev` and exercising the flow in a browser.

## Architecture

### Runtime model: one Express process, two jobs

`server.ts` is a single Express server that does double duty:
1. In dev, it mounts the Vite dev server in middleware mode (`appType: 'spa'`) so client and server run from one process/port.
2. In production, it serves the built static SPA from `dist/public` and exposes a small set of server-only API routes under `/api/*`.

It also owns cross-cutting concerns that must stay server-side: CSP/security headers (tuned to allow embedding inside AI Studio/Google/Cloud Run frames while still setting `X-Frame-Options` elsewhere), an in-memory rate limiter, and the two Supabase clients (see below). When editing security headers or CSP, note the conditional logic based on `Referer` for AI Studio framing — don't remove it without understanding why it's there.

### Two Supabase clients, two trust levels

- **Anon client** (`VITE_SUPABASE_ANON_KEY`) — used by the browser (`src/services/dbService.ts`) and subject to Postgres Row Level Security. All CRUD from the React app goes through this client directly (no REST layer in between) — Supabase + RLS *is* the API for reads/writes/storage.
- **Service role client** (`SUPABASE_SERVICE_ROLE_KEY`) — instantiated lazily in `server.ts` only, never sent to the browser. It's used exclusively by `/api/crm-service/register-administrator` to bypass RLS for admin bootstrapping/creation. Any new privileged operation (one that must bypass RLS) belongs in `server.ts` as a new `/api/*` route, not in client code.

Both clients are lazily constructed and throw a clear error if their env vars are missing rather than crashing at import time — preserve this pattern if you add new client instances.

### Authorization model: admin = row in `public.admins`

There are no roles/claims on the Supabase Auth user — being an admin means having a row in `public.admins` keyed by `auth.users.id`. Every privileged read/write is gated by the `public.is_admin()` SQL helper inside RLS policies (see `supabase/migrations/01_init.sql`), not by application code. When adding a new table or feature, the RLS policy is the actual security boundary — client-side checks (`currentUser.isAdmin`) are UX only, not enforcement.

The public application form intentionally uses `auth.signInAnonymously()` so the anonymous user has a `session.user.id`, which lets storage RLS policies scope the pitch-deck upload path to `${auth.uid()}/filename` (see `submitApplication` in `dbService.ts`).

### Migrations are sequential and additive

`supabase/migrations/*.sql` are numbered and meant to be run in order against the Supabase SQL editor (there's no CLI-driven migration runner wired up). Each file is a point-in-time fix or feature (e.g. `03_security_fixes.sql`, `07_critical_security_fixes.sql`, `08_security_definer_hardening.sql` progressively tighten RLS/SECURITY DEFINER functions). When changing schema or policies, add a new numbered migration rather than editing an old one — the file names document the security history of the project and several client-side error messages reference specific migration files by name (see `deleteAdmin` in `dbService.ts`).

Notable DB-side behavior to know before touching related app code:
- Startup application submissions are audit-logged by a `SECURITY DEFINER` trigger (`tr_log_startup_submission`), not by client code — this is why `submitApplication` in `dbService.ts` does not itself write to `audit_logs`.
- Duplicate company name checks in `submitApplication` are advisory (client-side `ilike` pre-check) with the DB as the real constraint; don't remove the DB-level uniqueness enforcement in favor of the client check alone.

### Security-sensitive utilities

`src/services/securityUtils.ts` centralizes URL sanitization (`safeHref`, `cleanUrl`, `validateLinkedInUrl`) to block `javascript:`/`data:`/`vbscript:` URIs from user-submitted links (website, LinkedIn, demo video). Route any new user-supplied URL through these helpers rather than rendering `href`s directly.

### Frontend structure

- `src/App.tsx` — router root; blocks rendering entirely with a config-error screen if Supabase env vars are missing/placeholder (`isSupabaseConfigured`), and lazy-loads `AdminCRM` so admin code/deps aren't in the public bundle.
- `src/components/FormPortal.tsx` — public application form; owns Cloudflare Turnstile lifecycle.
- `src/components/AdminCRM.tsx` — large single-component admin shell: auth, pipeline board, table view, audit log viewer (with client-side normalization of raw `audit_logs` rows into categorized business events), admin management, and CSV export, each driven by local `useState` (no external state library/store).
- `src/components/StartupDetail.tsx` — detail/edit view for a single startup, opened from `AdminCRM`.
- `src/services/dbService.ts` — the only place that talks to Supabase from the client; implements a `DbService` interface. If you need a new data operation, add it to the interface and the `SupabaseServiceImpl` class rather than calling `getSupabase()` ad hoc from components.
- Path alias `@/*` maps to the repo root (configured in both `tsconfig.json` and `vite.config.ts`).
