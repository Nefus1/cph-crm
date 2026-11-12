import "server-only";
import { and, eq, isNull, ne, asc } from "drizzle-orm";
import { db } from "@/db";
import { matters, tasks, staff, contacts, matterParties, paperworkItems, documentRequests, paperworkTemplates } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
export async function officeWorkspace(matterId?: string) {
  const me = await requireStaff();
  const active = and(isNull(matters.archivedAt), ne(matters.status, "closed"), matterId ? eq(matters.id, matterId) : undefined);
  const [cases, people, team, taskRows, paperwork, requests, templates] = await Promise.all([
    db.select().from(matters).where(active).orderBy(asc(matters.displayName)),
    db
      .select({ contact: contacts, matterId: matterParties.matterId })
      .from(matterParties)
      .innerJoin(contacts, eq(contacts.id, matterParties.contactId))
      .innerJoin(matters, eq(matters.id, matterParties.matterId))
      .where(and(active, isNull(contacts.archivedAt))),
    db.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.active, true)),
    db.select({ row: tasks }).from(tasks).innerJoin(matters, eq(matters.id, tasks.matterId)).where(active),
    db.select({ row: paperworkItems }).from(paperworkItems).innerJoin(matters, eq(matters.id, paperworkItems.matterId)).where(active),
    db.select({ row: documentRequests }).from(documentRequests).innerJoin(matters, eq(matters.id, documentRequests.matterId)).where(active),
    db.select().from(paperworkTemplates),
  ]);
  return {
    me: { id: me.id, admin: me.role === "admin" },
    cases,
    people,
    team,
    tasks: taskRows.map((r) => r.row),
    paperwork: paperwork.map((r) => r.row),
    requests: requests.map((r) => r.row),
    templates,
  };
}
export type OfficeWorkspace = Awaited<ReturnType<typeof officeWorkspace>>;
