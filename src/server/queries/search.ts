import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { likePattern, tokensMatch } from "./common";

export interface SearchHit {
  type: "matter" | "contact";
  id: string;
  title: string;
  subtitle: string;
  area?: string;
}

/** Global ⌘K search across matters and contacts: name, phone, email, case #, matter #. */
export async function searchEverything(q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const p = likePattern(term);
  const digits = term.replace(/\D/g, "");
  const phoneClause = digits.length >= 3 ? sql`or c.phone_digits like ${"%" + digits + "%"} or c.phone_alt_digits like ${"%" + digits + "%"}` : sql``;

  const [matterRows, contactRows] = await Promise.all([
    db.execute<{ id: string; display_name: string; number: string; case_number: string; practice_area: string; caption: string }>(sql`
      select m.id, m.display_name, m.number, m.case_number, m.practice_area, m.caption
      from matters m
      where m.archived_at is null and (
        (${tokensMatch(sql`m.display_name`, term)}) or (${tokensMatch(sql`m.caption`, term)})
        or m.case_number ilike ${p} or m.number ilike ${p}
        or exists (select 1 from matter_parties mp join contacts c on c.id = mp.contact_id
                   where mp.matter_id = m.id and ((${tokensMatch(sql`c.display_name`, term)}) ${phoneClause})))
      order by (m.status = 'closed'), m.updated_at desc limit 8`),
    db.execute<{ id: string; display_name: string; phone: string; email: string }>(sql`
      select c.id, c.display_name, c.phone, c.email from contacts c
      where c.archived_at is null and ((${tokensMatch(sql`c.display_name`, term)}) or c.email ilike ${p} ${phoneClause})
      order by similarity(f_unaccent(lower(c.display_name)), f_unaccent(lower(${term}))) desc, c.display_name limit 8`),
  ]);

  return [
    ...matterRows.map((r) => ({
      type: "matter" as const,
      id: r.id,
      title: r.display_name,
      subtitle: [r.number, r.case_number, r.caption].filter(Boolean).join(" · "),
      area: r.practice_area,
    })),
    ...contactRows.map((r) => ({ type: "contact" as const, id: r.id, title: r.display_name, subtitle: [r.phone, r.email].filter(Boolean).join(" · ") })),
  ];
}

export interface ConflictHit {
  contactId: string;
  displayName: string;
  phone: string;
  email: string;
  score: number;
  exact: boolean;
  roles: { matterId: string; matterName: string; number: string; role: string; status: string }[];
}

/**
 * Conflict check: fuzzy, accent-insensitive name matching (trigram similarity) so
 * "Merdado" also finds "Mercado" and "Jose" finds "José". Returns every role the
 * person has played on any matter, so adverse relationships stand out.
 */
export async function conflictSearch(names: string[]): Promise<ConflictHit[]> {
  const terms = [...new Set(names.map((n) => n.replace(/,/g, " ").replace(/\s+/g, " ").trim()).filter((n) => n.length >= 3))];
  if (terms.length === 0) return [];
  const hits = new Map<string, ConflictHit>();

  for (const term of terms) {
    const tokens = term.split(" ").filter((t) => t.length >= 2);
    const rows = await db.execute<{
      id: string;
      display_name: string;
      phone: string;
      email: string;
      score: number;
      roles: { matterId: string; matterName: string; number: string; role: string; status: string }[] | null;
    }>(sql`
      with q as (select f_unaccent(lower(${term})) as term)
      select c.id, c.display_name, c.phone, c.email,
        greatest(
          similarity(f_unaccent(lower(c.display_name)), q.term),
          word_similarity(q.term, f_unaccent(lower(c.first_name || ' ' || c.last_name))),
          similarity(f_unaccent(lower(c.first_name || ' ' || c.last_name)), q.term)
        ) as score,
        (select json_agg(json_build_object('matterId', m.id, 'matterName', m.display_name, 'number', m.number, 'role', mp.role, 'status', m.status))
           from matter_parties mp join matters m on m.id = mp.matter_id where mp.contact_id = c.id) as roles
      from contacts c, q
      where c.archived_at is null and (
        similarity(f_unaccent(lower(c.display_name)), q.term) > 0.3
        or word_similarity(q.term, f_unaccent(lower(c.first_name || ' ' || c.last_name))) > 0.5
        or similarity(f_unaccent(lower(c.first_name || ' ' || c.last_name)), q.term) > 0.3
        ${tokens.length >= 2 ? sql`or (f_unaccent(lower(c.display_name)) like ${"%" + tokens[tokens.length - 1].toLowerCase() + "%"} and f_unaccent(lower(c.display_name)) like ${"%" + tokens[0].toLowerCase() + "%"})` : sql``}
      )
      order by score desc limit 15`);
    for (const r of rows) {
      const prev = hits.get(r.id);
      const score = Number(r.score);
      const normalizedName = r.display_name.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
      const exact = score >= 0.9 || tokens.every((t) => normalizedName.normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")));
      if (!prev || prev.score < score) {
        hits.set(r.id, { contactId: r.id, displayName: r.display_name, phone: r.phone, email: r.email, score, exact, roles: r.roles ?? [] });
      }
    }
  }
  return [...hits.values()].sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score);
}
