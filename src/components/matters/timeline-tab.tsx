import type { Locale } from "@/config/practice-areas";
import { TimelineComposer, TimelineList } from "@/components/app/timeline";
import type { MatterDetail } from "@/server/queries/matters";

export function TimelineTab({ data }: { data: MatterDetail; locale: Locale }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <TimelineComposer matterId={data.matter.id} />
      <TimelineList entries={data.activities.map((a) => ({ ...a.activity, authorName: a.authorName }))} />
    </div>
  );
}
