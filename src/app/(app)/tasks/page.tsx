import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckSquare } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { QuickButton } from "@/components/app/quick-button";
import { TaskItem } from "@/components/tasks/task-item";
import { TasksFilter } from "@/components/tasks/tasks-filter";
import { requireStaff } from "@/lib/auth";
import { addDaysISO, todayISO } from "@/lib/dates";
import { listTasks } from "@/server/queries/work";

export const metadata = { title: "Tasks" };

export default async function TasksPage(props: PageProps<"/tasks">) {
  const me = await requireStaff();
  const sp = await props.searchParams;
  const t = await getTranslations("tasks");
  const who = typeof sp.who === "string" ? sp.who : "me";
  const scope = sp.scope === "done" ? "done" : "open";
  const assignee = who === "me" ? me.id : who === "all" ? null : who;
  const rows = await listTasks({ assignee, scope });
  const today = todayISO();
  const week = addDaysISO(today, 7);

  const groups =
    scope === "done"
      ? [{ key: "done", items: rows }]
      : [
          { key: "overdue", items: rows.filter((r) => r.task.dueDate && r.task.dueDate < today) },
          { key: "today", items: rows.filter((r) => r.task.dueDate === today) },
          { key: "week", items: rows.filter((r) => r.task.dueDate && r.task.dueDate > today && r.task.dueDate <= week) },
          { key: "later", items: rows.filter((r) => r.task.dueDate && r.task.dueDate > week) },
          { key: "nodate", items: rows.filter((r) => !r.task.dueDate) },
        ].filter((g) => g.items.length);

  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} actions={<QuickButton kind="task" label={t("new")} variant="primary" size="md" />} />
      <TasksFilter who={who} scope={scope} />
      {groups.length ? (
        <div className="space-y-6">
          {groups.map((g) => (
            <Card key={g.key} className="overflow-hidden">
              <div className={`flex items-center justify-between border-b border-border px-4 py-2 text-xs font-semibold ${g.key === "overdue" ? "bg-danger-soft text-danger" : "bg-surface-2/50 text-muted"}`}>
                <span>{g.key === "done" ? t("done") : t(`groups.${g.key as "overdue"}`)}</span>
                <span>{g.items.length}</span>
              </div>
              <div className="divide-y divide-border">
                {g.items.map((r) => (
                  <TaskItem key={r.task.id} task={{ ...r.task, matterName: r.matterName, matterArea: r.matterArea, assigneeName: r.assigneeName }} showAssignee={who !== "me"} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<CheckSquare />} title={t("empty")} description={t("emptyHint")} action={scope === "open" && who === "me" ? <Link className="text-sm text-primary hover:underline" href="/tasks?who=all">{t("seeEveryone")}</Link> : undefined} />
        </Card>
      )}
    </>
  );
}
