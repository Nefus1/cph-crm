import { getTranslations } from "next-intl/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { folderConnectors } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/server/queries/settings";
import { FolderSettings } from "@/components/folders/settings";
import { PageHeader } from "@/components/ui/misc";
export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const devices = await db
    .select({
      id: folderConnectors.id,
      name: folderConnectors.name,
      revokedAt: folderConnectors.revokedAt,
      lastSeenAt: folderConnectors.lastSeenAt,
      online: sql<boolean>`coalesce(${folderConnectors.lastSeenAt} > now() - interval '2 minutes', false)`,
    })
    .from(folderConnectors);
  const t = await getTranslations("folders");
  return (
    <>
      <PageHeader title={t("settings")} />
      <FolderSettings
        key={`${settings.folderSetupEnabled}:${settings.folderMappingVerifiedAt}`}
        root={settings.folderRoot}
        connectorId={settings.folderConnectorId}
        enabled={settings.folderSetupEnabled}
        verified={!!settings.folderMappingVerifiedAt}
        devices={devices}
      />
    </>
  );
}
