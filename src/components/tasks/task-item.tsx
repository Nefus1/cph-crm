"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { DueLabel } from "@/components/app/due-label";
import { AreaDot } from "@/components/app/area-badge";
import { useQuickActions } from "@/components/app/quick-actions";
import { deleteTask, toggleTask } from "@/server/actions/work";
import { cn } from "@/lib/utils";

export interface TaskItemData {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  urgent: boolean;
  completedAt: Date | string | null;
  assigneeId: string | null;
  matterId: string | null;
  matterName?: string | null;
  matterArea?: string | null;
  assigneeName?: string | null;
}

export function TaskItem({ task, showMatter = true, showAssignee = false }: { task: TaskItemData; showMatter?: boolean; showAssignee?: boolean }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const quick = useQuickActions();
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(!!task.completedAt);

  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60">
      <Checkbox
        className="mt-0.5"
        checked={done}
        aria-label={t("markDone")}
        onChange={(e) => {
          const v = e.target.checked;
          start(async () => {
            setDone(v);
            const res = await toggleTask(task.id, v);
            if (!res.ok) toast.error(res.error);
            else if (v) toast.success(t("completedToast"), { duration: 2000 });
          });
        }}
      />
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-center gap-1.5 text-sm", done && "text-muted line-through")}>
          {task.urgent && !done ? <AlertCircle className="size-3.5 shrink-0 text-danger" aria-label={t("urgent")} /> : null}
          <span className="break-words">{task.title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
          <DueLabel date={task.dueDate} done={done} />
          {showMatter && task.matterId && task.matterName ? (
            <Link href={`/matters/${task.matterId}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground">
              <AreaDot area={task.matterArea ?? "general"} />
              <span className="truncate">{task.matterName}</span>
            </Link>
          ) : null}
          {showAssignee ? <span>{task.assigneeName || tc("unassigned")}</span> : null}
          {task.notes ? <span className="truncate">{task.notes}</span> : null}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-md p-1 text-subtle opacity-60 hover:bg-surface-2 hover:text-foreground group-hover:opacity-100" aria-label={tc("more")}>
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => quick.open({ kind: "task", initial: { ...task, notes: task.notes } })}>
            <Pencil /> {tc("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-danger"
            onSelect={() =>
              start(async () => {
                const res = await deleteTask(task.id);
                if (!res.ok) toast.error(res.error);
              })
            }
          >
            <Trash2 /> {tc("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
