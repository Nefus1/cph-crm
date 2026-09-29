"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { stagesFor, t as tl, type Locale } from "@/config/practice-areas";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { setMatterStage } from "@/server/actions/matters";
import type { MatterRow } from "@/server/queries/matters";
import { Avatar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function MatterBoard({ rows, area, side, locale }: { rows: MatterRow[]; area: string; side: string | null; locale: Locale }) {
  const t = useTranslations("matters");
  const stages = stagesFor(area, side);
  const [, start] = useTransition();
  const [items, move] = useOptimistic(rows, (state, { id, stage }: { id: string; stage: string }) => state.map((r) => (r.id === id ? { ...r, stage } : r)));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const stage = e.over ? String(e.over.id) : null;
    const row = items.find((r) => r.id === id);
    if (!row || !stage || row.stage === stage) return;
    start(async () => {
      move({ id, stage });
      const res = await setMatterStage(id, stage);
      if (!res.ok) toast.error(res.error);
      else toast.success(t("stageMoved", { stage: tl(stages.find((s) => s.key === stage)!.label, locale) }), { duration: 2000 });
    });
  }

  return (
    <DndContext id="matter-board" sensors={sensors} onDragEnd={onDragEnd}>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {stages.map((s) => {
          const col = items.filter((r) => r.stage === s.key);
          return (
            <Column key={s.key} id={s.key} title={tl(s.label, locale)} count={col.length}>
              {col.map((r) => (
                <BoardCard key={r.id} row={r} locale={locale} />
              ))}
            </Column>
          );
        })}
      </div>
      <p className="text-xs text-muted">{t("boardHint")}</p>
    </DndContext>
  );
}

function Column({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("flex w-64 shrink-0 flex-col rounded-card border border-border bg-surface-2/50 transition-colors", isOver && "border-primary/50 bg-primary-soft/50")}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-xs font-semibold text-foreground/80">{title}</span>
        <span className="rounded-full bg-surface px-1.5 text-[11px] font-medium text-muted ring-1 ring-border">{count}</span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </div>
  );
}

function BoardCard({ row, locale }: { row: MatterRow; locale: Locale }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab touch-manipulation rounded-lg border border-border bg-surface p-3 shadow-card active:cursor-grabbing", isDragging && "z-10 rotate-1 opacity-90 shadow-pop")}
    >
      <Link href={`/matters/${row.id}`} className="block text-sm font-medium leading-snug hover:text-primary" onClick={(e) => isDragging && e.preventDefault()}>
        {row.displayName.split(" — ")[0]}
      </Link>
      <div className="mt-0.5 truncate text-xs text-muted">{row.caption || row.number}</div>
      <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">
        {row.nextDate ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            {formatDate(row.nextDate, locale, { month: "short", day: "numeric", year: undefined })}
          </span>
        ) : null}
        {row.balance > 0 ? <span className="tabular-nums">{formatCents(row.balance, locale)}</span> : null}
        {row.assigneeName ? <Avatar name={row.assigneeName} className="ml-auto size-5 text-[9px]" /> : null}
      </div>
    </div>
  );
}
