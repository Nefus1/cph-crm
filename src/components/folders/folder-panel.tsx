"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { useAction } from "@/components/app/use-action";
import { requestCaseFolder, retryCaseFolder, previewExistingFolder, linkExistingFolder, verifyFolderMapping } from "@/server/actions/folders";
import type { matterFolders } from "@/db/schema";

type Binding = typeof matterFolders.$inferSelect & { jobError?: string | null };
export function FolderPanel({ matterId, bindings, enabled, admin }: { matterId: string; bindings: Binding[]; enabled: boolean; admin: boolean }) {
  const t = useTranslations("folders");
  const { pending, run } = useAction();
  const router = useRouter();
  const [folderId, setFolderId] = useState("");
  const [preview, setPreview] = useState<{ folderId: string; relativePath: string; url: string } | null>(null);
  const [localConfirmed, setLocalConfirmed] = useState(false);
  const waiting = bindings.some(
    (b) =>
      b.origin === "managed" && (b.localStatus === "waiting" || b.localStatus === "creating" || (b.localStatus === "ready" && b.discoveryStatus === "waiting")),
  );
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [waiting, router]);
  return (
    <section className="mb-5 space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-semibold">{t("title")}</h2>
      <p className="text-sm text-muted">{t("syncHint")}</p>
      {!enabled && <p className="text-sm text-muted">{t("disabled")}</p>}
      {!bindings.length && (
        <Button disabled={pending || !enabled} onClick={() => run(() => requestCaseFolder(matterId))}>
          {t("create")}
        </Button>
      )}
      {bindings.map((b) => (
        <div key={b.id} className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
          <p className="break-words font-medium">{b.relativePath || t("legacy")}</p>
          <p role="status">
            {t(`local.${b.localStatus as "waiting"}`)} · {t(`discovery.${b.discoveryStatus as "waiting"}`)}
          </p>
          {b.jobError && (
            <p className="text-danger">{t.has(`errors.${b.jobError}` as never) ? t(`errors.${b.jobError}` as never) : t("errors.connector_error")}</p>
          )}
          {b.discoveryError && <p className="text-danger">{t(`errors.${b.discoveryError as "drive_error"}`)}</p>}
          <div className="flex flex-wrap gap-2">
            {b.localRoot && b.relativePath && (
              <Button
                size="sm"
                onClick={() =>
                  navigator.clipboard
                    .writeText(`${b.localRoot}\\${b.relativePath!.replaceAll("/", "\\")}`)
                    .then(() => toast.success(t("copied")))
                    .catch(() => toast.error(t("copyFailed")))
                }
              >
                {t("copyPath")}
              </Button>
            )}
            {b.driveFolderUrl && (
              <Button asChild size="sm">
                <a href={b.driveFolderUrl} target="_blank" rel="noreferrer">
                  {t("openDrive")}
                </a>
              </Button>
            )}
            {b.origin === "managed" && b.discoveryStatus !== "linked" && (
              <Button size="sm" disabled={pending || b.localStatus === "creating"} onClick={() => run(() => retryCaseFolder(b.id))}>
                {t("retry")}
              </Button>
            )}
            {admin && b.isVerification && b.discoveryStatus === "linked" && (
              <Button size="sm" disabled={pending} onClick={() => run(() => verifyFolderMapping(b.id), { success: t("verified") })}>
                {t("verify")}
              </Button>
            )}
          </div>
        </div>
      ))}
      {admin && (
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-medium">{t("linkExisting")}</summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">{t("linkHint")}</p>
            <Field label={t("folderId")} htmlFor={`folder-${matterId}`}>
              <Input
                id={`folder-${matterId}`}
                value={folderId}
                onChange={(e) => {
                  setFolderId(e.target.value);
                  setPreview(null);
                  setLocalConfirmed(false);
                }}
              />
            </Field>
            <Button
              disabled={pending || !folderId.trim()}
              onClick={() => run(() => previewExistingFolder(folderId.trim()), { onSuccess: (d) => d && setPreview(d) })}
            >
              {t("preview")}
            </Button>
            {preview && (
              <div className="space-y-2 rounded border border-border p-3">
                <a className="break-all underline" href={preview.url} target="_blank" rel="noreferrer">
                  {preview.relativePath}
                </a>
                <label className="flex gap-2 text-sm">
                  <Checkbox checked={localConfirmed} onChange={(e) => setLocalConfirmed(e.target.checked)} />
                  {t("localConfirm")}
                </label>
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(() => linkExistingFolder(matterId, preview.folderId, preview.relativePath, localConfirmed), {
                      onSuccess: () => {
                        setPreview(null);
                        setFolderId("");
                      },
                    })
                  }
                >
                  {t("confirmLink")}
                </Button>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
