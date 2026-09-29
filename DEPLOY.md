# Deploy runbook (Phase 11) — $0, run from your terminal

All commands run from the repo root unless noted. Replace `<…>` placeholders.
Secrets never leave your machine.

```bash
cd /Users/mordechai/Dev/english-library-app
```

## 0. Prereqs you created
- Gmail **App Password** (16 chars) for `ayalotlibrary@gmail.com`
- Supabase project → note **PROJECT_REF**, **DB password**, **access token**
- Empty GitHub repo `english-library-app` → its URL
- Netlify account

## 1. Link Supabase + push schema + functions
```bash
export SUPABASE_ACCESS_TOKEN=<your-access-token>     # or: npx supabase login
npx supabase link --project-ref <PROJECT_REF>        # prompts for DB password
npx supabase db push                                 # applies all migrations
npx supabase functions deploy                         # deploys all Edge Functions
```

## 2. Function secrets (Gmail SMTP for app emails)
```bash
npx supabase secrets set \
  GMAIL_USER=ayalotlibrary@gmail.com \
  GMAIL_APP_PASSWORD='<16-char-app-password>' \
  ADMIN_EMAIL=ayalotlibrary@gmail.com \
  SITE_URL='https://<will-set-after-netlify>.netlify.app'
```

For Google Drive backups, also set OAuth credentials with Drive file access:
```bash
npx supabase secrets set \
  GOOGLE_DRIVE_CLIENT_ID='<google-oauth-client-id>' \
  GOOGLE_DRIVE_CLIENT_SECRET='<google-oauth-client-secret>' \
  GOOGLE_DRIVE_REFRESH_TOKEN='<google-oauth-refresh-token>'
```
Backups are saved in My Drive under `Ayalot Library Backups/YYYY/MM/YYYY-MM-DD/<timestamp>/`.
The app never deletes old backup folders.

## 3. Auth login emails (custom SMTP) — Dashboard
Authentication → **Emails / SMTP Settings** → enable **Custom SMTP**:
- Host `smtp.gmail.com`, Port `465`, Username `ayalotlibrary@gmail.com`,
  Password `<app password>`, Sender `ayalotlibrary@gmail.com`, Name `Ayalot Library`.
(Without this, free-tier login-code emails are heavily rate-limited.)

## 4. Push code to GitHub
```bash
git remote add origin <repo-url>
git push -u origin main
```

## 5. Netlify deploy (static)
Get the API values: Dashboard → Project Settings → **API** → Project URL + anon/publishable key.
```bash
npm i -g netlify-cli            # or use: npx netlify-cli ...
netlify login
netlify init                   # link to a new site (pick this repo)
netlify env:set VITE_SUPABASE_URL "https://<PROJECT_REF>.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "<anon-or-publishable-key>"
netlify deploy --build --prod
```
Copy the live URL, then update the two SITE_URLs:
```bash
npx supabase secrets set SITE_URL='https://<your-site>.netlify.app'
```
And in Dashboard → SQL editor: `update settings set value = '"https://<your-site>.netlify.app"' where key = 'site_url';`

### Deploying a second, differently-branded library from this same repo
This codebase supports running more than one library off one GitHub repo, each as
its own fully isolated Netlify site + Supabase project (own database, own Gmail
sender, own cron). To add one:
- Create a new Supabase project and repeat steps 1–3 and 7–8 against it.
- In Netlify, `netlify init` a **second, separate site** linked to the same repo
  (or add a second site from the dashboard → Import an existing project).
- Set that site's env vars: the usual `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  for its own Supabase project, plus branding overrides so the correct name/icon
  render on first paint instead of flashing "Ayalot Library" while the runtime
  settings fetch is in flight:
  ```bash
  netlify env:set VITE_LIBRARY_NAME "Kiryat Sefer Kids Library"
  # Use the same Supabase Storage URLs already set as library_icon_url /
  # library_logo_url in that project's settings table (upload a custom logo via
  # Admin -> Settings first if you haven't) — no need to commit local image files.
  netlify env:set VITE_LIBRARY_ICON_URL "https://<PROJECT_REF>.supabase.co/storage/v1/object/public/covers/<icon-file>.png"
  netlify env:set VITE_LIBRARY_LOGO_URL "https://<PROJECT_REF>.supabase.co/storage/v1/object/public/covers/<logo-file>.png"
  netlify env:set VITE_CONTACT_PHONE "<their phone>"        # optional
  ```
  These only set the build-time default shown before data loads; they should exactly
  match the same values (`library_name`, `library_logo_url`, `library_icon_url`,
  `contact_phone`) already stored in that project's `settings` table (set via
  Admin → Settings, or a SQL snippet like `supabase/migrations/20260623000019_library_branding.sql`),
  so the pre-fetch default and the loaded data agree and nothing visibly changes.

## 6. GitHub secrets (for the Actions in .github/workflows)
Repo → Settings → Secrets and variables → Actions → add:
- `SUPABASE_URL` = `https://<PROJECT_REF>.supabase.co`
- `SUPABASE_ANON_KEY` = anon/publishable key
- `SUPABASE_DB_URL` = direct connection string (Settings → Database → URI)

## 7. Schedule daily reminders and Drive backups — Dashboard SQL editor
Open `supabase/prod-cron.sql`, replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>`
(Settings → API → service_role key), and run it.

The cron jobs check every 5 minutes. The functions only run once per Jerusalem
calendar day at or after the `daily_tasks_time` setting, which defaults to
`08:00` and can be edited from Admin → Settings → Daily automation.

## 8. Migrate data
```bash
# In the OLD Apps Script project: run exportAllData(), download the Drive folder,
# unzip its contents into migration/export/ (books.json, members.json, covers/, …)
cp migration/.env.example migration/.env
# edit migration/.env:  SUPABASE_URL=https://<ref>.supabase.co  SERVICE_ROLE_KEY=<service_role>
npm run import -- --wipe
cat migration/migration-report.txt   # review unmatched rows
```

## 9. Smoke test (production)
- Open the site → `/login` with your email → code arrives via Gmail → log in.
- Reserve a book as a guest; confirm the admin alert email + deep link.
- In `/admin`: approve → lend → return one book.
- Trigger a reminder dry-run: `curl -X POST https://<ref>.supabase.co/functions/v1/daily-reminders -H "Authorization: Bearer <service_role>" -H "Content-Type: application/json" -d '{"source":"manual"}'`.
- Trigger a backup dry-run: `curl -X POST https://<ref>.supabase.co/functions/v1/backup-to-drive -H "Authorization: Bearer <service_role>" -H "Content-Type: application/json" -d '{"source":"manual"}'`.
- In `/admin/settings`, use **Back up now** and confirm a new dated folder appears in Drive.

## Cutover (Phase 12)
Once happy: point people to the Netlify URL, disable the old Apps Script triggers
(`onFormSubmit`, daily reminders) and close the Google Form. Keep the Sheet as an archive.
