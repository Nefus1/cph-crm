import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FirmSettingsForm, ProfileForm } from "@/components/settings/general-forms";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/server/queries/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireStaff();
  const t = await getTranslations("settings");
  const locale = await getLocale();
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t("profile")} description={t("profileHint")} />
        <CardBody>
          <ProfileForm name={me.name} email={me.email} locale={locale === "es" ? "es" : "en"} />
        </CardBody>
      </Card>
      {me.role === "admin" ? (
        <Card>
          <CardHeader title={t("firm")} description={t("firmHint")} />
          <CardBody>
            <FirmSettingsForm firmName={settings.firmName} supervising={settings.defaultSupervisingAttorney} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
