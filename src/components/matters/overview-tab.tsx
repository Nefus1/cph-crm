import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, CheckSquare, CircleDollarSign, FileText, Info, ListChecks } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { DefList } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { EventItem } from "@/components/events/event-item";
import { TaskItem } from "@/components/tasks/task-item";
import { QuickButton } from "@/components/app/quick-button";
import { areaConfig, optionLabel, t as tl, type Locale } from "@/config/practice-areas";
import { formatDate, relativeDays, todayISO } from "@/lib/dates";
import { formatCents, parseMoneyToCents } from "@/lib/money";
import { ab1482Anniversary } from "@/lib/deadlines/ud";
import type { MatterDetail } from "@/server/queries/matters";
import { Checklist } from "./checklist";
import { PartiesCard } from "./parties-card";

export async function OverviewTab({ data, locale }: { data: MatterDetail; locale: Locale }) {
  const t = await getTranslations("matter");
  const { matter } = data;
  const cfg = areaConfig(matter.practiceArea);
  const details = matter.details ?? {};
  const today = todayISO();

  const areaItems = cfg.fields
    .map((f) => {
      const v = details[f.key];
      if (!v) return null;
      let value: string = v;
      if (f.type === "select") value = optionLabel(f.options, v, locale);
      else if (f.type === "date") value = formatDate(v, locale);
      else if (f.type === "money") value = formatCents(parseMoneyToCents(v) ?? 0, locale);
      return { label: tl(f.label, locale), value };
    })
    .filter(Boolean) as { label: string; value: string }[];

  const upcoming = data.events.filter((e) => e.status === "scheduled" && e.date >= today).slice(0, 4);
  const overdueEvents = data.events.filter((e) => e.status === "scheduled" && e.date < today);
  const openTasks = data.tasks.filter((x) => !x.task.completedAt).slice(0, 5);
  const ab1482 = matter.practiceArea === "ud" && details.tenancy_start ? ab1482Anniversary(details.tenancy_start) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {ab1482 && relativeDays(ab1482) > -1 ? (
          <div className="flex gap-3 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <span className="font-medium">{t("ab1482Title", { date: formatDate(ab1482, locale) })}</span>{" "}
              <span className="text-muted">{t("ab1482Body")}</span>
            </div>
          </div>
        ) : null}
        <Card>
          <CardHeader icon={<FileText />} title={t("details")} />
          <CardBody className="space-y-5">
            <DefList
              items={[
                { label: t("f.type"), value: optionLabel(cfg.types, matter.matterType, locale) },
                { label: t("f.side"), value: matter.side !== "na" ? optionLabel(cfg.sides, matter.side, locale) : "" },
                { label: t("f.opened"), value: formatDate(matter.openedOn, locale) },
                { label: t("f.closed"), value: matter.closedOn ? formatDate(matter.closedOn, locale) : "" },
                { label: t("f.supervising"), value: matter.supervisingAttorney },
                { label: t("f.assignee"), value: data.assignee?.name ?? "" },
                { label: t("f.court"), value: [matter.courthouse, matter.department].filter(Boolean).join(" · ") },
                { label: t("f.judge"), value: matter.judge },
                { label: t("f.fee"), value: matter.feeType === "flat" && matter.flatFeeCents ? `${formatCents(matter.flatFeeCents, locale)} ${t("flat")}` : matter.feeType === "hourly" ? t("hourly") : "" },
              ]}
            />
            {areaItems.length ? (
              <div className="border-t border-border pt-5">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{tl(cfg.label, locale)}</h4>
                <DefList items={areaItems} />
              </div>
            ) : null}
            {matter.summary ? (
              <div className="border-t border-border pt-5">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("summary")}</h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{matter.summary}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<ListChecks />}
            title={t("checklist")}
            description={t("checklistHint", { done: data.checklist.filter((c) => c.doneAt).length, total: data.checklist.length })}
          />
          <Checklist matterId={matter.id} items={data.checklist} />
        </Card>

        <PartiesCard matterId={matter.id} parties={data.parties} locale={locale} />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader
            icon={<CircleDollarSign />}
            title={t("balance")}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href={`/matters/${matter.id}?tab=billing`}>{t("openBilling")}</Link>
              </Button>
            }
          />
          <CardBody>
            <div className={`text-2xl font-semibold tabular-nums ${data.balance > 0 ? "" : "text-success"}`}>{formatCents(data.balance, locale)}</div>
            <p className="mt-1 text-xs text-muted">{data.balance > 0 ? t("balanceDue") : t("paidInFull")}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<CalendarDays />} title={t("nextDates")} action={<QuickButton kind="event" matterId={matter.id} label={t("add")} />} />
          {overdueEvents.length ? (
            <Link href={`/matters/${matter.id}?tab=dates`} className="block border-b border-border bg-danger-soft px-4 py-2 text-xs font-medium text-danger">
              {t("pastDatesOpen", { count: overdueEvents.length })}
            </Link>
          ) : null}
          {upcoming.length ? (
            <div className="divide-y divide-border">
              {upcoming.map((e) => (
                <EventItem key={e.id} event={e} showMatter={false} compact />
              ))}
            </div>
          ) : (
            <EmptyState title={t("noDates")} className="py-6" />
          )}
        </Card>

        <Card>
          <CardHeader icon={<CheckSquare />} title={t("openTasks")} action={<QuickButton kind="task" matterId={matter.id} label={t("add")} />} />
          {openTasks.length ? (
            <div className="divide-y divide-border">
              {openTasks.map((x) => (
                <TaskItem key={x.task.id} task={x.task} showMatter={false} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("noTasks")} className="py-6" />
          )}
        </Card>
      </div>
    </div>
  );
}
