import "server-only";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts, matterParties, matters, staff } from "@/db/schema";
import { likePattern } from "./common";

export async function listContacts(opts: { q?: string; filter?: string } = {}) {
  const where: SQL[] = [isNull(contacts.archivedAt)];
  if (opts.q) {
    const q = opts.q.trim();
    const p = likePattern(q);
    const digits = q.replace(/\D/g, "");
    where.push(
      sql`(f_unaccent(${contacts.displayName}) ilike f_unaccent(${p}) or ${contacts.email} ilike ${p}
        ${digits.length >= 3 ? sql`or ${contacts.phoneDigits} like ${"%" + digits + "%"} or ${contacts.phoneAltDigits} like ${"%" + digits + "%"}` : sql``})`,
    );
  }
  if (opts.filter === "clients") where.push(sql`exists (select 1 from matter_parties mp where mp.contact_id = ${contacts.id} and mp.role in ('client','co_client'))`);
  if (opts.filter === "others") where.push(sql`not exists (select 1 from matter_parties mp where mp.contact_id = ${contacts.id} and mp.role in ('client','co_client'))`);

  return db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      kind: contacts.kind,
      phone: contacts.phone,
      email: contacts.email,
      city: contacts.city,
      preferredLanguage: contacts.preferredLanguage,
      updatedAt: contacts.updatedAt,
      matterCount: sql<number>`(select count(distinct mp.matter_id)::int from matter_parties mp where mp.contact_id = ${contacts.id})`,
      roles: sql<string[]>`coalesce((select array_agg(distinct mp.role) from matter_parties mp where mp.contact_id = ${contacts.id}), '{}')`,
    })
    .from(contacts)
    .where(and(...where))
    .orderBy(asc(contacts.displayName))
    .limit(500);
}
export type ContactRow = Awaited<ReturnType<typeof listContacts>>[number];

export async function getContact(id: string) {
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  if (!contact) return null;
  const [matterRows, activityRows] = await Promise.all([
    db
      .select({
        role: matterParties.role,
        matterId: matters.id,
        displayName: matters.displayName,
        caption: matters.caption,
        number: matters.number,
        practiceArea: matters.practiceArea,
        side: matters.side,
        stage: matters.stage,
        status: matters.status,
        caseNumber: matters.caseNumber,
        balance: sql<number>`coalesce((select sum(case when l.kind = 'payment' then -l.amount_cents else l.amount_cents end) from ledger_entries l where l.matter_id = ${matters.id}), 0)::int`,
      })
      .from(matterParties)
      .innerJoin(matters, eq(matters.id, matterParties.matterId))
      .where(eq(matterParties.contactId, id))
      .orderBy(desc(matters.openedOn)),
    db
      .select({ activity: activities, authorName: staff.name, matterName: matters.displayName })
      .from(activities)
      .leftJoin(staff, eq(staff.id, activities.authorId))
      .leftJoin(matters, eq(matters.id, activities.matterId))
      .where(
        sql`${activities.contactId} = ${id} or ${activities.matterId} in (select mp.matter_id from matter_parties mp where mp.contact_id = ${id} and mp.role in ('client','co_client'))`,
      )
      .orderBy(desc(activities.occurredAt))
      .limit(100),
  ]);
  return { contact, matters: matterRows, activities: activityRows };
}
export type ContactDetail = NonNullable<Awaited<ReturnType<typeof getContact>>>;
