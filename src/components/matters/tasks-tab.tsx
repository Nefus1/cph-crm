import { getTranslations } from "next-intl/server";
import { CheckSquare } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { QuickButton } from "@/components/app/quick-button";
import { TaskItem } from "@/components/tasks/task-item";
import type { MatterDetail } from "@/server/queries/matters";

export async function TasksTab({ data }: { data: MatterDetail }) {
  const t = await getTranslations("matter");
  const open = data.tasks.filter((x) => !x.task.completedAt);
  const done = data.tasks.filter((x) => x.task.completedAt);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader icon={<CheckSquare />} title={t("openTasks")} action={<QuickButton kind="task" matterId={data.matter.id} label={t("addTask")} variant="primary" />} />
        {open.length ? (
          <div className="divide-y divide-border">
            {open.map((x) => (
              <TaskItem key={x.task.id} task={{ ...x.task, assigneeName: x.assigneeName }} showMatter={false} showAssignee />
            ))}
          </div>
        ) : (
          <EmptyState icon={<CheckSquare />} title={t("noTasks")} />
        )}
      </Card>
      {done.length ? (
        <Card>
          <CardHeader title={t("completedTasks", { count: done.length })} />
          <div className="divide-y divide-border">
            {done.map((x) => (
              <TaskItem key={x.task.id} task={{ ...x.task, assigneeName: x.assigneeName }} showMatter={false} showAssignee />
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
