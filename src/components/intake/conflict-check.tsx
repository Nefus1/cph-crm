"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { runConflictCheck } from "@/server/actions/search";
import type { ConflictHit } from "@/server/queries/search";
import { ConflictResults } from "./conflict-panel";

export function ConflictCheck() {
  const t = useTranslations("conflicts");
  const [names, setNames] = useState<string[]>([""]);
  const [hits, setHits] = useState<ConflictHit[] | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function check(e?: React.FormEvent) {
    e?.preventDefault();
    const list = names.map((n) => n.trim()).filter(Boolean);
    if (!list.length) return;
    start(async () => {
      setHits(await runConflictCheck(list));
      setChecked(list);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <form onSubmit={check} className="space-y-3">
            <p className="text-sm text-muted">{t("instructions")}</p>
            {names.map((n, i) => (
              <div key={i} className="flex gap-2">
                <Input autoFocus={i === 0} value={n} onChange={(e) => setNames((l) => l.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? t("placeholderClient") : t("placeholderOther")} />
                {names.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setNames((l) => l.filter((_, j) => j !== i))} aria-label="Remove">
                    <X />
                  </Button>
                ) : null}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setNames((l) => [...l, ""])}>
                <Plus /> {t("addName")}
              </Button>
              <Button type="submit" variant="primary" disabled={pending || !names.some((n) => n.trim())}>
                {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {t("run")}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      {hits ? (
        hits.length ? (
          <div>
            <h2 className="mb-3 text-sm font-semibold">{t("found", { count: hits.length })}</h2>
            <ConflictResults hits={hits} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm">
            <CheckCircle2 className="size-5 text-success" />
            <span>{t("clearFor", { names: checked.join(", ") })}</span>
          </div>
        )
      ) : null}
      <p className="text-xs text-muted">{t("footnote")}</p>
    </div>
  );
}
