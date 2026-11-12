import Link from "next/link";
import { and, eq, isNull, lt, or, ne } from "drizzle-orm";
import { db } from "@/db";
import { events, matters } from "@/db/schema";
import { officeWorkspace } from "@/server/queries/office-workflows";
import { todayISO } from "@/lib/dates";
import { getTranslations } from "next-intl/server";
import { EventItem } from "@/components/events/event-item";
export async function TodayWork() {
  const data = await officeWorkspace();
  const today = todayISO();
  const t = await getTranslations("office");
  const overdue = await db
    .select({ event: events, matterName: matters.displayName })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .where(
      and(
        isNull(events.deletedAt),
        eq(events.status, "scheduled"),
        lt(events.date, today),
        isNull(matters.archivedAt),
        or(isNull(events.matterId), ne(matters.status, "closed")),
      ),
    );
  const groups = [
    {
      title: t("followups"),
      href: "/follow-ups",
      rows: data.tasks
        .filter((x) => x.category === "follow_up" && !x.completedAt && x.dueDate && x.dueDate <= today)
        .map((x) => ({ id: x.id, label: x.title, date: x.dueDate })),
    },
    {
      title: t("ready_for_review"),
      href: "/paperwork",
      rows: data.paperwork.filter((x) => x.status === "ready_for_review").map((x) => ({ id: x.id, label: x.title, date: x.targetDate })),
    },
    {
      title: t("no_next_action"),
      href: "/case-progress",
      rows: data.cases
        .filter((x) => !data.tasks.some((task) => task.id === x.nextActionId && !task.completedAt))
        .map((x) => ({ id: x.id, label: x.displayName, date: null })),
    },
  ];
  return (
    <section className="mb-6 space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.href} className="rounded-xl border bg-surface p-4">
            <Link href={group.href} className="font-semibold text-primary">
              {group.title} ({group.rows.length})
            </Link>
            <ul className="mt-2 space-y-2">
              {group.rows.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <Link href={group.href}>{row.label}</Link> <span className="text-muted">{row.date}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {overdue.length > 0 && (
        <div className="rounded-xl border bg-surface">
          <h2 className="p-4 font-semibold">{t("overdueEvents")}</h2>
          {overdue.map((row) => (
            <EventItem key={row.event.id} event={row.event} matterName={row.matterName} />
          ))}
        </div>
      )}
    </section>
  );
}
