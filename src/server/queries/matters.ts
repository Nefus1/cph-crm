import "server-only";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { activities, checklistItems, contacts, events, ledgerEntries, matterParties, matters, staff, tasks } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { balanceSql, likePattern, nextEventSql, primaryClientIdSql, primaryClientSql, tokensMatch } from "./common";

export interface MatterFilters {
  area?: string;
  status?: string; // open (intake+active) | intake | active | closed | all
  assignee?: string;
  stage?: string;
  q?: string;
  balance?: boolean;
}

export async function listMatters(f: MatterFilters = {}) {
  const today = todayISO();
  const m = matters;
  const where: SQL[] = [isNull(m.archivedAt)];
  if (f.area && f.area !== "all") where.push(eq(m.practiceArea, f.area));
  const status = f.status ?? "open";
  if (status === "open") where.push(sql`${m.status} in ('intake','active')`);
  else if (status !== "all") where.push(eq(m.status, status));
  if (f.assignee === "unassigned") where.push(isNull(m.assigneeId));
  else if (f.assignee) where.push(eq(m.assigneeId, f.assignee));
  if (f.stage) where.push(eq(m.stage, f.stage));
  if (f.q) {
    const q = f.q.trim();
    const p = likePattern(q);
    where.push(sql`((${tokensMatch(m.displayName, q)}) or (${tokensMatch(m.caption, q)})
      or ${m.caseNumber} ilike ${p} or ${m.number} ilike ${p}
      or exists (select 1 from matter_parties mp join contacts c on c.id = mp.contact_id where mp.matter_id = ${m.id} and (${tokensMatch(sql`c.display_name`, q)})))`);
  }
  if (f.balance) where.push(sql`${balanceSql(sql`${m.id}`)} > 0`);

  const assignee = alias(staff, "assignee");
  const rows = await db
    .select({
      id: m.id,
      number: m.number,
      displayName: m.displayName,
      caption: m.caption,
      practiceArea: m.practiceArea,
      matterType: m.matterType,
      side: m.side,
      stage: m.stage,
      status: m.status,
      caseNumber: m.caseNumber,
      courthouse: m.courthouse,
      openedOn: m.openedOn,
      updatedAt: m.updatedAt,
      assigneeId: m.assigneeId,
      assigneeName: assignee.name,
      clientName: sql<string | null>`(select c.display_name from matter_parties mp join contacts c on c.id = mp.contact_id
        where mp.matter_id = ${m.id} and mp.role in ('client','co_client') order by (mp.role = 'client') desc, mp.is_primary desc, mp.created_at limit 1)`,
      balance: balanceSql(sql`${m.id}`),
      nextDate: sql<string | null>`(select min(e.date)::text from events e where e.matter_id = ${m.id} and e.deleted_at is null and e.status = 'scheduled' and e.date >= ${today}::date)`,
      openTasks: sql<number>`(select count(*)::int from tasks t where t.matter_id = ${m.id} and t.completed_at is null)`,
    })
    .from(m)
    .leftJoin(assignee, eq(assignee.id, m.assigneeId))
    .where(and(...where))
    .orderBy(desc(m.updatedAt))
    .limit(500);
  return rows;
}
export type MatterRow = Awaited<ReturnType<typeof listMatters>>[number];

export async function getMatter(id: string) {
  const matter = await db.query.matters.findFirst({ where: eq(matters.id, id) });
  if (!matter) return null;

  const [parties, checklist, taskRows, eventRows, activityRows, ledger, balanceRow] = await Promise.all([
    db
      .select({ party: matterParties, contact: contacts })
      .from(matterParties)
      .innerJoin(contacts, eq(contacts.id, matterParties.contactId))
      .where(eq(matterParties.matterId, id))
      .orderBy(sql`case ${matterParties.role} when 'client' then 0 when 'co_client' then 1 when 'opposing_party' then 2 else 3 end`, asc(matterParties.createdAt)),
    db.select().from(checklistItems).where(eq(checklistItems.matterId, id)).orderBy(asc(checklistItems.position)),
    db
      .select({ task: tasks, assigneeName: staff.name })
      .from(tasks)
      .leftJoin(staff, eq(staff.id, tasks.assigneeId))
      .where(eq(tasks.matterId, id))
      .orderBy(sql`${tasks.completedAt} is not null`, sql`${tasks.dueDate} asc nulls last`, desc(tasks.createdAt)),
    db
      .select()
      .from(events)
      .where(and(eq(events.matterId, id), isNull(events.deletedAt)))
      .orderBy(asc(events.date), sql`${events.time} asc nulls first`),
    db
      .select({ activity: activities, authorName: staff.name })
      .from(activities)
      .leftJoin(staff, eq(staff.id, activities.authorId))
      .where(eq(activities.matterId, id))
      .orderBy(desc(activities.occurredAt))
      .limit(200),
    db.select({ entry: ledgerEntries, authorName: staff.name }).from(ledgerEntries).leftJoin(staff, eq(staff.id, ledgerEntries.createdBy)).where(eq(ledgerEntries.matterId, id)).orderBy(asc(ledgerEntries.entryDate), asc(ledgerEntries.createdAt)),
    db.execute<{ balance: number }>(sql`select ${balanceSql(sql`${id}::uuid`)} as balance`),
  ]);

  const assignee = matter.assigneeId ? await db.query.staff.findFirst({ where: eq(staff.id, matter.assigneeId) }) : null;
  return {
    matter,
    assignee,
    parties,
    checklist,
    tasks: taskRows,
    events: eventRows,
    activities: activityRows,
    ledger,
    balance: Number(balanceRow[0]?.balance ?? 0),
  };
}
export type MatterDetail = NonNullable<Awaited<ReturnType<typeof getMatter>>>;

/** Lightweight list for pickers (task/event dialogs). */
export async function matterOptions() {
  return db
    .select({ id: matters.id, displayName: matters.displayName, number: matters.number, practiceArea: matters.practiceArea })
    .from(matters)
    .where(and(isNull(matters.archivedAt), sql`${matters.status} <> 'closed'`))
    .orderBy(asc(matters.displayName));
}
export type MatterOption = Awaited<ReturnType<typeof matterOptions>>[number];

export { primaryClientSql, primaryClientIdSql, nextEventSql };
