import "server-only";
import { sql, type AnyColumn, type SQL } from "drizzle-orm";

/** Balance per matter: charges + adjustments − payments (cents). */
export const balanceSql = (matterIdCol: SQL | string = sql`m.id`) =>
  sql<number>`coalesce((select sum(case when l.kind = 'payment' then -l.amount_cents else l.amount_cents end) from ledger_entries l where l.matter_id = ${matterIdCol}), 0)::int`;

export const primaryClientSql = sql<string | null>`(
  select c.display_name from matter_parties mp join contacts c on c.id = mp.contact_id
  where mp.matter_id = m.id and mp.role in ('client','co_client')
  order by (mp.role = 'client') desc, mp.is_primary desc, mp.created_at limit 1)`;

export const primaryClientIdSql = sql<string | null>`(
  select mp.contact_id from matter_parties mp
  where mp.matter_id = m.id and mp.role in ('client','co_client')
  order by (mp.role = 'client') desc, mp.is_primary desc, mp.created_at limit 1)`;

export const nextEventSql = (today: string) => sql<string | null>`(
  select min(e.date)::text from events e
  where e.matter_id = m.id and e.deleted_at is null and e.status = 'scheduled' and e.date >= ${today}::date)`;

/** Accent- and case-insensitive LIKE pattern. */
export function likePattern(q: string) {
  return `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
}

/**
 * Every word must appear somewhere in the column (any order, accent-insensitive),
 * so "Kevin Marsh" finds "Marsh, Kevin" and "jose hernandez" finds "Hernández, José".
 */
export function tokensMatch(column: SQL | AnyColumn, term: string): SQL {
  const tokens = term
    .replace(/,/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!tokens.length) return sql`true`;
  return sql.join(
    tokens.map((tok) => sql`f_unaccent(${column}) ilike f_unaccent(${likePattern(tok)})`),
    sql` and `,
  );
}
