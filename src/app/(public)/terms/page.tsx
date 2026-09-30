import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Terms of Use", robots: { index: true, follow: true } };

export default async function TermsPage() {
  const t = await getTranslations("legal");
  const keys = ["use", "noAdvice", "contact"] as const;
  return <LegalPage title={t("terms")} sections={[{ body: t("t.intro") }, ...keys.map((k) => ({ heading: t(`t.${k}Title`), body: t(`t.${k}`) }))]} />;
}
