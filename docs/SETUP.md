# Setting up CPH CRM

This guide takes you from nothing to a live CRM your team can sign in to. Plan on about an hour. You'll create three accounts, copy a few keys between them, and click Deploy.

| Service | What it does | Cost |
| --- | --- | --- |
| **Supabase** | The database and Google sign-in | Free to start. **Pro, $25/mo**, is recommended for daily backups of client data. |
| **Vercel** | Hosts the app at a web address | **Pro, $20/mo**. The free Hobby plan is for non-commercial use only. (A daily background re-sync retries any calendar pushes that failed; dates normally sync the moment they are saved.) |
| **Google Cloud** | Lets the CRM create Drive folders and calendar events | Free |

Only the owner needs Vercel and Supabase accounts. Staff just sign in to the CRM with their Google account.

---

## 1. Supabase (database + sign-in)

1. Go to <https://supabase.com>, sign up, and click **New project**.
   - Name: `cph-crm`. Region: **West US (North California)**.
   - Save the database password somewhere safe.
2. When the project is ready, click **Connect** at the top of the page. Copy two connection strings, replacing `[YOUR-PASSWORD]` with your password in each:
   - **Transaction pooler** (port **6543**) → this is `DATABASE_URL`
   - **Session pooler** (port **5432**) → this is `DIRECT_DATABASE_URL`
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Leave this tab open. You'll come back to turn on Google sign-in after step 2.

## 2. Google Cloud (sign-in + Drive + Calendar)

Sign in to <https://console.cloud.google.com> as **you@yourfirm.com**, the account that owns `1A CPH FOLDER` and the "Hearings and Deadlines" calendar.

1. Create a project named `CPH CRM`.
2. **APIs & Services → Library**. Enable these three APIs:
   - Google Drive API
   - Google Calendar API
   - Google Sheets API
3. **Google Auth Platform** (older consoles call this "OAuth consent screen"):
   - **Branding:** app name `CPH CRM`, support email `you@yourfirm.com`, developer contact `you@yourfirm.com`.
     - Leave the **logo empty**. Uploading one forces a Google review.
     - Google won't let you publish without a homepage and privacy policy link. Those pages live on the CRM itself, so fill them in once Vercel is deployed (step 3):
       - Application home page: `https://<your-app>.vercel.app`
       - Privacy policy: `https://<your-app>.vercel.app/privacy`
       - Terms of service: `https://<your-app>.vercel.app/terms`
       - Authorized domains: `<your-app>.vercel.app`
   - **Audience:** User type **External**.
     - Until the Vercel site exists, leave it in **Testing** and add `you@yourfirm.com` (and staff emails) under **Test users**.
     - After filling in the Branding links, click **Publish app** so it is **In production**.
     - This matters. In "Testing" mode, Google disconnects Drive and Calendar every 7 days.
     - You'll see an "unverified app" warning once when you connect. Click **Advanced → Go to CPH CRM**. That's expected for a private firm tool.
   - **Data access:** add these scopes:
     - `.../auth/drive`
     - `.../auth/calendar.events`
     - `.../auth/calendar.calendarlist.readonly`
     - `openid`
     - `email`
4. **Credentials → Create credentials → OAuth client ID → Web application**. Name it `CPH CRM`.
   - **Authorized redirect URIs** — add both. Use your real Vercel address from step 3; you can come back and edit this later.
     - `https://<your-project-ref>.supabase.co/auth/v1/callback` (for staff sign-in)
     - `https://<your-app>.vercel.app/api/google/callback` (for Drive and Calendar)
   - Copy the **Client ID** → `GOOGLE_CLIENT_ID` and the **Client secret** → `GOOGLE_CLIENT_SECRET`.
5. Back in Supabase, go to **Authentication → Sign In / Providers → Google**.
   - Turn it on and paste the same Client ID and Client secret. Save.

## 3. Vercel (hosting)

