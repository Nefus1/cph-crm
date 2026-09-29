import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireStaff } from "@/lib/auth";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const me = await requireStaff();
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
        <SettingsNav isAdmin={me.role === "admin"} />
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
