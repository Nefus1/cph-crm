"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { MatterSelect } from "@/components/app/matter-select";
import { useAction } from "@/components/app/use-action";
import { requestCaseFolder } from "@/server/actions/folders";
export function Generator({ enabled, admin }: { enabled: boolean; admin: boolean }) {
  const t = useTranslations("folders");
  const [matterId, setMatterId] = useState("");
  const { pending, run } = useAction();
  const router = useRouter();
  function create(verification: boolean) {
    run(() => requestCaseFolder(matterId, verification), { onSuccess: () => router.push(`/matters/${matterId}?tab=files`) });
  }
  return (
    <div className="max-w-2xl space-y-5 rounded-lg border border-border bg-surface p-5">
      <p>{t("generatorHint")}</p>
      <Field label={t("matter")} htmlFor="generator-matter">
        <MatterSelect id="generator-matter" value={matterId} onChange={setMatterId} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={pending || !matterId || !enabled} onClick={() => create(false)}>
          {t("create")}
        </Button>
        <Button asChild>
          <Link href="/matters/new">{t("newIntake")}</Link>
        </Button>
        <Button asChild>
          <Link href="/intake-drafts">{t("drafts")}</Link>
        </Button>
      </div>
      {!enabled && <p className="text-sm text-muted">{t("disabled")}</p>}
      {matterId && (
        <Link className="block text-sm underline" href={`/matters/${matterId}?tab=files`}>
          {t("viewFolders")}
        </Link>
      )}
      {admin && (
        <details className="border-t border-border pt-4">
          <summary>{t("testSetup")}</summary>
          <p className="my-3 text-sm text-muted">{t("testHint")}</p>
          <Button disabled={pending || !matterId} onClick={() => confirm(t("testConfirm")) && create(true)}>
            {t("testCreate")}
          </Button>
          <Link className="ml-3 text-sm underline" href="/settings/folders">
            {t("settings")}
          </Link>
        </details>
      )}
    </div>
  );
}
