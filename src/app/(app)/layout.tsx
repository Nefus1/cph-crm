import { requireStaff } from "@/lib/auth";
import { getLocale } from "next-intl/server";
import { AppDataProvider } from "@/components/app/app-data";
import { QuickActionsProvider } from "@/components/app/quick-actions";
import { AppShell } from "@/components/app/shell";
import { listActiveStaff } from "@/server/queries/staff";
import { matterOptions } from "@/server/queries/matters";
import { getSettings } from "@/server/queries/settings";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await requireStaff();
  const [staffList, matters, settings, locale] = await Promise.all([listActiveStaff(), matterOptions(), getSettings(), getLocale()]);
  return (
    <AppDataProvider
      value={{
        me: { id: me.id, name: me.name, email: me.email, role: me.role },
        staff: staffList,
        matters,
        locale: locale === "es" ? "es" : "en",
        googleCalendar: !!(settings.googleRefreshTokenEnc && settings.calendarId),
        googleDrive: !!(settings.googleRefreshTokenEnc && settings.casesFolderId),
      }}
    >
      <QuickActionsProvider>
        <AppShell firmName={settings.firmName || "CPH"}>{children}</AppShell>
      </QuickActionsProvider>
    </AppDataProvider>
  );
}
