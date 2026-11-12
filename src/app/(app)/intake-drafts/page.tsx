import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listIntakeDrafts } from "@/server/actions/drafts";
import { DraftList } from "@/components/intake/draft-list";
import { PageHeader } from "@/components/ui/misc";
export default async function DraftsPage() {
  const t = await getTranslations("drafts");
  const drafts = await listIntakeDrafts();
  return (
    <>
      <PageHeader title={t("title")} description={t("hint")} />
      <Link className="mb-4 inline-block underline" href="/matters/new">
        {t("new")}
      </Link>
      <DraftList drafts={drafts} />
    </>
  );
}
