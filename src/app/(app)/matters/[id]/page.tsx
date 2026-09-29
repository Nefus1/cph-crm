import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth";
import { isUuid } from "@/lib/utils";
import { getMatter } from "@/server/queries/matters";
import { getHolidaySet } from "@/server/queries/work";
import { MatterHeader } from "@/components/matters/matter-header";
import { MatterTabs } from "@/components/matters/matter-tabs";
import { OverviewTab } from "@/components/matters/overview-tab";
import { TimelineTab } from "@/components/matters/timeline-tab";
import { TasksTab } from "@/components/matters/tasks-tab";
import { DatesTab } from "@/components/matters/dates-tab";
import { BillingTab } from "@/components/matters/billing-tab";
import { FilesTab } from "@/components/matters/files-tab";

export async function generateMetadata(props: PageProps<"/matters/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) return { title: "Matter" };
  const data = await getMatter(id);
  return { title: data?.matter.displayName ?? "Matter" };
}

const TABS = ["overview", "timeline", "tasks", "dates", "billing", "files"] as const;
type Tab = (typeof TABS)[number];

export default async function MatterPage(props: PageProps<"/matters/[id]">) {
  const me = await requireStaff();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!isUuid(id)) notFound();
  const data = await getMatter(id);
  if (!data) notFound();
  const locale = (await getLocale()) as "en" | "es";
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const t = await getTranslations("matter");

  const openTasks = data.tasks.filter((x) => !x.task.completedAt).length;
  const upcoming = data.events.filter((e) => e.status === "scheduled").length;
  const holidays = tab === "dates" && data.matter.practiceArea === "ud" ? [...(await getHolidaySet())] : [];

  return (
    <div>
      <MatterHeader data={data} locale={locale} isAdmin={me.role === "admin"} />
      <MatterTabs
        id={id}
        active={tab}
        tabs={[
          { key: "overview", label: t("tabs.overview") },
          { key: "timeline", label: t("tabs.timeline"), count: data.activities.filter((a) => a.activity.type !== "system").length },
          { key: "tasks", label: t("tabs.tasks"), count: openTasks },
          { key: "dates", label: t("tabs.dates"), count: upcoming },
          { key: "billing", label: t("tabs.billing") },
          { key: "files", label: t("tabs.files") },
        ]}
      />
      <div className="mt-6">
        {tab === "overview" ? <OverviewTab data={data} locale={locale} /> : null}
        {tab === "timeline" ? <TimelineTab data={data} locale={locale} /> : null}
        {tab === "tasks" ? <TasksTab data={data} /> : null}
        {tab === "dates" ? <DatesTab data={data} holidays={holidays} /> : null}
        {tab === "billing" ? <BillingTab data={data} locale={locale} isAdmin={me.role === "admin"} meId={me.id} /> : null}
        {tab === "files" ? <FilesTab data={data} locale={locale} /> : null}
      </div>
    </div>
  );
}
