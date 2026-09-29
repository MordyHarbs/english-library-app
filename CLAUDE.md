# English Library App (Ayalot Library)

Full-stack replacement for a Google Sheet + Form + Apps Script library system.
Public catalog, member portal, and a native admin dashboard for a small
English-language lending library ("Ayalot Library").

## Stack
| Layer | Tech |
|---|---|
| Frontend | Vite + React + TypeScript, Tailwind v4, shadcn/ui, React Router, TanStack Query |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Email | Gmail SMTP (ayalotlibrary@gmail.com) |
| Hosting | Netlify (static only) |

Cost target: $0 (Supabase free tier, Netlify free static hosting, Gmail SMTP).

## Layout
```
web/          Vite React app (public site, member portal, admin) — see web/src/pages, web/src/pages/admin, web/src/pages/account
supabase/     migrations/ (schema, 19 migrations as of 2026-06-23), functions/ (Edge Functions), seed.sql, config.toml
migration/    one-time Google Sheet -> Postgres importer (from the old Apps Script project)
```

## Supabase Edge Functions
_shared, backup-to-drive, create-member, daily-reminders, delete-loans, delete-members,
delete-reservations, extend-books, finalize-reservation, import-goodreads-book, lend-books,
member-request, request-login-code, return-books, submit-reservation

## Key features
- Public book catalog + guest book reservations
- Auth via emailed login codes (custom Gmail SMTP, not default Supabase email — free tier rate-limits without it)
- Admin dashboard: approve/lend/return books, member management, per-library branding settings, daily automation settings
- Daily reminders + Google Drive backups, both scheduled via Supabase cron (checks every 5 min, runs once/day at a configurable Jerusalem-time)
- Book import from Amazon / Goodreads
- Migrated from a legacy Google Apps Script system (spec/build docs live in the sibling `English-Library` Apps Script repo: FUNCTIONAL-SPEC.md, BUILD-PLAN.md, TECH-PLAN.md)

## Local dev
```bash
npm run db:start   # Postgres/Auth/Storage/Mailpit via Docker
npm run db:reset    # schema + seed
npm run dev         # http://localhost:5173, seeded admin: m3220298@gmail.com, login code appears in Mailpit (http://127.0.0.1:54324)
```

## Deploy
Full runbook in `DEPLOY.md`. Summary: `supabase db push` + `supabase functions deploy`,
set Gmail SMTP + Drive OAuth secrets via `supabase secrets set`, enable custom SMTP in
Supabase Dashboard Auth settings, deploy static frontend to Netlify with
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars, then run `supabase/prod-cron.sql`
in the SQL editor for scheduled reminders/backups.

## Related repos
- `english-library-website` — the OLD static Netlify site (Google Sheets backend). Now just
  301-redirects everything to this app's live Netlify URL (ayalot-library-app.netlify.app).
- `App script projects/English-Library` — the original Google Apps Script system this app replaced.
