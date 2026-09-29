import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPicker, DisconnectButton, FolderPicker } from "@/components/settings/google-settings";
import { requireAdmin } from "@/lib/auth";
import { googleConfigured } from "@/lib/google/client";
import { appUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/dates";
import { getSettings } from "@/server/queries/settings";

export const metadata = { title: "Google" };

export default async function GoogleSettingsPage(props: PageProps<"/settings/google">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const t = await getTranslations("google");
  const locale = await getLocale();
  const s = await getSettings();
  const configured = googleConfigured();
  const connected = !!s.googleRefreshTokenEnc;
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="space-y-6">
      {sp.connected ? (
        <div className="flex items-center gap-2 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-success" /> {t("connectedToast")}
        </div>
      ) : null}
      {error ? (
        <div className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{t.has(`errors.${error}` as never) ? t(`errors.${error}` as never) : error}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader title={t("account")} description={t("accountHint")} />
        <CardBody className="space-y-4">
          {!configured ? (
            <div className="rounded-lg bg-warning-soft p-4 text-sm">
              <p className="font-medium">{t("notConfigured")}</p>
              <p className="mt-1 text-muted">{t("notConfiguredHint")}</p>
              <p className="mt-2 font-mono text-xs">{appUrl()}/api/google/callback</p>
            </div>
          ) : connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-success" />
                <span>
                  {t("connectedAs")} <span className="font-medium">{s.googleEmail}</span>
                  {s.googleConnectedAt ? <span className="text-muted"> · {formatDateTime(s.googleConnectedAt, locale)}</span> : null}
                </span>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="secondary" size="sm">
                  <a href="/api/google/connect">{t("reconnect")}</a>
                </Button>
                <DisconnectButton />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">{t("connectHint")}</p>
              <Button asChild variant="primary">
                <a href="/api/google/connect">{t("connect")}</a>
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className={connected ? "" : "pointer-events-none opacity-50"}>
        <CardHeader title={t("drive")} description={t("driveHint")} />
        <CardBody>
          <FolderPicker currentId={s.casesFolderId} currentName={s.casesFolderName} />
        </CardBody>
      </Card>

      <Card className={connected ? "" : "pointer-events-none opacity-50"}>
        <CardHeader title={t("calendar")} description={t("calendarHint")} />
        <CardBody>
          <CalendarPicker currentId={s.calendarId} currentName={s.calendarName} />
        </CardBody>
      </Card>
    </div>
  );
}
