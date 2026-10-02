import "server-only";
import { and, asc, desc, eq, gte, isNull, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { courtHolidays, events, matters, staff, tasks } from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/dates";
import { logged } from "@/lib/logged";

export async function listTasks(opts: { assignee?: string | null; scope?: "open" | "done"; matterId?: string } = {}) {
  const where: SQL[] = [];
  if (opts.assignee === "unassigned") where.push(isNull(tasks.assigneeId));
  else if (opts.assignee) where.push(eq(tasks.assigneeId, opts.assignee));
  if (opts.matterId) where.push(eq(tasks.matterId, opts.matterId));
  if (opts.scope === "done") where.push(isNotNull(tasks.completedAt));
  else where.push(isNull(tasks.completedAt));
  const assignee = alias(staff, "assignee");
  return db
    .select({
      task: tasks,
      assigneeName: assignee.name,
      matterName: matters.displayName,
      matterArea: matters.practiceArea,
    })
    .from(tasks)
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .leftJoin(matters, eq(matters.id, tasks.matterId))
    .where(and(...where))
    .orderBy(opts.scope === "done" ? desc(tasks.completedAt) : sql`${tasks.dueDate} asc nulls last`, desc(tasks.urgent), desc(tasks.createdAt))
    .limit(500);
}
export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

export async function listEvents(opts: { from: string; to: string; assignee?: string; area?: string }) {
  const where: SQL[] = [isNull(events.deletedAt), gte(events.date, opts.from), lte(events.date, opts.to)];
  if (opts.assignee) where.push(eq(matters.assigneeId, opts.assignee));
  if (opts.area) where.push(eq(matters.practiceArea, opts.area));
  return db
    .select({
      event: events,
      matterName: matters.displayName,
      matterArea: matters.practiceArea,
      caseNumber: matters.caseNumber,
      assigneeName: staff.name,
    })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(staff, eq(staff.id, matters.assigneeId))
    .where(and(...where))
    .orderBy(asc(events.date), sql`${events.time} asc nulls first`);
}
export type EventRow = Awaited<ReturnType<typeof listEvents>>[number];

export async function getHolidaySet(): Promise<Set<string>> {
  const rows = await db.select({ date: courtHolidays.date }).from(courtHolidays);
  return new Set(rows.map((r) => r.date));
}

export async function listHolidays() {
  return db.select().from(courtHolidays).orderBy(asc(courtHolidays.date));
}

export async function dashboard(meId: string) {
  const today = todayISO();
  const in14 = addDaysISO(today, 14);
  const assignee = alias(staff, "assignee");

  const [myTasks, upcoming, intakes, balances, recent, counts] = await Promise.all([
    logged(
      "dashboard.myTasks",
      db
        .select({ task: tasks, matterName: matters.displayName, matterArea: matters.practiceArea })
        .from(tasks)
        .leftJoin(matters, eq(matters.id, tasks.matterId))
        .where(and(eq(tasks.assigneeId, meId), isNull(tasks.completedAt), sql`(${tasks.dueDate} is null or ${tasks.dueDate} <= ${addDaysISO(today, 7)}::date)`))
        .orderBy(sql`${tasks.dueDate} asc nulls last`, desc(tasks.urgent))
        .limit(12),
    ),
    logged(
      "dashboard.upcoming",
      listEvents({ from: today, to: in14 }).then((rows) => rows.filter((r) => r.event.status === "scheduled")),
    ),
    logged(
      "dashboard.intakes",
      db
        .select({
          id: matters.id,
          displayName: matters.displayName,
          practiceArea: matters.practiceArea,
          openedOn: matters.openedOn,
          assigneeName: assignee.name,
        })
        .from(matters)
        .leftJoin(assignee, eq(assignee.id, matters.assigneeId))
        .where(and(eq(matters.status, "intake"), isNull(matters.archivedAt)))
        .orderBy(asc(matters.openedOn))
        .limit(8),
    ),
    logged(
      "dashboard.balances",
      db.execute<{ id: string; display_name: string; practice_area: string; balance: number }>(sql`
      select m.id, m.display_name, m.practice_area,
        coalesce(sum(case when l.kind = 'payment' then -l.amount_cents else l.amount_cents end), 0)::int as balance
      from matters m join ledger_entries l on l.matter_id = m.id
      where m.archived_at is null
      group by m.id having coalesce(sum(case when l.kind = 'payment' then -l.amount_cents else l.amount_cents end), 0) > 0
      order by balance desc limit 8`),
    ),
    logged(
      "dashboard.recent",
      db
        .select({
          id: matters.id,
          displayName: matters.displayName,
          practiceArea: matters.practiceArea,
          stage: matters.stage,
          side: matters.side,
          updatedAt: matters.updatedAt,
        })
        .from(matters)
        .where(isNull(matters.archivedAt))
        .orderBy(desc(matters.updatedAt))
        .limit(6),
    ),
    logged(
      "dashboard.counts",
      db.execute<{ open_matters: number; overdue_tasks: number; total_balance: number; week_events: number }>(sql`
      select
        (select count(*)::int from matters where archived_at is null and status in ('intake','active')) as open_matters,
        (select count(*)::int from tasks where completed_at is null and due_date < ${today}::date and assignee_id = ${meId}) as overdue_tasks,
        (select coalesce(sum(case when kind = 'payment' then -amount_cents else amount_cents end), 0)::int from ledger_entries l
          join matters m on m.id = l.matter_id where m.archived_at is null) as total_balance,
        (select count(*)::int from events where deleted_at is null and status = 'scheduled' and date between ${today}::date and ${addDaysISO(today, 7)}::date) as week_events`),
    ),
  ]);

  return { today, myTasks, upcoming, intakes, balances: [...balances], recent, counts: counts[0] };
}
