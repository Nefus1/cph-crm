"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MatterSelect } from "@/components/app/matter-select";
import { useAction } from "@/components/app/use-action";
import { addActivity } from "@/server/actions/work";
import { ACTIVITY_TYPES, ActivityIcon } from "./activity-icon";

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ActivityDialog({
  open,
  onOpenChange,
  matterId,
  contactId,
  defaultType = "call",
  lockMatter,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matterId?: string | null;
  contactId?: string | null;
  defaultType?: (typeof ACTIVITY_TYPES)[number];
  lockMatter?: boolean;
}) {
  const t = useTranslations("timeline");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]>(defaultType);
  const [body, setBody] = useState("");
  const [when, setWhen] = useState(nowLocalInput);
  const [matter, setMatter] = useState(matterId ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        addActivity({
          type,
          body,
          matterId: matter || null,
          contactId: contactId ?? null,
          occurredAt: new Date(when).toISOString(),
        }),
      {
        success: t("logged"),
        onSuccess: () => {
          setBody("");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("logTitle")}>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_TYPES.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${type === k ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border text-muted hover:text-foreground"}`}
              >
                <ActivityIcon type={k} className="size-3.5" />
                {t(`type.${k}`)}
              </button>
            ))}
          </div>
          {!lockMatter && !contactId ? (
            <Field label={tc("matter")} htmlFor="act-matter">
              <MatterSelect id="act-matter" value={matter} onChange={setMatter} allowNone={false} />
            </Field>
          ) : null}
          <Field label={t("what")} htmlFor="act-body">
            <Textarea id="act-body" autoFocus required rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t(`placeholder.${type}`)} />
          </Field>
          <Field label={t("when")} htmlFor="act-when">
            <Input id="act-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={pending || !body.trim() || (!matter && !contactId)}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