1. Go to <https://vercel.com> and sign up with GitHub. Upgrade the team to **Pro**.
2. Click **Add New → Project** and import **Nefus1/cph-crm**.
3. Before deploying, open **Environment Variables** and add these:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Transaction pooler string (port 6543) |
   | `DIRECT_DATABASE_URL` | Session pooler string (port 5432) |
   | `NEXT_PUBLIC_SUPABASE_URL` | From Supabase → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase → API |
   | `BOOTSTRAP_ADMIN_EMAIL` | `you@yourfirm.com` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud |
   | `ENCRYPTION_KEY` | 64 random hex characters. On a Mac or Linux, run `openssl rand -hex 32` and paste the result. |
   | `CRON_SECRET` | Any long random string, e.g. another `openssl rand -hex 32` |
   | `APP_URL` | `https://<your-app>.vercel.app` (update it if you add a custom domain) |

4. Click **Deploy**. The first build creates all the database tables for you, because `vercel.json` runs the migrations before the build.
5. After it deploys:
   - Copy the address. Make sure it's in `APP_URL` and in the Google redirect URIs from step 2.4.
   - In Supabase, go to **Authentication → URL Configuration**:
     - Set **Site URL** to your app address.
     - Add `https://<your-app>.vercel.app/auth/callback` under **Redirect URLs**.
   - Redeploy if you changed any environment variables.

> **Custom domain (optional):** In Vercel, go to **Settings → Domains** and add something like `crm.cph.la`. Then update `APP_URL`, the Google redirect URI, and the Supabase URLs to use the new address.

## 4. First sign-in checklist

1. Open the app and click **Continue with Google** as **you@yourfirm.com**. You become the first admin automatically.
2. **Settings → Google → Connect Google.** Approve the Drive and Calendar access.
3. **Choose the Cases folder:** browse to `1A CPH FOLDER → Cases` and click **Use "Cases"**.
4. **Choose the calendar:** pick **Hearings and Deadlines**.
5. **Settings → General:** set the default supervising attorney. It's pre-filled on every new matter.
6. **Settings → Team:** invite each employee by the Google email they'll sign in with. Tell them the address; nothing is emailed automatically.
7. **Settings → Import:** bring in your existing data. Each option previews before it saves anything, so it's safe to look first:
   - **Client Intake Form (Responses):** paste the Google Sheets link.
   - **Existing case folders:** creates a matter for each folder in `Cases/` and reads case numbers from each folder's `00 Intake` doc.
   - **Existing hearings & deadlines:** attaches the events already on the calendar to their matters.
8. **Settings → Court holidays:** check the list against LASC's published closure calendar for the year. The UD deadline calculator uses it.

### Quick test

1. Create a matter for "ZZ Test, Demo" under General.
2. Check that a folder `ZZ Test, Demo — General` with Pleadings, Correspondence, Exhibits and Scans appears in `Cases/`.
3. On the matter, add a deadline with the **Filing** reminders. It should appear on Hearings and Deadlines with reminders 5, 2 and 1 days before.
4. Delete the test matter. That's in the **⋯** menu and needs an admin. Confirm the calendar event disappears too.

---

## Day-to-day notes

- **Backups:** Supabase Pro takes daily backups. You can also download a copy anytime from **Supabase → Database → Backups**.
- **Retiring old tools:** once the team works in the CRM, the Microsoft To Do matter lists and the Zapier "cph daily rundown" are replaced by the **Today** page and **Tasks**.
- **Calendar:** the CRM is the source of truth. Edit dates in the CRM and they update in Google. Changes made directly in Google Calendar don't flow back.
- **Drive folder names** stay in English ("UD (Plaintiff)") so they match your existing folders. The CRM screens can be switched to Spanish per person.

## Local development (for developers)

```bash
cp .env.example .env.local        # set DATABASE_URL to a local Postgres, DEV_AUTH_BYPASS=true
npm install
npm run db:migrate
npm run db:seed                   # fictional demo data
npm run dev
```

`DEV_AUTH_BYPASS` signs you in as `DEV_AUTH_EMAIL` without Google. The app ignores it on Vercel.

Checks: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.
