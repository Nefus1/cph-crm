import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { ConflictCheck } from "@/components/intake/conflict-check";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Conflict check" };

export default async function ConflictsPage() {
  await requireStaff();
  const t = await getTranslations("conflicts");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("description")} />
      <ConflictCheck />
    </div>
  );
}
