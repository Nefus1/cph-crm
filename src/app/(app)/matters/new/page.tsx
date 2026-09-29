import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { IntakeWizard } from "@/components/intake/intake-wizard";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/server/queries/settings";
import { isUuid } from "@/lib/utils";
import { getContact } from "@/server/queries/contacts";

export const metadata = { title: "New intake" };

export default async function NewIntakePage(props: PageProps<"/matters/new">) {
  await requireStaff();
  const sp = await props.searchParams;
  const t = await getTranslations("intake");
  const settings = await getSettings();
  const contactId = typeof sp.contact === "string" && isUuid(sp.contact) ? sp.contact : null;
  const existing = contactId ? await getContact(contactId) : null;
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <IntakeWizard
        driveReady={!!(settings.googleRefreshTokenEnc && settings.casesFolderId)}
        defaultSupervising={settings.defaultSupervisingAttorney}
        initialClient={existing ? { id: existing.contact.id, title: existing.contact.displayName, subtitle: [existing.contact.phone, existing.contact.email].filter(Boolean).join(" · ") } : null}
      />
    </>
  );
}
