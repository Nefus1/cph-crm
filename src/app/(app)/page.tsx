import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Briefcase, CalendarDays, CheckSquare, CircleDollarSign, Clock, Inbox, Plus } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { AreaBadge, AreaDot } from "@/components/app/area-badge";
import { TaskItem } from "@/components/tasks/task-item";
import { EventItem } from "@/components/events/event-item";
import { QuickButton } from "@/components/app/quick-button";
import { stageLabel } from "@/config/practice-areas";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateLong, relativeDays } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { dashboard } from "@/server/queries/work";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const me = await requireStaff();
  const locale = await getLocale();
  const t = await getTranslations("today");
  const data = await dashboard(me.id);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(new Date()));
  const greeting = hour < 12 ? t("morning") : hour < 18 ? t("afternoon") : t("evening");
  const firstName = (me.name || "").split(" ")[0];

  const stats = [
    { label: t("stats.openMatters"), value: String(data.counts.open_matters), icon: Briefcase, href: "/matters" },
    { label: t("stats.thisWeek"), value: String(data.counts.week_events), icon: CalendarDays, href: "/calendar" },
    { label: t("stats.overdue"), value: String(data.counts.overdue_tasks), icon: Clock, href: "/tasks", danger: data.counts.overdue_tasks > 0 },
    { label: t("stats.outstanding"), value: formatCents(data.counts.total_balance, locale), icon: CircleDollarSign, href: "/matters?balance=1" },
  ];

  return (
    <>
      <PageHeader
        eyebrow={formatDateLong(data.today, locale)}
        title={`${greeting}${firstName ? `, ${firstName}` : ""}`}
        actions={
          <Button asChild variant="primary">
            <Link href="/matters/new">
              <Plus /> {t("newIntake")}
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              {s.label}
              <s.icon className="size-4 text-subtle group-hover:text-muted" />
            </div>
            <div className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${s.danger ? "text-danger" : ""}`}>{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              icon={<CalendarDays />}
              title={t("upcoming")}
              description={t("upcomingHint")}
              action={
                <>
                  <QuickButton kind="event" label={t("addDate")} />
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/calendar">
                      {t("viewAll")} <ArrowRight />
                    </Link>
                  </Button>
                </>
              }
            />
            {data.upcoming.length ? (
              <div className="divide-y divide-border">
                {data.upcoming.map((r) => (
                  <EventItem key={r.event.id} event={r.event} matterName={r.matterName} matterArea={r.matterArea} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<CalendarDays />} title={t("noUpcoming")} description={t("noUpcomingHint")} />
            )}
          </Card>

          <Card>
            <CardHeader
              icon={<CheckSquare />}
              title={t("myTasks")}
              description={t("myTasksHint")}
              action={
                <>
                  <QuickButton kind="task" label={t("addTask")} />
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/tasks">
                      {t("viewAll")} <ArrowRight />
                    </Link>
                  </Button>
                </>
              }
            />
            {data.myTasks.length ? (
              <div className="divide-y divide-border">
                {data.myTasks.map((r) => (
                  <TaskItem key={r.task.id} task={{ ...r.task, matterName: r.matterName, matterArea: r.matterArea }} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<CheckSquare />} title={t("noTasks")} description={t("noTasksHint")} />
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader icon={<Inbox />} title={t("intakes")} description={t("intakesHint")} />
            {data.intakes.length ? (
              <ul className="divide-y divide-border">
                {data.intakes.map((m) => (
                  <li key={m.id}>
                    <Link href={`/matters/${m.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                      <AreaBadge area={m.practiceArea} locale={locale as "en"} />
                      <span className="min-w-0 flex-1 truncate text-sm">{m.displayName}</span>
                      <span className={`text-xs ${relativeDays(m.openedOn) < -7 ? "text-warning" : "text-muted"}`}>{formatDate(m.openedOn, locale, { month: "short", day: "numeric", year: undefined })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("noIntakes")} className="py-6" />
            )}
          </Card>

          <Card>
            <CardHeader
              icon={<CircleDollarSign />}
              title={t("balances")}
              description={t("balancesHint")}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/matters?balance=1">
                    {t("viewAll")} <ArrowRight />
                  </Link>
                </Button>
              }
            />
            {data.balances.length ? (
              <ul className="divide-y divide-border">
                {data.balances.map((m) => (
                  <li key={m.id}>
                    <Link href={`/matters/${m.id}?tab=billing`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                      <AreaDot area={m.practice_area} />
                      <span className="min-w-0 flex-1 truncate text-sm">{m.display_name}</span>
                      <span className="text-sm font-medium tabular-nums">{formatCents(m.balance, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("noBalances")} className="py-6" />
            )}
          </Card>

          <Card>
            <CardHeader icon={<Briefcase />} title={t("recent")} />
            <ul className="divide-y divide-border">
              {data.recent.map((m) => (
                <li key={m.id}>
                  <Link href={`/matters/${m.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                    <AreaDot area={m.practiceArea} />
                    <span className="min-w-0 flex-1 truncate text-sm">{m.displayName}</span>
                    <span className="truncate text-xs text-muted">{stageLabel(m.practiceArea, m.side, m.stage, locale)}</span>
                  </Link>
                </li>
              ))}
              {data.recent.length === 0 ? <EmptyState title={t("noMatters")} className="py-6" /> : null}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
