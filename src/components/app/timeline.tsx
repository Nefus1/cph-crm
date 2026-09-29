"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/card";
import { addActivity, deleteActivity } from "@/server/actions/work";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, ActivityIcon } from "./activity-icon";
import { useAppData } from "./app-data";

export interface TimelineEntry {
  id: string;
  type: string;
  body: string;
  occurredAt: Date | string;
  authorId: string | null;
  authorName: string | null;
  matterId?: string | null;
  matterName?: string | null;
}

export function TimelineComposer({ matterId, contactId }: { matterId?: string; contactId?: string }) {
  const t = useTranslations("timeline");
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]>("note");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function save() {
    if (!body.trim()) return;
    start(async () => {
      const r = await addActivity({ type, body, matterId: matterId ?? null, contactId: contactId ?? null });
      if (r.ok) {
        setBody("");
        toast.success(t("logged"));
      } else toast.error(r.error);
    });
  }

  return (
    <div className="rounded-card border border-border bg-surface shadow-card focus-within:border-ring/50">
      <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
        {ACTIVITY_TYPES.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors", type === k ? "bg-primary-soft text-primary-soft-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground")}
          >
            <ActivityIcon type={k} className="size-3.5" />
            {t(`type.${k}`)}
          </button>
        ))}
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
        placeholder={t(`placeholder.${type}`)}
        rows={3}
        className="rounded-none border-0 shadow-none focus:ring-0"
      />
      <div className="flex items-center justify-between px-3 pb-2.5">
        <span className="text-[11px] text-subtle">{t("shortcut")}</span>
        <Button size="sm" variant="primary" onClick={save} disabled={pending || !body.trim()}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

export function TimelineList({ entries, showMatter }: { entries: TimelineEntry[]; showMatter?: boolean }) {
  const t = useTranslations("timeline");
  const { locale, me } = useAppData();
  const [, start] = useTransition();
  if (!entries.length) return <EmptyState title={t("empty")} description={t("emptyHint")} />;

  const days = entries.map((e) => new Date(e.occurredAt).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }));
  return (
    <ol className="relative">
      {entries.map((e, idx) => {
        const d = new Date(e.occurredAt);
        const header = idx === 0 || days[idx] !== days[idx - 1] ? days[idx] : null;
        const system = e.type === "system" || e.type === "stage_change" || e.type === "payment";
        const canDelete = !system && (me.role === "admin" || e.authorId === me.id);
        return (
          <li key={e.id}>
            {header ? <div className="sticky top-14 z-10 bg-background/90 py-2 text-xs font-semibold text-muted backdrop-blur">{formatDate(header, locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div> : null}
            <div className="group relative flex gap-3 pb-4 pl-1">
              <div className={cn("relative z-[1] mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background", system ? "bg-surface-2 text-subtle" : "bg-primary-soft text-primary-soft-foreground")}>
                <ActivityIcon type={e.type} className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  {!system ? <span className="font-medium text-foreground">{t(`type.${e.type as "note"}`)}</span> : null}
                  <span>{e.authorName ?? t("system")}</span>
                  <span>·</span>
                  <span>{formatDateTime(d, locale)}</span>
                  {showMatter && e.matterId && e.matterName ? (
                    <>
                      <span>·</span>
                      <Link href={`/matters/${e.matterId}?tab=timeline`} className="truncate hover:text-foreground">
                        {e.matterName}
                      </Link>
                    </>
                  ) : null}
                </div>
                <p className={cn("mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed", system && "text-muted")}>{e.body}</p>
              </div>
              {canDelete ? (
                <button
                  className="h-fit rounded p-1 text-subtle opacity-0 hover:text-danger group-hover:opacity-100"
                  aria-label={t("delete")}
                  onClick={() =>
                    confirm(t("deleteConfirm")) &&
                    start(async () => {
                      const r = await deleteActivity(e.id);
                      if (!r.ok) toast.error(r.error);
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
