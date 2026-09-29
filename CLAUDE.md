@AGENTS.md

# CPH CRM

Next.js 16 (App Router) + Supabase Postgres (Drizzle) + Supabase Auth (Google). Bilingual (next-intl, `messages/en.json` + `messages/es.json`).

- Practice areas, stages, checklists and matter fields: `src/config/practice-areas.ts` (single source of truth).
- Server actions: `src/server/actions/*`; reads: `src/server/queries/*`. Every action starts with `requireStaff()` / `requireAdmin()`.
- UD deadline math: `src/lib/deadlines/*` (tests in `tests/deadlines.test.ts` use fixtures from the firm's real deadline docs).
- Google Drive/Calendar: `src/lib/google/*` (one firm-level OAuth connection, token encrypted with `ENCRYPTION_KEY`).
- Every UI string needs an entry in BOTH `messages/en.json` and `messages/es.json` (`tests/i18n.test.ts` enforces parity; TypeScript enforces keys exist).

Checks: `npm run lint && npm run typecheck && npm test && npm run build`.
Local dev: Postgres + `.env.local` with `DEV_AUTH_BYPASS=true` (never works on Vercel), `npm run db:migrate && npm run db:seed`.
