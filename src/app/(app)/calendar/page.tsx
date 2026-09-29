import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { QuickButton } from "@/components/app/quick-button";
import { AreaDot } from "@/components/app/area-badge";
import { EventItem, KindIcon } from "@/components/events/event-item";
import { SyncNowButton } from "@/components/events/sync-now";
import { requireStaff } from "@/lib/auth";
import { addDaysISO, formatDate, formatTime, parseISODate, todayISO, toISODate } from "@/lib/dates";
import { listEvents } from "@/server/queries/work";
import { getSettings } from "@/server/queries/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendar" };

export default async function CalendarPage(props: PageProps<"/calendar">) {
  await requireStaff();
  const sp = await props.searchParams;
  const t = await getTranslations("calendar");
  const locale = await getLocale();
  const today = todayISO();
  const view = sp.view === "month" ? "month" : "agenda";
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const settings = await getSettings();
  const calendarConnected = !!(settings.googleRefreshTokenEnc && settings.calendarId);

  const first = parseISODate(`${month}-01`);
  const gridStart = addDaysISO(toISODate(first), -first.getUTCDay());
  const nextMonthDate = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
  const prevMonthDate = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1));
  const gridEnd = addDaysISO(gridStart, 41);

  const from = view === "month" ? gridStart : addDaysISO(today, -7);
  const to = view === "month" ? gridEnd : addDaysISO(today, 90);
  const rows = await listEvents({ from, to });

  const monthLabel = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + i))));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={calendarConnected ? t("connected", { name: settings.calendarName ?? "Google Calendar" }) : t("notConnected")}
        actions={
          <>
            {calendarConnected ? <SyncNowButton /> : null}
            <QuickButton kind="event" label={t("add")} variant="primary" size="md" />
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-0.5 shadow-card">
          <Link href="/calendar" className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-sm", view === "agenda" ? "bg-surface-2 font-medium" : "text-muted hover:text-foreground")}>
            <List className="size-4" /> {t("agenda")}
          </Link>
          <Link href={`/calendar?view=month&month=${month}`} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-sm", view === "month" ? "bg-surface-2 font-medium" : "text-muted hover:text-foreground")}>
            <LayoutGrid className="size-4" /> {t("month")}
          </Link>
        </div>
        {view === "month" ? (
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="icon-sm">
              <Link href={`/calendar?view=month&month=${toISODate(prevMonthDate).slice(0, 7)}`} aria-label={t("prev")}>
                <ChevronLeft />
              </Link>
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold capitalize">{monthLabel}</span>
            <Button asChild variant="ghost" size="icon-sm">
              <Link href={`/calendar?view=month&month=${toISODate(nextMonthDate).slice(0, 7)}`} aria-label={t("next")}>
                <ChevronRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/calendar?view=month&month=${today.slice(0, 7)}`}>{t("today")}</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {view === "month" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface-2/50 text-center text-xs font-medium text-muted">
            {weekdays.map((w) => (
              <div key={w} className="py-2 capitalize">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => {
              const d = addDaysISO(gridStart, i);
              const inMonth = d.slice(0, 7) === month;
              const dayEvents = rows.filter((r) => r.event.date === d);
              return (
                <div key={d} className={cn("min-h-24 border-b border-r border-border p-1.5 sm:min-h-28", !inMonth && "bg-surface-2/40", (i + 1) % 7 === 0 && "border-r-0")}>
                  <div className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs", d === today ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-subtle")}>{Number(d.slice(8))}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 4).map((r) => (
                      <Link
                        key={r.event.id}
                        href={r.event.matterId ? `/matters/${r.event.matterId}?tab=dates` : "/calendar"}
                        className={cn("flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-surface-2", r.event.status !== "scheduled" && "text-subtle line-through")}
                        title={`${r.event.title}${r.matterName ? ` — ${r.matterName}` : ""}`}
                      >
                        <AreaDot area={r.matterArea ?? "general"} className="size-1.5" />
                        {r.event.time ? <span className="text-muted">{formatTime(r.event.time, locale).replace(":00", "")}</span> : <KindIcon kind={r.event.kind} className="size-3 shrink-0 text-muted" />}
                        <span className="truncate">{r.event.title}</span>
                      </Link>
                    ))}
                    {dayEvents.length > 4 ? <div className="px-1 text-[11px] text-muted">+{dayEvents.length - 4}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : rows.length ? (
        <div className="space-y-6">
          {groupByWeek(rows, today).map((g) => (
            <Card key={g.key} className="overflow-hidden">
              <div className="border-b border-border bg-surface-2/50 px-4 py-2 text-xs font-semibold text-muted">
                {g.key === "past" ? t("pastWeek") : `${t("weekOf")} ${formatDate(g.key, locale, { month: "long", day: "numeric", year: undefined })}`}
              </div>
              <div className="divide-y divide-border">
                {g.items.map((r) => (
                  <EventItem key={r.event.id} event={r.event} matterName={r.matterName} matterArea={r.matterArea} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<CalendarDays />} title={t("empty")} description={t("emptyHint")} />
        </Card>
      )}
    </>
  );
}

function groupByWeek<T extends { event: { date: string } }>(rows: T[], today: string) {
  const groups: { key: string; items: T[] }[] = [];
  for (const r of rows) {
    let key: string;
    if (r.event.date < today) key = "past";
    else {
      const d = parseISODate(r.event.date);
      key = addDaysISO(r.event.date, -d.getUTCDay());
    }
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(r);
    else groups.push({ key, items: [r] });
  }
  return groups;
}
