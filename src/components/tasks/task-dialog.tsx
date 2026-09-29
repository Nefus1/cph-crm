"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { useAppData } from "@/components/app/app-data";
import { MatterSelect, StaffSelect } from "@/components/app/matter-select";
import { useAction } from "@/components/app/use-action";
import { createTask, updateTask } from "@/server/actions/work";

export interface TaskDraft {
  id?: string;
  matterId?: string | null;
  title?: string;
  notes?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  urgent?: boolean;
}

export function TaskDialog({ open, onOpenChange, initial, lockMatter }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: TaskDraft; lockMatter?: boolean }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const { me } = useAppData();
  const { pending, run } = useAction();
  const [form, setForm] = useState(() => ({
    matterId: initial?.matterId ?? "",
    title: initial?.title ?? "",
    notes: initial?.notes ?? "",
    assigneeId: initial?.assigneeId ?? (initial?.id ? "" : me.id),
    dueDate: initial?.dueDate ?? "",
    urgent: initial?.urgent ?? false,
  }));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, matterId: form.matterId || null, assigneeId: form.assigneeId || null, dueDate: form.dueDate || "" };
    run(() => (initial?.id ? updateTask(initial.id, payload) : createTask(payload)), {
      success: initial?.id ? t("saved") : t("created"),
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial?.id ? t("edit") : t("new")}>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("title")} htmlFor="task-title">
            <Input id="task-title" autoFocus required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("titlePlaceholder")} />
          </Field>
          {!lockMatter ? (
            <Field label={tc("matter")} htmlFor="task-matter">
              <MatterSelect id="task-matter" value={form.matterId ?? ""} onChange={(v) => set("matterId", v)} />
            </Field>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("assignee")} htmlFor="task-assignee">
              <StaffSelect id="task-assignee" value={form.assigneeId ?? ""} onChange={(v) => set("assigneeId", v)} />
            </Field>
            <Field label={t("due")} htmlFor="task-due">
              <Input id="task-due" type="date" value={form.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value)} />
            </Field>
          </div>
          <Field label={tc("notes")} htmlFor="task-notes">
            <Textarea id="task-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.urgent} onChange={(e) => set("urgent", e.target.checked)} />
            {t("urgent")}
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={pending || !form.title.trim()}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
