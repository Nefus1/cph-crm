"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/app/use-action";
import { useAppData } from "@/components/app/app-data";
import { discardIntakeDraft, type listIntakeDrafts } from "@/server/actions/drafts";
export function DraftList({ drafts }: { drafts: Awaited<ReturnType<typeof listIntakeDrafts>> }) {
  const t = useTranslations("drafts");
  const { locale } = useAppData();
  const { pending, run } = useAction();
  return (
    <div className="space-y-3">
      {!drafts.length && <p>{t("empty")}</p>}
      {drafts.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
          <div>
            <Link className="font-medium underline" href={`/matters/new?draft=${d.id}`}>
              {d.payload.picked?.title || [d.payload.client.firstName, d.payload.client.lastName].filter(Boolean).join(" ") || t("untitled")}
            </Link>
            <p className="text-sm text-muted">
              {d.assignee || t("unassigned")} · {new Date(d.updatedAt).toLocaleString(locale, { timeZone: "America/Los_Angeles" })}
            </p>
          </div>
          <Button disabled={pending} onClick={() => confirm(t("discardConfirm")) && run(() => discardIntakeDraft(d.id, d.version))}>
            {t("discard")}
          </Button>
        </div>
      ))}
    </div>
  );
}
