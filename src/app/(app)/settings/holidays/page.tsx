import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardHeader } from "@/components/ui/card";
import { HolidayManager } from "@/components/settings/holiday-manager";
import { requireStaff } from "@/lib/auth";
import { listHolidays } from "@/server/queries/work";

export const metadata = { title: "Court holidays" };

export default async function HolidaysPage() {
  const me = await requireStaff();
  const t = await getTranslations("settings");
  const locale = await getLocale();
  const rows = await listHolidays();
  return (
    <Card>
      <CardHeader title={t("holidays")} description={t("holidaysHint")} />
      <HolidayManager rows={rows} isAdmin={me.role === "admin"} locale={locale} />
    </Card>
  );
}
