import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExternalLink, FileText, Folder, FolderOpen } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/practice-areas";
import { formatDateTime } from "@/lib/dates";
import { listFolderFiles, type DriveFile } from "@/lib/google/drive";
import { getAuthedClient } from "@/lib/google/client";
import type { MatterDetail } from "@/server/queries/matters";

export async function FilesTab({ data, locale }: { data: MatterDetail; locale: Locale }) {
  const t = await getTranslations("files");
  const { matter } = data;
  const connected = !!(await getAuthedClient().catch(() => null));

  if (!connected) {
    return (
      <Card>
        <EmptyState icon={<FolderOpen />} title={t("notConnected")} description={t("notConnectedHint")} action={<Button asChild><Link href="/settings/google">{t("connect")}</Link></Button>} />
      </Card>
    );
  }
  if (!matter.driveFolderId) {
    return (
      <Card>
        <EmptyState icon={<FolderOpen />} title={t("noFolder")} description={t("noFolderHint")} />
      </Card>
    );
  }

  let files: DriveFile[] = [];
  let error: string | null = null;
  try {
    files = await listFolderFiles(matter.driveFolderId);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <Card>
      <CardHeader
        icon={<FolderOpen />}
        title={matter.displayName}
        description={t("hint")}
        action={
          <Button asChild variant="secondary" size="sm">
            <a href={matter.driveFolderUrl ?? "#"} target="_blank" rel="noreferrer">
              <ExternalLink /> {t("openInDrive")}
            </a>
          </Button>
        }
      />
      {error ? (
        <p className="px-4 py-6 text-sm text-danger">{error}</p>
      ) : files.length ? (
        <ul className="divide-y divide-border">
          {files.map((f) => (
            <li key={f.id}>
              <a href={f.webViewLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                {f.isFolder ? <Folder className="size-4 text-area-ud" /> : <FileText className="size-4 text-muted" />}
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                {f.modifiedTime ? <span className="text-xs text-muted">{formatDateTime(f.modifiedTime, locale)}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("empty")} />
      )}
    </Card>
  );
}
