"use client";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { useAppData } from "@/components/app/app-data";
import { addChecklistItem, deleteChecklistItem, toggleChecklistItem } from "@/server/actions/matters";
import type { ChecklistItem } from "@/db/schema";
import { cn } from "@/lib/utils";

export function Checklist({ matterId, items }: { matterId: string; items: ChecklistItem[] }) {
  const t = useTranslations("matter");
  const { locale } = useAppData();
  const [, start] = useTransition();
  const [list, update] = useOptimistic(items, (state, { id, done }: { id: string; done: boolean }) => state.map((i) => (i.id === id ? { ...i, doneAt: done ? new Date() : null } : i)));
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const done = list.filter((i) => i.doneAt).length;

  return (
    <div>
      <div className="px-4 pt-3">
        <Progress value={list.length ? (done / list.length) * 100 : 0} />
      </div>
      <ul className="py-1.5">
        {list.map((i) => (
          <li key={i.id} className="group flex items-center gap-3 px-4 py-1.5">
            <Checkbox
              id={`cl-${i.id}`}
              checked={!!i.doneAt}
              onChange={(e) => {
                const v = e.target.checked;
                start(async () => {
                  update({ id: i.id, done: v });
                  const r = await toggleChecklistItem(i.id, v);
                  if (!r.ok) toast.error(r.error);
                });
              }}
            />
            <label htmlFor={`cl-${i.id}`} className={cn("flex-1 cursor-pointer text-sm", i.doneAt && "text-muted line-through")}>
              {locale === "es" && i.labelEs ? i.labelEs : i.label}
            </label>
            <button
              className="rounded p-0.5 text-subtle opacity-0 hover:text-danger group-hover:opacity-100"
              aria-label={t("removeItem")}
              onClick={() =>
                start(async () => {
                  const r = await deleteChecklistItem(i.id);
                  if (!r.ok) toast.error(r.error);
                })
              }
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-4 py-2.5">
        {adding ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!label.trim()) return;
              start(async () => {
                const r = await addChecklistItem(matterId, label);
                if (!r.ok) toast.error(r.error);
                setLabel("");
              });
            }}
          >
            <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("newItem")} className="h-8" />
            <Button type="submit" size="sm" variant="primary">
              {t("add")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              <X />
            </Button>
          </form>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="-ml-2">
            <Plus /> {t("addItem")}
          </Button>
        )}
      </div>
    </div>
  );
}
