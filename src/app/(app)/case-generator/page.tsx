import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/server/queries/settings";
import { Generator } from "@/components/folders/generator";
import { PageHeader } from "@/components/ui/misc";
export default async function GeneratorPage() {
  const me = await requireStaff();
  const settings = await getSettings();
  const t = await getTranslations("folders");
  return (
    <>
      <PageHeader title={t("generator")} />
      <Generator enabled={settings.folderSetupEnabled} admin={me.role === "admin"} />
    </>
  );
}
