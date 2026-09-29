"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MatterSelect } from "@/components/app/matter-select";
import { useAction } from "@/components/app/use-action";
import { createEvent, updateEvent } from "@/server/actions/work";
import { todayISO } from "@/lib/dates";

export interface EventDraft {
  id?: string;
  matterId?: string | null;
  kind?: "hearing" | "deadline" | "appointment";
  title?: string;
  date?: string;
  time?: string | null;
  durationMinutes?: number;
  location?: string;
  notes?: string;
  ladder?: "service" | "filing" | "none";
  status?: "scheduled" | "done" | "continued" | "vacated";
  computedFrom?: string | null;
}

export function EventDialog({ open, onOpenChange, initial, lockMatter }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: EventDraft; lockMatter?: boolean }) {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  const [form, setForm] = useState(() => ({
    matterId: initial?.matterId ?? "",
    kind: initial?.kind ?? "hearing",
    title: initial?.title ?? "",
    date: initial?.date ?? todayISO(),
    time: initial?.time ?? "",
    durationMinutes: initial?.durationMinutes ?? 60,
    location: initial?.location ?? "",
    notes: initial?.notes ?? "",
    ladder: initial?.ladder ?? (initial?.kind === "appointment" ? "none" : "filing"),
    status: initial?.status ?? "scheduled",
  }));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, matterId: form.matterId || null, time: form.time || null, computedFrom: initial?.computedFrom ?? null };
    run(() => (initial?.id ? updateEvent(initial.id, payload) : createEvent(payload)), {
      success: initial?.id ? t("saved") : t("created"),
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial?.id ? t("edit") : t("new")} description={t("dialogHint")}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
            {(["hearing", "deadline", "appointment"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm((f) => ({ ...f, kind: k, ladder: k === "appointment" ? "none" : f.ladder === "none" ? "filing" : f.ladder }))}
                className={`rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${form.kind === k ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground"}`}
              >
                {t(`kind.${k}`)}
              </button>
            ))}
          </div>
          <Field label={t("title")} htmlFor="ev-title">
            <Input id="ev-title" autoFocus required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t(`titlePlaceholder.${form.kind}`)} />
          </Field>
          {!lockMatter ? (
            <Field label={tc("matter")} htmlFor="ev-matter">
              <MatterSelect id="ev-matter" value={form.matterId ?? ""} onChange={(v) => set("matterId", v)} />
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={t("date")} htmlFor="ev-date">
              <Input id="ev-date" type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label={t("time")} htmlFor="ev-time" hint={t("timeHint")}>
              <Input id="ev-time" type="time" value={form.time ?? ""} onChange={(e) => set("time", e.target.value)} />
            </Field>
            <Field label={t("reminders")} htmlFor="ev-ladder" className="col-span-2 sm:col-span-1">
              <Select id="ev-ladder" value={form.ladder} onChange={(e) => set("ladder", e.target.value as typeof form.ladder)}>
                <option value="filing">{t("ladder.filing")}</option>
                <option value="service">{t("ladder.service")}</option>
                <option value="none">{t("ladder.none")}</option>
              </Select>
            </Field>
          </div>
          <Field label={form.kind === "hearing" ? t("deptLocation") : t("location")} htmlFor="ev-loc">
            <Input id="ev-loc" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder={form.kind === "hearing" ? "Dept. 94 — Stanley Mosk" : ""} />
          </Field>
          <Field label={tc("notes")} htmlFor="ev-notes">
            <Textarea id="ev-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          {initial?.id ? (
            <Field label={t("statusLabel")} htmlFor="ev-status">
              <Select id="ev-status" value={form.status} onChange={(e) => set("status", e.target.value as typeof form.status)}>
                {(["scheduled", "done", "continued", "vacated"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
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
