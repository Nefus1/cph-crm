import { getTranslations } from "next-intl/server";
import { CalendarDays, History } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { QuickButton } from "@/components/app/quick-button";
import { EventItem } from "@/components/events/event-item";
import { todayISO } from "@/lib/dates";
import type { MatterDetail } from "@/server/queries/matters";
import { UdCalculator } from "./ud-calculator";

export async function DatesTab({ data, holidays }: { data: MatterDetail; holidays: string[] }) {
  const t = await getTranslations("matter");
  const today = todayISO();
  const upcoming = data.events.filter((e) => e.date >= today || e.status === "scheduled");
  const past = data.events.filter((e) => e.date < today && e.status !== "scheduled").reverse();
  const isUd = data.matter.practiceArea === "ud";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className={isUd ? "space-y-6 lg:col-span-3" : "space-y-6 lg:col-span-5 lg:mx-auto lg:w-full lg:max-w-3xl"}>
        <Card>
          <CardHeader icon={<CalendarDays />} title={t("hearingsDeadlines")} description={t("hearingsHint")} action={<QuickButton kind="event" matterId={data.matter.id} label={t("addDate")} variant="primary" />} />
          {upcoming.length ? (
            <div className="divide-y divide-border">
              {upcoming.map((e) => (
                <EventItem key={e.id} event={e} showMatter={false} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarDays />} title={t("noDates")} description={t("noDatesHint")} />
          )}
        </Card>
        {past.length ? (
          <Card>
            <CardHeader icon={<History />} title={t("pastDates")} />
            <div className="divide-y divide-border">
              {past.map((e) => (
                <EventItem key={e.id} event={e} showMatter={false} />
              ))}
            </div>
          </Card>
        ) : null}
      </div>
      {isUd ? (
        <div className="lg:col-span-2">
          <UdCalculator matterId={data.matter.id} details={data.matter.details ?? {}} holidays={holidays} />
        </div>
      ) : null}
    </div>
  );
}
