import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CalendarImport, DriveImport, SheetImport } from "@/components/settings/importers";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/server/queries/settings";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  await requireAdmin();
  const t = await getTranslations("import");
  const s = await getSettings();
  const connected = !!s.googleRefreshTokenEnc;
  return (
    <div className="space-y-6">
      {!connected ? <div className="rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm">{t("connectFirst")}</div> : null}
      <Card>
        <CardHeader title={t("sheet.title")} description={t("sheet.hint")} />
        <CardBody>
          <SheetImport disabled={!connected} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("drive.title")} description={t("drive.hint", { folder: s.casesFolderName ?? "Cases" })} />
        <CardBody>
          <DriveImport disabled={!connected || !s.casesFolderId} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("calendar.title")} description={t("calendar.hint", { calendar: s.calendarName ?? "Hearings and Deadlines" })} />
        <CardBody>
          <CalendarImport disabled={!connected || !s.calendarId} />
        </CardBody>
      </Card>
    </div>
  );
}
