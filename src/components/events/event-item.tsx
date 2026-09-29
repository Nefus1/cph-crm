"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CalendarCheck2, CheckCircle2, CloudOff, Gavel, MoreHorizontal, Pencil, RefreshCw, Timer, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { AreaDot } from "@/components/app/area-badge";
import { useAppData } from "@/components/app/app-data";
import { useQuickActions } from "@/components/app/quick-actions";
import { deleteEvent, retryEventSync, setEventStatus } from "@/server/actions/work";
import type { CalEvent } from "@/db/schema";
import { formatDate, formatTime, relativeDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = kind === "hearing" ? Gavel : kind === "deadline" ? Timer : Users;
  return <Icon className={className} />;
}

export function EventItem({
  event,
  matterName,
  matterArea,
  showMatter = true,
  compact,
}: {
  event: CalEvent;
  matterName?: string | null;
  matterArea?: string | null;
  showMatter?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const { locale, googleCalendar } = useAppData();
  const quick = useQuickActions();
  const [pending, start] = useTransition();
  const d = relativeDays(event.date);
  const inactive = event.status !== "scheduled";

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Error");
      else if (msg) toast.success(msg);
    });

  return (
    <div className={cn("group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60", pending && "opacity-60")}>
      <div
        className={cn(
          "flex w-12 shrink-0 flex-col items-center rounded-lg border py-1 text-center",
          inactive ? "border-border text-subtle" : d < 0 ? "border-danger/30 bg-danger-soft text-danger" : d <= 2 ? "border-warning/30 bg-warning-soft text-warning" : "border-border bg-surface-2 text-foreground",
        )}
      >
        <span className="text-[10px] font-semibold uppercase leading-3">{formatDate(event.date, locale, { month: "short", day: undefined, year: undefined })}</span>
        <span className="text-base font-semibold leading-5">{event.date.slice(8, 10).replace(/^0/, "")}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("flex flex-wrap items-center gap-1.5 text-sm", inactive && "text-muted line-through")}>
          <KindIcon kind={event.kind} className="size-3.5 shrink-0 text-muted" />
          <span className="font-medium">{event.title}</span>
          {event.status !== "scheduled" ? <Badge tone={event.status === "done" ? "success" : "neutral"}>{t(`status.${event.status as "done"}`)}</Badge> : null}
          {event.computedFrom ? <Badge tone="warning" title={event.computedFrom}>{t("computed")}</Badge> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
          <span>{formatDate(event.date, locale, { weekday: "short", month: "short", day: "numeric", year: undefined })}</span>
          {event.time ? <span>{formatTime(event.time, locale)}</span> : <span>{t("allDay")}</span>}
          {event.location && !compact ? <span className="truncate">{event.location}</span> : null}
          {showMatter && event.matterId && matterName ? (
            <Link href={`/matters/${event.matterId}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground">
              <AreaDot area={matterArea ?? "general"} />
              <span className="truncate">{matterName}</span>
            </Link>
          ) : null}
          {event.ladder !== "none" && !compact ? <span>{t(`ladderShort.${event.ladder as "filing"}`)}</span> : null}
          {googleCalendar && event.syncStatus === "error" ? (
            <span className="inline-flex items-center gap-1 text-danger" title={event.syncError ?? ""}>
              <AlertTriangle className="size-3" /> {t("syncError")}
            </span>
          ) : googleCalendar && event.syncStatus === "synced" && !compact ? (
            <span className="inline-flex items-center gap-1" title={t("synced")}>
              <CalendarCheck2 className="size-3" />
            </span>
          ) : googleCalendar && event.syncStatus === "off" && !compact ? (
            <span className="inline-flex items-center gap-1" title={t("notSynced")}>
              <CloudOff className="size-3" />
            </span>
          ) : null}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-md p-1 text-subtle opacity-60 hover:bg-surface-2 hover:text-foreground group-hover:opacity-100" aria-label={tc("more")}>
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() =>
              quick.open({
                kind: "event",
                lockMatter: false,
                initial: {
                  id: event.id,
                  matterId: event.matterId,
                  kind: event.kind as "hearing",
                  title: event.title,
                  date: event.date,
                  time: event.time,
                  durationMinutes: event.durationMinutes,
                  location: event.location,
                  notes: event.notes,
                  ladder: event.ladder as "filing",
                  status: event.status as "scheduled",
                  computedFrom: event.computedFrom,
                },
              })
            }
          >
            <Pencil /> {tc("edit")}
          </DropdownMenuItem>
          {event.status === "scheduled" ? (
            <DropdownMenuItem onSelect={() => act(() => setEventStatus(event.id, "done"), t("markedDone"))}>
              <CheckCircle2 /> {t("markDone")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => act(() => setEventStatus(event.id, "scheduled"))}>
              <Timer /> {t("reopen")}
            </DropdownMenuItem>
          )}
          {googleCalendar && event.syncStatus !== "synced" ? (
            <DropdownMenuItem onSelect={() => act(() => retryEventSync(event.id), t("synced"))}>
              <RefreshCw /> {t("retrySync")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger" onSelect={() => act(() => deleteEvent(event.id), t("deleted"))}>
            <Trash2 /> {tc("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
