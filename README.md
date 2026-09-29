# CPH CRM

A clean, bilingual (English/Español) client and case manager for **Centro Para Legal Hispano**. It's built for how CPH works: unlawful detainers, family law, conservatorships and probate, and living trusts, with flat fees paid in installments. It has none of the extras from Clio or HubSpot that the team doesn't use.

**→ Setup guide: [docs/SETUP.md](docs/SETUP.md)**

## What's inside

| | |
| --- | --- |
| **Today** | Hearings and deadlines for the next 14 days, my tasks, intakes awaiting a retainer, balances due |
| **New intake** | Three steps: client → matter → fee. A **live conflict check** runs as names are typed. It ignores accents and catches misspellings like Merdado ↔ Mercado. |
| **Matters** | Tabs by practice area, filters, and a **stage board** where you drag a card to move its stage. Each area has its own stages and intake checklist. |
| **Matter page** | Stage stepper, key facts (UD property and rent control, DOM/DOS, conservatee…), checklist, people, timeline, tasks, dates, fees and payments, and a live view of the Drive folder |
| **UD deadline calculator** | Notice expiration, earliest filing date and answer due date, following CCP §§12, 12a, 1013, 1161 and 1167 plus the court holidays. Results stay drafts until someone confirms them. |
| **Calendar** | Agenda and month views. Dates sync to **Hearings and Deadlines** with your reminder ladder: 10/5/2 days before service dates, 5/2/1 before filing dates. |
| **Google Drive** | New matters get `Cases/"Last, First — Type (Side)"` with Pleadings, Correspondence, Exhibits and Scans |
| **Billing** | Flat fee, installments and a running balance, with a printable statement. This tracks fees, not a trust account. |
| **Import** | One-time import from the intake sheet, the existing `Cases/` folders and the events already on the calendar. Everything is previewed before it's saved. |
| **Team** | Google sign-in, invitation only, with admin and staff roles. Each person chooses English or Spanish and light or dark theme. |

## Tech

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth) via Drizzle ORM · next-intl · Google Drive/Calendar/Sheets APIs · Vitest · Playwright.

```
src/config/practice-areas.ts   ← practice areas, stages, checklists, matter fields (edit here)
src/app/(app)/…                ← pages
src/server/actions|queries/…   ← writes / reads (every action checks the signed-in staff member)
src/lib/deadlines/…            ← UD deadline math (+ tests with fixtures from real matters)
src/lib/google/…               ← Drive folders, calendar sync
src/lib/import/…               ← intake sheet / Drive folder import
messages/en.json, es.json      ← all UI text
drizzle/                       ← SQL migrations
```

## Development

```bash
cp .env.example .env.local   # local Postgres + DEV_AUTH_BYPASS=true
npm install
npm run db:migrate && npm run db:seed
npm run dev
```

`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run test:e2e`
