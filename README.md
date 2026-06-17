# English Library App

## Start the production-data local server

From the repo root, run:

```bash
npm run dev:prod --workspace web
```

Then open http://localhost:5173/.

Full-stack replacement for the Google Sheet + Form + Apps Script library system.
Public catalog, member portal, and a native admin dashboard.

- **Functional spec, build plan, tech design:** see the `English-Library` Apps Script repo
  (`FUNCTIONAL-SPEC.md`, `BUILD-PLAN.md`, `TECH-PLAN.md`).
- **Cost:** $0 at every step — Supabase free tier, Netlify free static hosting, Gmail SMTP.
- **Everything is testable locally** before any cloud deploy.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React + TypeScript, Tailwind v4, shadcn/ui, React Router, TanStack Query |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Email | Gmail SMTP (free) |
| Hosting | Netlify (static only — no functions, no billing) |

## Layout

```
web/          Vite React app (public site, member portal, admin)
supabase/     migrations/ (schema), functions/ (Edge Functions), seed.sql, config.toml
migration/    one-time Google Sheet -> Postgres importer
```

## Local development

Prerequisites: Node 22+, Docker Desktop (running).

```bash
# 1. Start the whole backend locally (Postgres, Auth, Storage, Mailpit email catcher)
npm run db:start          # first run pulls Docker images (slow once)

# 2. Apply schema + seed data
npm run db:reset

# 3. Copy the printed API URL + anon key into web/.env.local
cp web/.env.example web/.env.local
npm run db:status         # shows the values to paste

# 4. Run the app
npm run dev               # http://localhost:5173
```

Useful local URLs (from `npm run db:status`):
- **App:** http://localhost:5173
- **Supabase Studio** (DB GUI): http://127.0.0.1:54323
- **Mailpit** (catches ALL outgoing email — login codes, etc.): http://127.0.0.1:54324

### Local login
The seed creates an admin member `m3220298@gmail.com`. Log in with the email-code
flow; the code appears in **Mailpit**, not a real inbox — no real emails are sent locally.

## Migrating data from the old Google Sheet

1. In the old Apps Script project, run `exportAllData()` (see `ExportData.js` there).
2. Download the generated Drive folder and unzip into `migration/export/`.
3. `npm run import -- --wipe` (after setting `migration/.env`).

## Stop the local stack

```bash
npm run db:stop
```
