# Running multiple libraries from this one repo

This codebase currently powers **two independent, fully isolated libraries**:

| | Ayalot Library | Kiryat Sefer (KS) Kids Library |
|---|---|---|
| Netlify site | `ayalot-library-app` → https://ayalot-library-app.netlify.app | `ks-english-kids-library` → https://ks-english-kids-library.netlify.app |
| Supabase project | `aiooyqkasmqrukurkayo` ("Ayalot library") | `scednacuotsimujvztwy` ("Library website") |
| Supabase org | ayalotlibrary@gmail.com's Org | "Mommy's library" |
| Google account (Drive backups, Gmail SMTP) | ayalotlibrary@gmail.com | 48kskl@gmail.com |
| Google Cloud project (Drive OAuth) | `ayalot-library-backup` | `ks-kids-library-backups` |

Neither library shares a database, storage bucket, auth users, or Google
account with the other. They share **only the git repo and application
code** — one `git push` to `main` updates both, but each project's data,
secrets, and branding are completely separate.

## How branding stays separate from one shared codebase

Everything specific to a library's identity comes from two places that both
read from that project's own `settings` table (see
`supabase/migrations/20260623000019_library_branding.sql`):

- **Runtime** (after the page loads): `library_name`, `library_logo_url`,
  `library_icon_url`, `contact_phone` are fetched from Supabase via
  `usePublicSettings()` (`web/src/lib/queries.ts`) and used everywhere in the
  UI (header, emails' branding via `loadBranding()` in
  `supabase/functions/_shared/branding.ts`).
- **Build time** (before that fetch resolves, to avoid a flash of the wrong
  library's name/icon on first paint): `web/vite.config.ts`'s `htmlBranding`
  plugin bakes `VITE_LIBRARY_NAME` / `VITE_LIBRARY_ICON_URL` into the built
  `index.html`, and `DEFAULT_PUBLIC_SETTINGS` in `web/src/lib/queries.ts`
  reads the same env vars as its pre-fetch default. These are Netlify build
  environment variables, set per site (Ayalot's site has none set — the
  code's literal defaults already match Ayalot; KS's site has
  `VITE_LIBRARY_NAME`, `VITE_LIBRARY_ICON_URL`, `VITE_LIBRARY_LOGO_URL` set
  to its own values, matching what's in its `settings` table).

**Rule of thumb:** the build-time env vars and the `settings` table values
must always agree, or you'll see a flash of one value before the fetch
overwrites it with the other.

## Deploying code changes

- **Frontend (Netlify)**: both sites auto-deploy from GitHub on push to
  `main`. No manual step needed — one push updates both.
- **Edge Functions (Supabase)**: **not** wired to auto-deploy. After merging
  to `main`, you must `supabase functions deploy` separately against each
  project:
  ```bash
  npx supabase link --project-ref aiooyqkasmqrukurkayo && npx supabase functions deploy
  npx supabase link --project-ref scednacuotsimujvztwy && npx supabase functions deploy
  ```
- **Database migrations**: also manual, also per project:
  ```bash
  npx supabase link --project-ref aiooyqkasmqrukurkayo && npx supabase db push
  npx supabase link --project-ref scednacuotsimujvztwy && npx supabase db push
  ```
  `db push` will prompt for that project's database password.

Forgetting to run the Edge Function / migration step against one project is
the most common way the two libraries drift out of sync with each other and
with what's in git.

## Google Drive backups (per-library OAuth)

`backup-to-drive` needs `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`,
and `GOOGLE_DRIVE_REFRESH_TOKEN` set via `supabase secrets set` on each
project — each pointing at that library's own Google Cloud OAuth app and
Google account, so backups land in that library's own Drive.

To set this up for a library that doesn't have it yet (or to replace a
revoked/expired refresh token — apps left in Google's "Testing" publishing
status get their refresh token invalidated after a period of inactivity):

1. In Google Cloud Console, sign in as that library's Google account.
   Create a project (or reuse the existing one), enable the **Google Drive
   API**, and set up the **OAuth consent screen** (External, add that same
   account as a test user, scope `https://www.googleapis.com/auth/drive.file`).
2. Under **Clients**, create (or reuse) a **Web application** OAuth client
   with `https://developers.google.com/oauthplayground` as an authorized
   redirect URI. Note the Client ID; add a new Client Secret if you don't
   already have the value (Google only ever shows a secret once, so if it's
   lost, add a new one rather than trying to recover the old one).
3. Go to https://developers.google.com/oauthplayground, click the gear icon,
   check **"Use your own OAuth credentials"**, and enter that Client
   ID/Secret. In Step 1, enter scope `https://www.googleapis.com/auth/drive.file`
   and click **Authorize APIs**, signing in as that library's Google account
   and accepting the "Google hasn't verified this app" warning (expected —
   this app only needs to be used by its own account, so it doesn't need to
   go through Google's app verification).
4. In Step 2, click **Exchange authorization code for tokens** and copy the
   **Refresh token**.
5. Set all three values on that project:
   ```bash
   npx supabase secrets set \
     GOOGLE_DRIVE_CLIENT_ID='<client-id>' \
     GOOGLE_DRIVE_CLIENT_SECRET='<client-secret>' \
     GOOGLE_DRIVE_REFRESH_TOKEN='<refresh-token>' \
     --project-ref <that-project-ref>
   ```
6. Verify in Admin → Settings → **Back up now**.

## Adding a third library

1. Create a new Supabase project; run migrations + Edge Function deploy
   against it (see `DEPLOY.md`).
2. Set its own `library_name` / `library_logo_url` / `library_icon_url` /
   `contact_phone` rows in its `settings` table (Admin → Settings, or a SQL
   snippet based on `supabase/migrations/20260623000019_library_branding.sql`).
3. Create a new Netlify site linked to this same GitHub repo. Set
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for its own Supabase
   project, plus `VITE_LIBRARY_NAME` / `VITE_LIBRARY_ICON_URL` /
   `VITE_LIBRARY_LOGO_URL` matching step 2, so there's no branding flash on
   first load.
4. Set up its own Gmail SMTP sender and Google Drive OAuth app (see above).
5. Run `supabase/prod-cron.sql` against it for scheduled reminders/backups.
