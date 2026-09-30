import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Privacy Policy", robots: { index: true, follow: true } };

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  const keys = ["who", "data", "google", "limited", "storage", "rights", "changes"] as const;
  return (
    <LegalPage
      title={t("privacy")}
      sections={[{ body: t("p.intro") }, ...keys.map((k) => ({ heading: t(`p.${k}Title`), body: t(`p.${k}`) }))]}
    />
  );
}
